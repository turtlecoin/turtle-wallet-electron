/* globals iqwerty */
const {webFrame, remote} = require('electron');
const Store = require('electron-store');
const wsutil = require('./ws_utils');
const WalletShellSession = require('./ws_session');
const config = require('./ws_config');

const brwin = remote.getCurrentWindow();
const settings = new Store({name: 'Settings'});
const wsession = new WalletShellSession();

/* sync progress ui */
const syncDiv = document.getElementById('navbar-div-sync');
const syncInfoBar = document.getElementById('navbar-text-sync');
const connInfoDiv = document.getElementById('conn-info');

const SYNC_STATUS_NET_CONNECTED = -10;
const SYNC_STATUS_NET_DISCONNECTED = -50;
const SYNC_STATUS_IDLE = -100;
const SYNC_STATUS_NODE_ERROR = -200;

const WFCLEAR_INTERVAL = 5;
let WFCLEAR_TICK = 0;

function setWinTitle(title){
    let defaultTitle = wsession.get('defaultTitle');
    let newTitle = defaultTitle;
    if(title){
        newTitle = `${defaultTitle} ${title}`;
    }
    brwin.setTitle(newTitle);
}

function triggerTxRefresh(){
    const txUpdateInputFlag = document.getElementById('transaction-updated');
    txUpdateInputFlag.value = 1;
    txUpdateInputFlag.dispatchEvent(new Event('change'));
}

function updateSyncProgres(data){
    const iconSync = document.getElementById('navbar-icon-sync');
    let blockCount = data.displayBlockCount;
    let knownBlockCount = data.displayKnownBlockCount;
    let blockSyncPercent = data.syncPercent;
    let statusText = '';

    if(knownBlockCount === SYNC_STATUS_NET_CONNECTED){
        // sync status text
        statusText = 'RESUMING WALLET SYNC...';
        syncInfoBar.innerHTML = statusText;
        // sync info bar class
        syncDiv.className = 'syncing';
        // sync status icon
        iconSync.setAttribute('data-icon', 'sync');
        iconSync.classList.add('fa-spin');
        // connection status
        connInfoDiv.innerHTML = 'Connection restored, resuming sync process...';
        connInfoDiv.classList.remove('empty');
        connInfoDiv.classList.remove('conn-warning');

        // sync sess flags
        wsession.set('syncStarted', false);
        wsession.set('synchronized', false);
        brwin.setProgressBar(-1);
    }else if(knownBlockCount === SYNC_STATUS_NET_DISCONNECTED){
        // sync status text
        statusText = 'PAUSED, NETWORK DISCONNECTED';
        syncInfoBar.innerHTML = statusText;
        // sync info bar class
        syncDiv.className = '';
        // sync status icon
        iconSync.setAttribute('data-icon', 'ban');
        iconSync.classList.remove('fa-spin');
        // connection status
        connInfoDiv.innerHTML = 'Synchronization paused, please check your network connection!';
        connInfoDiv.classList.remove('empty');
        connInfoDiv.classList.add('conn-warning');

        // sync sess flags
        wsession.set('syncStarted', false);
        wsession.set('synchronized', false);
        brwin.setProgressBar(-1);
    }else if(knownBlockCount === SYNC_STATUS_IDLE){
        // sync status text
        statusText = 'IDLE';
        syncInfoBar.innerHTML = statusText;
        // sync info bar class
        syncDiv.className = '';
        // sync status icon
        iconSync.setAttribute('data-icon', 'pause-circle');
        iconSync.classList.remove('fa-spin');
        // connection status
        connInfoDiv.classList.remove('conn-warning');
        connInfoDiv.classList.add('empty');
        connInfoDiv.textContent = '';
        
        
        // sync sess flags
        wsession.set('syncStarted', false);
        wsession.set('synchronized', false);
        brwin.setProgressBar(-1);
        // reset wintitle
        setWinTitle();
        // no node connected
        wsession.set('connectedNode', '');
    }else if(knownBlockCount === SYNC_STATUS_NODE_ERROR){
        // not connected
        // status info bar class
        syncDiv.className = 'failed';
        // sync status text
        statusText = 'NODE ERROR';
        syncInfoBar.textContent = statusText;
        //sync status icon
        iconSync.setAttribute('data-icon', 'times');
        iconSync.classList.remove('fa-spin');
        // connection status
        connInfoDiv.innerHTML = 'Connection failed, try switching to another Node in settings page, close and reopen your wallet';
        connInfoDiv.classList.remove('empty');
        connInfoDiv.classList.add('conn-warning');
        wsession.set('connectedNode', '');
        brwin.setProgressBar(-1);
    }else{
        // sync sess flags
        wsession.set('syncStarted', true);
        statusText = `${blockCount}/${knownBlockCount}` ;
        if(blockCount+1 >= knownBlockCount && knownBlockCount !== 0) {
            // info bar class
            syncDiv.classList = 'synced';
            // status text
            statusText = `SYNCED ${statusText}`;
            syncInfoBar.textContent = statusText;
            // status icon 
            iconSync.setAttribute('data-icon', 'check');
            iconSync.classList.remove('fa-spin');
            // sync status sess flag
            wsession.set('synchronized', true);
            brwin.setProgressBar(-1);
         } else {
             // info bar class
            syncDiv.className = 'syncing';
            // status text
            statusText = `SYNCING ${statusText} (${blockSyncPercent}%)`;
            syncInfoBar.textContent = statusText;
            // status icon
            iconSync.setAttribute('data-icon', 'sync');
            iconSync.classList.add('fa-spin');
            // sync status sess flag
            wsession.set('synchronized', false);
            let taskbarProgress = +(parseFloat(blockSyncPercent)/100).toFixed(2);
            brwin.setProgressBar(taskbarProgress);
        }
        
        let connStatusText = `Connected to: <strong>${wsession.get('connectedNode')}</strong>`;
        let connNodeFee = wsession.get('nodeFee');
        if(connNodeFee > 0 ){
            connStatusText += ` | Node fee: <strong>${connNodeFee.toFixed(config.decimalPlaces)} ${config.assetTicker}</strong>`;
        }
        connInfoDiv.innerHTML = connStatusText;
        connInfoDiv.classList.remove('conn-warning');
        connInfoDiv.classList.remove('empty');
    }

    if(WFCLEAR_TICK === 0 || WFCLEAR_TICK === WFCLEAR_INTERVAL){
        webFrame.clearCache();
        WFCLEAR_TICK = 0;
    }
    WFCLEAR_TICK++;
}

