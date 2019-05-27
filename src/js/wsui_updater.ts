import { webFrame, remote } from 'electron';
import Store from 'electron-store';
import { Utils } from './ws_utils';
import { WalletShellSession } from './ws_session';
import { config } from './ws_config';
import { syncStatus } from './ws_constants';
const wsutil = new Utils();
const brwin = remote.getCurrentWindow();
const settings = new Store({ name: 'Settings' });
const sessConfig = { debug: remote.app.debug, walletConfig: remote.app.walletConfig };
const wsession = new WalletShellSession(sessConfig);

/* sync progress ui */
const syncDiv = document.getElementById('navbar-div-sync');
const syncInfoBar = document.getElementById('navbar-text-sync');
const connInfoDiv = document.getElementById('conn-info');
const WFCLEAR_INTERVAL = 5;

let WFCLEAR_TICK = 0;
let FUSION_CHECK = 0;
let TX_INITIALIZED = false;

function setWinTitle(title) {
    const defaultTitle = wsession.get('defaultTitle');
    brwin.setTitle((title ? `${defaultTitle} ${title}` : defaultTitle));
}

function triggerTxRefresh() {
    const txUpdateInputFlag = document.getElementById('transaction-updated');
    txUpdateInputFlag.value = 1;
    txUpdateInputFlag.dispatchEvent(new Event('change'));
}

function updateSyncProgress(data) {
    const iconSync = document.getElementById('navbar-icon-sync');
    let blockCount = data.displayBlockCount;
    let knownBlockCount = data.displayKnownBlockCount;
    let blockSyncPercent = data.syncPercent;
    let statusText = '';

    switch (knownBlockCount) {
        case syncStatus.NET_ONLINE:
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
            break;
        case syncStatus.NET_OFFLINE:
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
            // reset balance
            let resetBalance = {
                availableBalance: 0,
                lockedAmount: 0
            };
            updateBalance(resetBalance);
            break;
        case syncStatus.IDLE:
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
            break;
        case syncStatus.RESET:
            if (!connInfoDiv.innerHTML.startsWith('Connected')) {
                let connStatusText = `Connected to: <strong>${wsession.get('connectedNode')}</strong>`;
                let connNodeFee = wsession.get('nodeFee');
                if (connNodeFee > 0) {
                    connStatusText += ` | Node fee: <strong>${connNodeFee.toFixed(config.decimalPlaces)} ${config.assetTicker}</strong>`;
                }
                connInfoDiv.innerHTML = connStatusText;
                connInfoDiv.classList.remove('conn-warning');
                connInfoDiv.classList.remove('empty');
            }
            wsession.set('syncStarted', true);
            statusText = 'PREPARING RESCAN...';
            // info bar class
            syncDiv.className = 'syncing';
            syncInfoBar.textContent = statusText;
            // status icon
            iconSync.setAttribute('data-icon', 'sync');
            iconSync.classList.add('fa-spin');
            // sync status sess flag
            wsession.set('synchronized', false);
            brwin.setProgressBar(-1);
            break;
        case syncStatus.NODE_ERROR:
            // status info bar class
            syncDiv.className = 'failed';
            // sync status text
            statusText = 'NODE ERROR';
            syncInfoBar.textContent = statusText;
            //sync status icon
            iconSync.setAttribute('data-icon', 'times');
            iconSync.classList.remove('fa-spin');
            // connection status
            connInfoDiv.innerHTML = 'Connection failed, try switching to another Node, close and reopen your wallet';
            connInfoDiv.classList.remove('empty');
            connInfoDiv.classList.add('conn-warning');
            wsession.set('connectedNode', '');
            brwin.setProgressBar(-1);
            break;
        default:
            if (!connInfoDiv.innerHTML.startsWith('Connected')) {
                let connStatusText = `Connected to: <strong>${wsession.get('connectedNode')}</strong>`;
                let connNodeFee = wsession.get('nodeFee');
                if (connNodeFee > 0) {
                    connStatusText += ` | Node fee: <strong>${connNodeFee.toFixed(config.decimalPlaces)} ${config.assetTicker}</strong>`;
                }
                connInfoDiv.innerHTML = connStatusText;
                connInfoDiv.classList.remove('conn-warning');
                connInfoDiv.classList.remove('empty');
            }
            // sync sess flags
            wsession.set('syncStarted', true);
            statusText = `${blockCount}/${knownBlockCount}`;
            if (blockCount + 1 >= knownBlockCount && knownBlockCount !== 0) {
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
                statusText = `SYNCING ${statusText}`;
                if (blockSyncPercent < 100) statusText += ` (${blockSyncPercent}%)`;
                syncInfoBar.textContent = statusText;
                // status icon
                iconSync.setAttribute('data-icon', 'sync');
                iconSync.classList.add('fa-spin');
                // sync status sess flag
                wsession.set('synchronized', false);
                let taskbarProgress = +(parseFloat(blockSyncPercent) / 100).toFixed(2);
                brwin.setProgressBar(taskbarProgress);
            }
            break;
    }

    if (WFCLEAR_TICK === WFCLEAR_INTERVAL) {
        webFrame.clearCache();
        WFCLEAR_TICK = 0;
    }
    WFCLEAR_TICK++;

    // handle failed fusion
    if (true === wsession.get('fusionProgress')) {
        let lockedBalance = wsession.get('walletLockedBalance');
        if (lockedBalance <= 0 && FUSION_CHECK === 3) {
            fusionCompleted();
        }
        FUSION_CHECK++;
    }
}

function fusionCompleted() {
    const fusionProgressBar = document.getElementById('fusionProgress');
    fusionProgressBar.classList.add('hidden');
    FUSION_CHECK = 0;
    wsession.set('fusionStarted', false);
    wsession.set('fusionProgress', false);
    wsutil.showToast('Optimization completed. You may need to repeat the process until your wallet is fully optimized.', 5000);
}

function updateBalance(data) {
    const balanceAvailableField = document.querySelector('#balance-available > span');
    const balanceLockedField = document.querySelector('#balance-locked > span');
    const maxSendFormHelp = document.getElementById('sendFormHelp');
    const sendMaxAmount = document.getElementById('sendMaxAmount');
    let inputSendAmountField = document.getElementById('input-send-amount');

    if (!data) return;
    let availableBalance = parseFloat(data.availableBalance) || 0;

    let bUnlocked = wsutil.amountForMortal(availableBalance);
    let bLocked = wsutil.amountForMortal(data.lockedAmount);
    let fees = (wsession.get('nodeFee') + config.minimumFee);
    let maxSendRaw = (bUnlocked - fees);

    if (maxSendRaw <= 0) {
        inputSendAmountField.value = 0;
        inputSendAmountField.setAttribute('max', '0.00');
        inputSendAmountField.setAttribute('disabled', 'disabled');
        maxSendFormHelp.innerHTML = "You don't have any funds to be sent.";
        sendMaxAmount.dataset.maxsend = 0;
        sendMaxAmount.classList.add('hidden');
        wsession.set('walletUnlockedBalance', 0);
        wsession.set('walletLockedBalance', 0);
        if (availableBalance < 0) return;
    }

    balanceAvailableField.innerHTML = bUnlocked;
    balanceLockedField.innerHTML = bLocked;
    wsession.set('walletUnlockedBalance', bUnlocked);
    wsession.set('walletLockedBalance', bLocked);
    // update fusion progress
    if (true === wsession.get('fusionProgress')) {
        if (wsession.get('fusionStarted') && parseInt(bLocked, 10) <= 0) {
            fusionCompleted();
        } else {
            if (parseInt(bLocked, 10) > 0) {
                wsession.set('fusionStarted', true);
            }
        }
    }

    let walletFile = require('path').basename(settings.get('recentWallet'));
    let wintitle = `(${walletFile}) - ${bUnlocked} ${config.assetTicker}`;
    setWinTitle(wintitle);

    if (maxSendRaw > 0) {
        let maxSend = (maxSendRaw).toFixed(config.decimalPlaces);
        inputSendAmountField.setAttribute('max', maxSend);
        inputSendAmountField.removeAttribute('disabled');
        maxSendFormHelp.innerHTML = `Max. amount is ${maxSend}`;
        sendMaxAmount.dataset.maxsend = maxSend;
        sendMaxAmount.classList.remove('hidden');
    }
}