function updateBalance(data){
    const balanceAvailableField = document.querySelector('#balance-available > span');
    const balanceLockedField = document.querySelector('#balance-locked > span');
    const maxSendFormHelp = document.getElementById('sendFormHelp');
    const sendMaxAmount = document.getElementById('sendMaxAmount');
    let inputSendAmountField = document.getElementById('input-send-amount');

    if(!data) return;
    let availableBalance = parseFloat(data.availableBalance) || 0;
    if(availableBalance <= 0){
        inputSendAmountField.value = 0;
        inputSendAmountField.setAttribute('max','0.00');
        inputSendAmountField.setAttribute('disabled','disabled');
        maxSendFormHelp.innerHTML = "You don't have any funds to be sent.";
        sendMaxAmount.dataset.maxsend = 0;
        sendMaxAmount.classList.add('hidden');
        wsession.set('walletUnlockedBalance', 0);
        wsession.set('walletLockedBalance', 0);
        if(availableBalance < 0) return;
    }

    //let bUnlocked = (availableBalance / 100).toFixed(2);
    let bUnlocked = wsutil.amountForMortal(availableBalance);
    let bLocked = wsutil.amountForMortal(data.lockedAmount);
    balanceAvailableField.innerHTML = bUnlocked;
    balanceLockedField.innerHTML = bLocked;
    wsession.set('walletUnlockedBalance', bUnlocked);
    wsession.set('walletLockedBalance', bLocked);
    let walletFile = require('path').basename(settings.get('recentWallet'));
    let wintitle = `(${walletFile}) - ${bUnlocked} ${config.assetTicker}`;
    setWinTitle(wintitle);
    
    if(availableBalance > 0){
        let fees = (wsession.get('nodeFee')+config.minimumFee);
        let maxSend = (bUnlocked - fees).toFixed(config.decimalPlaces);
        inputSendAmountField.setAttribute('max',maxSend);
        inputSendAmountField.removeAttribute('disabled');
        maxSendFormHelp.innerHTML = `Max. amount is ${maxSend}`;
        sendMaxAmount.dataset.maxsend = maxSend;
        sendMaxAmount.classList.remove('hidden');
    }
}

function updateTransactions(result){
    let txlistExisting = wsession.get('txList');
    

    const blockItems = result.items;

    if(!txlistExisting.length && !blockItems.length){
        document.getElementById('transaction-export').classList.add('hidden');
    }else{
        document.getElementById('transaction-export').classList.remove('hidden');
    }

    if(!blockItems.length) return;
    
    let txListNew = [];

    Array.from(blockItems).forEach((block) => {
        block.transactions.map((tx) => {
            if(tx.amount !== 0 && !wsutil.objInArray(txlistExisting, tx, 'transactionHash')){
                //tx.amount = (tx.amount/100).toFixed(2);
                tx.amount = wsutil.amountForMortal(tx.amount);
                tx.timeStr = new Date(tx.timestamp*1000).toUTCString();
                //tx.timeStr = tx.timeStr = new Date(tx.timestamp * 1000).toDateString();
                //tx.fee = (tx.fee/100).toFixed(2);
                tx.fee = wsutil.amountForMortal(tx.fee);
                tx.paymentId = tx.paymentId.length ? tx.paymentId : '-';
                tx.txType = (tx.amount > 0 ? 'in' : 'out');
                tx.rawAmount = tx.amount;
                tx.rawFee = tx.fee;
                tx.rawPaymentId = tx.paymentId;
                tx.rawHash = tx.transactionHash;
                txListNew.unshift(tx);
            }
        });
    });

    if(!txListNew.length) return;
    let latestTx = txListNew[0];
    let newLastHash = latestTx.transactionHash;
    let newLastTimestamp = latestTx.timestamp;
    let newTxAmount = latestTx.amount;

    // store it
    wsession.set('txLastHash',newLastHash);
    wsession.set('txLastTimestamp', newLastTimestamp);
    let txList = txListNew.concat(txlistExisting);
    wsession.set('txList', txList);
    wsession.set('txLen', txList.length);
    wsession.set('txNew', txListNew);

    let currentDate = new Date();
    currentDate = `${currentDate.getUTCFullYear()}-${currentDate.getUTCMonth()+1}-${currentDate.getUTCDate()}`;
    let lastTxDate = new Date(newLastTimestamp*1000);
    lastTxDate = `${lastTxDate.getUTCFullYear()}-${lastTxDate.getUTCMonth()+1}-${lastTxDate.getUTCDate()}`;

    // amount to check
    triggerTxRefresh();

    let rememberedLastHash = settings.get('last_notification', '');
    let notify = true;
    if(lastTxDate !== currentDate || (newTxAmount < 0) || rememberedLastHash === newLastHash ){
        notify = false;
    }
    
    if(notify){
        settings.set('last_notification', newLastHash);
        let notiOptions = {
            'body': `Amount: ${(newTxAmount)} ${config.assetTicker}\nHash: ${newLastHash.substring(24,-0)}...`,
            'icon': '../assets/walletshell_icon.png'
        };
        let itNotification = new Notification('Incoming Transfer', notiOptions);
        itNotification.onclick = (event) => {
            event.preventDefault();
            let  txNotifyFiled = document.getElementById('transaction-notify');
            txNotifyFiled.value = 1;
            txNotifyFiled.dispatchEvent(new Event('change'));
            if(!brwin.isVisible()) brwin.show();
            if(brwin.isMinimized()) brwin.restore();
            if(!brwin.isFocused()) brwin.focus();
        };
    }
}