function updateTransactions(result) {
    let txlistExisting = wsession.get('txList');
    const blockItems = result.items;

    if (!txlistExisting.length && !blockItems.length) {
        document.getElementById('transaction-export').classList.add('hidden');
    } else {
        document.getElementById('transaction-export').classList.remove('hidden');
    }

    if (!blockItems.length) return;

    let txListNew = [];

    Array.from(blockItems).forEach((block) => {
        block.transactions.map((tx) => {
            if (tx.amount !== 0 && !wsutil.objInArray(txlistExisting, tx, 'transactionHash')) {
                tx.amount = wsutil.amountForMortal(tx.amount);
                tx.timeStr = new Date(tx.timestamp * 1000).toUTCString();
                tx.fee = wsutil.amountForMortal(tx.fee);
                tx.paymentId = tx.paymentId.length ? tx.paymentId : '-';
                tx.txType = (tx.amount > 0 ? 'in' : 'out');
                tx.rawAmount = parseInt(tx.amount, 10);
                tx.rawFee = tx.fee;
                tx.rawPaymentId = tx.paymentId;
                tx.rawHash = tx.transactionHash;
                txListNew.unshift(tx);
            }
        });
    });

    if (!txListNew.length) return;
    let latestTx = txListNew[0];
    let newLastHash = latestTx.transactionHash;
    let newLastTimestamp = latestTx.timestamp;
    let newTxAmount = latestTx.amount;

    // store it
    wsession.set('txLastHash', newLastHash);
    wsession.set('txLastTimestamp', newLastTimestamp);
    let txList = txListNew.concat(txlistExisting);
    wsession.set('txList', txList);
    wsession.set('txLen', txList.length);
    wsession.set('txNew', txListNew);

    let currentDate = new Date();
    currentDate = `${currentDate.getUTCFullYear()}-${currentDate.getUTCMonth() + 1}-${currentDate.getUTCDate()}`;
    let lastTxDate = new Date(newLastTimestamp * 1000);
    lastTxDate = `${lastTxDate.getUTCFullYear()}-${lastTxDate.getUTCMonth() + 1}-${lastTxDate.getUTCDate()}`;

    // amount to check
    setTimeout(triggerTxRefresh, (TX_INITIALIZED ? 100 : 1000));

    let rememberedLastHash = settings.get('last_notification', '');
    let notify = true;
    if (lastTxDate !== currentDate || (newTxAmount < 0) || rememberedLastHash === newLastHash) {
        notify = false;
    }

    if (notify) {
        settings.set('last_notification', newLastHash);
        let notiOptions = {
            'body': `Amount: ${(newTxAmount)} ${config.assetTicker}\nHash: ${newLastHash.substring(24, -0)}...`,
            'icon': '../assets/walletshell_icon.png'
        };
        let itNotification = new Notification('Incoming Transfer', notiOptions);
        itNotification.onclick = (event) => {
            event.preventDefault();
            let txNotifyFiled = document.getElementById('transaction-notify');
            txNotifyFiled.value = 1;
            txNotifyFiled.dispatchEvent(new Event('change'));
            if (!brwin.isVisible()) brwin.show();
            if (brwin.isMinimized()) brwin.restore();
            if (!brwin.isFocused()) brwin.focus();
        };
    }
}

function showFeeWarning(fee) {
    fee = fee || 0;
    let nodeFee = parseFloat(fee);
    if (nodeFee <= 0) return;

    let dialog = document.getElementById('main-dialog');
    if (dialog.hasAttribute('open')) return;
    dialog.classList.add('dialog-warning');
    let htmlStr = `
        <h5>Fee Info</h5>
        <p>You are connected to a public node (${settings.get('node_address')}) that charges a fee to send transactions.<p>
        <p>The fee for sending transactions is: <strong>${fee.toFixed(config.decimalPlaces)} ${config.assetTicker} </strong>.<br>
            If you don't want to pay the node fee, please close your wallet, reopen and choose different public node (or run your own node).
        </p>
        <p style="text-align:center;margin-top: 1.25rem;"><button  type="button" class="form-bt button-green dialog-close-default" id="dialog-end">OK, I Understand</button></p>
    `;
    dialog.innerHTML = htmlStr;
    dialog.showModal();
    dialog.addEventListener('close', function () {
        dialog.classList.remove('dialog-warning');
        wsutil.clearChild(dialog);
    });
}

function updateQr(address) {
    //let backupReminder = document.getElementById('button-overview-showkeys');
    if (!address) {
        triggerTxRefresh();
        //backupReminder.classList.remove('connected');
        try { clearInterval(window.backupReminderTimer); } catch (_e) { }
        return;
    }

    // window.backupReminderTimer = setInterval(() => {
    //     if (Math.floor(Math.random() * Math.floor(2)) >= 1) {
    //         backupReminder.classList.add('connected');
    //         backupReminder.classList.add('reminder');
    //         setTimeout(() => {
    //             backupReminder.classList.remove('reminder');
    //         }, 2000);
    //         setTimeout(() => {
    //             backupReminder.classList.remove('connected');
    //         }, 2200);
    //     }
    // }, 50000);

    let walletHash = wsutil.fnvhash(address);
    wsession.set('walletHash', walletHash);

    let oldImg = document.getElementById('qr-gen-img');
    if (oldImg) oldImg.remove();

    let qr_base64 = wsutil.genQrDataUrl(address);
    if (qr_base64.length) {
        let qrBox = document.getElementById('div-w-qr');
        let qrImg = document.createElement("img");
        qrImg.setAttribute('id', 'qr-gen-img');
        qrImg.setAttribute('src', qr_base64);
        qrBox.prepend(qrImg);
        document.getElementById('scan-qr-help').classList.remove('hidden');
    } else {
        document.getElementById('scan-qr-help').classList.add('hidden');
    }
}

function resetFormState() {
    const allFormInputs = document.querySelectorAll('.section input,.section textarea');
    if (!allFormInputs) return;

    for (var i = 0; i < allFormInputs.length; i++) {
        let el = allFormInputs[i];
        if (el.dataset.initial) {
            if (!el.dataset.noclear) {
                el.value = settings.has(el.dataset.initial) ? settings.get(el.dataset.initial) : '';
                if (el.getAttribute('type') === 'checkbox') {
                    el.checked = settings.get(el.dataset.initial);
                }
            }
        } else if (el.dataset.default) {
            if (!el.dataset.noclear) {
                el.value = el.dataset.default;
            }
        } else {
            if (!el.dataset.noclear) el.value = '';
        }
    }

    const settingsBackBtn = document.getElementById('button-settings-back');
    if (wsession.get('serviceReady')) {
        connInfoDiv.classList.remove('empty');
        settingsBackBtn.dataset.section = 'section-welcome';
    } else {
        connInfoDiv.classList.add('empty');
        settingsBackBtn.dataset.section = 'section-overview';
    }
}

// update ui state, push from svc_main
function updateUiState(msg) {
    // do something with msg
    switch (msg.type) {
        case 'blockUpdated':
            updateSyncProgress(msg.data);
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
            if (msg.data) resetFormState(msg.data);
            break;
        case 'fusionTxCompleted':
            const fusionProgressBar = document.getElementById('fusionProgress');
            if (msg.code === 0) { // skipped
                wsession.set('fusionProgress', false);
                fusionProgressBar.classList.add('hidden');
                wsutil.showToast(msg.data, 5000);
            } else {
                // set progress flag
                wsession.set('fusionProgress', true);
                // show progress bar
                fusionProgressBar.classList.remove('hidden');
                // do nothing, just wait
            }
            break;
        default:
            console.log('invalid command', msg);
            break;
    }
}

module.exports = { updateUiState };