function showFeeWarning(fee){
    fee = fee || 0; // fee vale already for mortal
    let nodeFee = parseFloat(fee);
    if(nodeFee <= 0) return;

    let dialog = document.getElementById('main-dialog');
    if(dialog.hasAttribute('open')) return;

    dialog.classList.add('dialog-warning');
    let htmlStr = `
        <h5>Fee Info</h5>
        <p>You are connected to a public node (${settings.get('daemon_host')}:${settings.get('daemon_port')}) that charges a fee to send transactions.<p>
        <p>The fee for sending transactions is: <strong>${fee.toFixed(config.decimalPlaces)} ${config.assetTicker} </strong>.<br>
            If you don't want to pay the node fee, please close your wallet, reopen and choose different public node (or run your own node).
        </p>
        <p style="text-align:center;margin-top: 1.25rem;"><button  type="button" class="form-bt button-green" id="dialog-end">OK, I Understand</button></p>
    `;

    wsutil.innerHTML(dialog, htmlStr);
    let dialogEnd = document.getElementById('dialog-end');
    dialogEnd.addEventListener('click', () => {
        try{
            dialog.classList.remove('dialog-warning');
            document.getElementById('main-dialog').close();
        }catch(e){}
    });
    dialog = document.getElementById('main-dialog');
    dialog.showModal();
    dialog.addEventListener('close', function(){
        wsutil.clearChild(dialog);
    });
}

function updateQr(address){
    if(!address){
        triggerTxRefresh();
        return;
    }

    let walletHash = wsutil.b2sSum(address);
    wsession.set('walletHash', walletHash);
    
    let oldImg = document.getElementById('qr-gen-img');
    if(oldImg) oldImg.remove();

    let qr_base64 = wsutil.genQrDataUrl(address);
    if(qr_base64.length){
        let qrBox = document.getElementById('div-w-qr');
        let qrImg = document.createElement("img");
        qrImg.setAttribute('id', 'qr-gen-img');
        qrImg.setAttribute('src', qr_base64);
        qrBox.prepend(qrImg);
        document.getElementById('scan-qr-help').classList.remove('hidden');
    }else{
        document.getElementById('scan-qr-help').classList.add('hidden');
    }
}

function resetFormState(){
    const allFormInputs = document.querySelectorAll('.section input,.section textarea');
    if(!allFormInputs) return;

    for(var i=0;i<allFormInputs.length;i++){
        let el = allFormInputs[i];
        if(el.dataset.initial){
            if(!el.dataset.noclear){
                el.value = settings.has(el.dataset.initial) ? settings.get(el.dataset.initial) : '';
                if(el.getAttribute('type') === 'checkbox'){
                    el.checked = settings.get(el.dataset.initial);
                }
            }
        }else{
            if(!el.dataset.noclear) el.value = '';
        }
    }

    const settingsBackBtn = document.getElementById('button-settings-back');
    if(wsession.get('serviceReady')){
        connInfoDiv.classList.remove('empty');
        settingsBackBtn.dataset.section = 'section-welcome';
    }else{
        connInfoDiv.classList.add('empty');
        settingsBackBtn.dataset.section = 'section-overview';
    }
}

// update ui state, push from svc_main
function updateUiState(msg){
    // do something with msg
    switch (msg.type) {
        case 'blockUpdated':
            updateSyncProgres(msg.data);
            break;
        case 'balanceUpdated':
            updateBalance(msg.data);
            break;
        case 'transactionUpdated':
            updateTransactions(msg.data);
            break;
        case 'nodeFeeUpdated':
            showFeeWarning(msg.data);
            break;
        case 'addressUpdated':
            updateQr(msg.data);
            break;
        case 'sectionChanged':
            if(msg.data) resetFormState(msg.data);
            break;
        case 'fusionTxCompleted':
            let notif = 'Optimization completed';
            let toastOpts = {
                style: { main: { 
                    'padding': '4px 6px','left': '3px','right':'auto','border-radius': '0px'
                }},
                settings: {duration: 5000}
            };
            if(msg.data) notif = msg.data;
            iqwerty.toast.Toast(notif, toastOpts);
            break;
        default:
            console.log('invalid command received by ui', msg);
            break;
    }
}

module.exports = {updateUiState};