/*jshint bitwise: false*/
/* global AbortController */
import { clipboard, remote, ipcRenderer, shell } from 'electron';
import { config } from '../../src/js/ws_config';
import os from 'os';
import net from 'net';
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';
import Mousetrap from 'mousetrap';
import autoComplete from 'js-autocomplete';
import async from 'async';
import AgGrid from 'ag-grid-community';

import { Utils } from './ws_utils';
import { WalletShellSession } from './ws_session';
const WalletShellManager = require('./ws_manager');
import { syncStatus } from './ws_constants';

const wsutil = new Utils();
const wsmanager = new WalletShellManager();
const sessConfig = { debug: remote.app.debug, walletConfig: remote.app.walletConfig };

const wsession = new WalletShellSession(sessConfig);
const settings = new Store({ name: 'Settings' });
const WalletShellAddressbook = require('./ws_addressbook');

const ADDRESS_BOOK_DIR = remote.app.getPath('userData');
const ADDRESS_BOOK_DEFAULT_PATH = path.join(ADDRESS_BOOK_DIR, '/SharedAddressBook.json');
let addressBook = new WalletShellAddressbook(ADDRESS_BOOK_DEFAULT_PATH);

const win = remote.getCurrentWindow();
const Menu = remote.Menu;
const WS_VERSION = settings.get('version', 'unknown');
const DEFAULT_WALLET_PATH = remote.app.getPath('documents');


let WALLET_OPEN_IN_PROGRESS = false;

/*  dom elements vars; */
// main section link
let sectionButtons;
// generics
let genericBrowseButton;
let genericFormMessage;
let genericEnterableInputs;
let genericEditableInputs;
let firstTab;
// settings page
let settingsInputServiceBin;
let settingsInputMinToTray;
let settingsInputCloseToTray;
let settingsInputExcludeOfflineNodes;
let settingsInputTimeout;
let settingsButtonSave;
// overview page
let overviewWalletAddress;
let overviewWalletCloseButton;
let overviewWalletRescanButton;
let overviewPaymentIdGen;
let overviewIntegratedAddressGen;
let overviewShowKeyButton;
// addressbook page
let addressBookInputName;
let addressBookInputWallet;
let addressBookInputPaymentId;
let addressBookInputUpdate;
let addressBookButtonSave;
// new abook
let addressBookButtonAdd;
let addressBookSelector;
// open wallet page
let walletOpenInputPath;
let walletOpenInputPassword;
let walletOpenButtonOpen;
let walletOpenButtons;
let walletOpenInputNode;
let walletOpenNodeLabel;
let walletOpenSelectBox;
let walletOpenSelectOpts;
let walletOpenAddCustomNode;
let walletOpenRefreshNodes;
// show/export keys page
let showkeyButtonExportKey;
let showkeyInputViewKey;
let showkeyInputSpendKey;
let showkeyInputSeed;
// send page
let sendInputAddress;
let sendInputAmount;
let sendInputPaymentId;
let sendInputFee;
let sendButtonSend;
let sendMaxAmount;
let sendOptimize;
// create wallet
let overviewButtonCreate;
let walletCreateInputPath;
// let walletCreateInputFilename;
let walletCreateInputPassword;
// import wallet keys
let importKeyButtonImport;
let importKeyInputPath;
// let importKeyInputFilename;
let importKeyInputPassword;
let importKeyInputViewKey;
let importKeyInputSpendKey;
let importKeyInputScanHeight;
// import wallet seed
let importSeedButtonImport;
let importSeedInputPath;
//let importSeedInputFilename;
let importSeedInputPassword;
let importSeedInputMnemonic;
let importSeedInputScanHeight;
// transaction
let txButtonRefresh;
let txButtonSortAmount;
let txButtonSortDate;
let txInputUpdated;
let txButtonExport;
// misc
let thtml;
let dmswitch;
let kswitch;
let iswitch;

function populateElementVars() {
    // misc
    thtml = document.documentElement;
    dmswitch = document.getElementById('tswitch');
    kswitch = document.getElementById('kswitch');
    iswitch = document.getElementById('button-section-about');
    firstTab = document.querySelector('.navbar-button');
    // generics
    genericBrowseButton = document.querySelectorAll('.path-input-button:not(.d-opened');
    genericFormMessage = document.getElementsByClassName('form-ew');
    genericEnterableInputs = document.querySelectorAll('.section input:not(.noenter)');
    genericEditableInputs = document.querySelectorAll('textarea:not([readonly]), input:not([readonly]');

    // main section link
    sectionButtons = document.querySelectorAll('[data-section]');

    // settings input & elements
    settingsInputServiceBin = document.getElementById('input-settings-path');
    settingsInputMinToTray = document.getElementById('checkbox-tray-minimize');
    settingsInputCloseToTray = document.getElementById('checkbox-tray-close');
    settingsInputExcludeOfflineNodes = document.getElementById('pubnodes-exclude-offline');
    settingsInputTimeout = document.getElementById('input-settings-timeout');
    settingsButtonSave = document.getElementById('button-settings-save');

    // overview pages
    overviewWalletAddress = document.getElementById('wallet-address');
    overviewWalletCloseButton = document.getElementById('button-overview-closewallet');
    overviewPaymentIdGen = document.getElementById('payment-id-gen');
    overviewIntegratedAddressGen = document.getElementById('integrated-wallet-gen');
    overviewWalletRescanButton = document.getElementById('button-overview-rescan');
    // addressbook page
    addressBookInputName = document.getElementById('input-addressbook-name');
    addressBookInputWallet = document.getElementById('input-addressbook-wallet');
    addressBookInputPaymentId = document.getElementById('input-addressbook-paymentid');
    addressBookInputUpdate = document.getElementById('input-addressbook-update');
    addressBookButtonSave = document.getElementById('button-addressbook-save');
    addressBookButtonAdd = document.getElementById('addAddressBook');
    addressBookSelector = document.getElementById('addressBookSelector');
    // open wallet page
    walletOpenInputPath = document.getElementById('input-load-path');
    walletOpenInputPassword = document.getElementById('input-load-password');
    walletOpenButtonOpen = document.getElementById('button-load-load');
    walletOpenButtons = document.getElementById('walletOpenButtons');
    walletOpenInputNode = document.getElementById('input-settings-node-address');
    walletOpenNodeLabel = document.getElementById('fake-selected-node');
    walletOpenSelectBox = document.getElementById('fake-select');
    walletOpenSelectOpts = document.getElementById('fakeNodeOptions');
    walletOpenAddCustomNode = document.getElementById('addCustomNode');
    walletOpenRefreshNodes = document.getElementById('updateNodeList');
    // show/export keys page
    overviewShowKeyButton = document.getElementById('button-show-reveal');
    showkeyButtonExportKey = document.getElementById('button-show-export');
    showkeyInputViewKey = document.getElementById('key-show-view');
    showkeyInputSpendKey = document.getElementById('key-show-spend');
    showkeyInputSeed = document.getElementById('seed-show');

    // send page
    sendInputAddress = document.getElementById('input-send-address');
    sendInputAmount = document.getElementById('input-send-amount');
    sendInputPaymentId = document.getElementById('input-send-payid');
    sendInputFee = document.getElementById('input-send-fee');
    sendButtonSend = document.getElementById('button-send-send');
    // maxSendFormHelp = document.getElementById('sendFormHelp');
    sendMaxAmount = document.getElementById('sendMaxAmount');
    sendOptimize = document.getElementById('button-send-optimize');
    // create wallet
    overviewButtonCreate = document.getElementById('button-create-create');
    walletCreateInputPath = document.getElementById('input-create-path');
    //walletCreateInputFilename = document.getElementById('input-create-name');
    walletCreateInputPassword = document.getElementById('input-create-password');
    // import wallet keys
    importKeyButtonImport = document.getElementById('button-import-import');
    importKeyInputPath = document.getElementById('input-import-path');
    //importKeyInputFilename = document.getElementById('input-import-name');
    importKeyInputPassword = document.getElementById('input-import-password');
    importKeyInputViewKey = document.getElementById('key-import-view');
    importKeyInputSpendKey = document.getElementById('key-import-spend');
    importKeyInputScanHeight = document.getElementById('key-import-height');
    // import wallet seed
    importSeedButtonImport = document.getElementById('button-import-seed-import');
    importSeedInputPath = document.getElementById('input-import-seed-path');
    //importSeedInputFilename = document.getElementById('input-import-seed-name');
    importSeedInputPassword = document.getElementById('input-import-seed-password');
    importSeedInputMnemonic = document.getElementById('key-import-seed');
    importSeedInputScanHeight = document.getElementById('key-import-seed-height');
    // tx page
    // transaction
    txButtonRefresh = document.getElementById('button-transactions-refresh');
    txButtonSortAmount = document.getElementById('txSortAmount');
    txButtonSortDate = document.getElementById('txSortTime');
    txInputUpdated = document.getElementById('transaction-updated');
    txButtonExport = document.getElementById('transaction-export');
}

// crude/junk template :)
let jtfr = {
    tFind: [
        "WalletShell",
        "https://github.com/turtlecoin/turtle-wallet-electron",
        "TurtleCoin",
        "TRTL",
        "turtle-service",
        "CFG_MIN_FEE",
        "CFG_MIN_SEND"
    ],
    tReplace: [
        config.appName,
        config.appGitRepo,
        config.assetName,
        config.assetTicker,
        config.walletServiceBinaryFilename,
        config.minimumFee,
        config.mininumSend
    ]
};

let junkTemplate = (text) => {
    return jtfr.tFind.reduce((acc, item, i) => {
        const regex = new RegExp(item, "g");
        return acc.replace(regex, jtfr.tReplace[i]);
    }, text);
};

function initSectionTemplates() {
    const importLinks = document.querySelectorAll('link[rel="import"]');
    for (var i = 0; i < importLinks.length; i++) {
        let template = importLinks[i].import.getElementsByTagName("template")[0];
        let templateString = junkTemplate(template.innerHTML);
        let templateNode = document.createRange().createContextualFragment(templateString);
        let clone = document.adoptNode(templateNode);
        document.getElementById('main-div').appendChild(clone);
    }
    // once all elements in place, safe to populate dom vars
    populateElementVars();
}

// utility: dark mode
function setDarkMode(dark) {
    let tmode = dark ? 'dark' : '';
    thtml.classList.add('transit');
    if (tmode === 'dark') {
        thtml.classList.add('dark');
        dmswitch.setAttribute('title', 'Leave dark mode');
        dmswitch.firstChild.classList.remove('fa-moon');
        dmswitch.firstChild.classList.add('fa-sun');
        settings.set('darkmode', true);
        dmswitch.firstChild.dataset.icon = 'sun';
    } else {
        thtml.classList.remove('dark');
        dmswitch.setAttribute('title', 'Swith to dark mode');
        dmswitch.firstChild.classList.remove('fa-sun');
        dmswitch.firstChild.classList.add('fa-moon');
        settings.set('darkmode', false);
        dmswitch.firstChild.dataset.icon = 'moon';
    }
    setTimeout(function () {
        thtml.classList.remove('transit');
    }, 2000);
}

function genPaymentId(ret) {
    ret = ret || false;

    let payId = require('crypto').randomBytes(32).toString('hex');
    if (ret) return payId.toUpperCase();

    let dialogTpl = `<div class="transaction-panel">
            <h4>Generated Payment ID:</h4>
            <textarea data-cplabel="Payment ID" title="click to copy" class="ctcl default-textarea" rows="1" readonly="readonly">${payId.toUpperCase()}</textarea>
            <span title="Close this dialog (esc)" class="dialog-close dialog-close-default" data-target="#ab-dialog"><i class="fas fa-window-close"></i></span>
        </div>`;
    let dialog = document.getElementById('ab-dialog');
    if (dialog.hasAttribute('open')) dialog.close();
    dialog.innerHTML = dialogTpl;
    dialog.showModal();
}

function showIntegratedAddressForm() {
    let dialog = document.getElementById('ab-dialog');
    let ownAddress = wsession.get('loadedWalletAddress');
    if (dialog.hasAttribute('open')) dialog.close();

    let iaform = `
    <div class="transaction-panel">
        <h4>Generate Integrated Address:</h4>
        <div class="input-wrap">
            <label>Wallet Address</label>
            <textarea id="genInputAddress" class="default-textarea" placeholder="Required, put any valid ${config.assetTicker} address..">${ownAddress}</textarea>
        </div>
        <div class="input-wrap">
            <label>Payment Id (<a id="makePaymentId" class="wallet-tool inline-tool" title="generate random payment id...">generate</a>)</label>
            <input id="genInputPaymentId" type="text" required="required" class="text-block" placeholder="Required, enter a valid payment ID, or click generate to get random ID" />
        </div>
        <div class="input-wrap">
            <textarea data-cplabel="Integrated address" placeholder="Fill the form &amp; click generate, integrated address will appear here..." rows="3" id="genOutputIntegratedAddress" class="default-textarea ctcl" readonly="readonly"></textarea>
        </div>
        <div class="input-wrap">
            <span class="form-ew form-msg text-spaced-error hidden" id="text-gia-error"></span>
        </div>
        <div class="div-panel-buttons">
            <button id="doGenIntegratedAddr" type="button" class="button-green">Generate</button>
        </div>
        <span title="Close this dialog (esc)" class="dialog-close dialog-close-default" data-target="#ab-dialog"><i class="fas fa-window-close"></i></span>
    </div>    
    `;
    dialog.innerHTML = iaform;
    dialog.showModal();
}

function showKeyBindings() {
    let dialog = document.getElementById('ab-dialog');
    if (dialog.hasAttribute('open')) dialog.close();
    let shortcutstInfo = document.getElementById('shortcuts-main').innerHTML;
    let keybindingTpl = `
        <div class="transaction-panel">${shortcutstInfo}
            <span title="Close this dialog (esc)" class="dialog-close dialog-close-default" data-target="#ab-dialog"><i class="fas fa-window-close"></i></span>
        </div>`;
    dialog.innerHTML = keybindingTpl;
    dialog.showModal();
}

function showAbout() {
    let dialog = document.getElementById('ab-dialog');
    if (dialog.hasAttribute('open')) dialog.close();
    let infoContent = document.querySelector('.about-main').innerHTML;
    let info = `
        <div class="transaction-panel">
            ${infoContent}
            <span title="Close this dialog (esc)" class="dialog-close dialog-close-default" data-target="#ab-dialog"><i class="fas fa-window-close"></i></span>
        </div>`;
    dialog.innerHTML = info;
    dialog.showModal();

}

function switchTab() {
    if (WALLET_OPEN_IN_PROGRESS) {
        wsutil.showToast('Opening wallet in progress, please wait...');
        return;
    }
    let isServiceReady = wsession.get('serviceReady') || false;
    let activeTab = document.querySelector('.btn-active');
    let nextTab = activeTab.nextElementSibling || firstTab;
    let nextSection = nextTab.dataset.section.trim();
    let skippedSections = [];
    if (!isServiceReady) {
        skippedSections = ['section-send', 'section-transactions'];
        if (nextSection === 'section-overview') nextSection = 'section-welcome';
    } else if (wsession.get('fusionProgress')) {
        skippedSections = ['section-send'];
    }

    while (skippedSections.indexOf(nextSection) >= 0) {
        nextTab = nextTab.nextElementSibling;
        nextSection = nextTab.dataset.section.trim();
    }
    changeSection(nextSection);
}

// section switcher
function changeSection(sectionId, targetRedir) {
    wsutil.showToast('');

    if (WALLET_OPEN_IN_PROGRESS) {
        wsutil.showToast('Opening wallet in progress, please wait...');
        return;
    }

    targetRedir = targetRedir === true ? true : false;
    let targetSection = sectionId.trim();

    let isSynced = wsession.get('synchronized') || false;
    let isServiceReady = wsession.get('serviceReady') || false;
    let needServiceReady = ['section-transactions', 'section-send', 'section-overview'];
    let needServiceStopped = 'section-welcome';
    let needSynced = ['section-send'];

    let origTarget = targetSection;
    let finalTarget = targetSection;
    let toastMsg = '';


    if (needSynced.includes(targetSection) && wsession.get('fusionProgress')) {
        // fusion in progress, return early
        wsutil.showToast('Wallet optimization in progress, please wait');
        return;
    }

    if (needServiceReady.includes(targetSection) && !isServiceReady) {
        // no access to wallet, send, tx when no wallet opened
        finalTarget = 'section-welcome';
        let notoast = finalTarget.concat(['section-overview']);
        if (!notoast.includes(origTarget)) {
            toastMsg = "Please create/open your wallet!";
        }
    } else if (needSynced.includes(targetSection) && !isSynced) {
        // need synced, return early
        wsutil.showToast("Please wait until the syncing completes!");
        return;
    } else if (needServiceStopped.includes(targetSection) && isServiceReady) {
        finalTarget = 'section-overview';
    } else {
        finalTarget = targetSection;
        toastMsg = '';
    }

    let section = document.getElementById(finalTarget);
    if (section.classList.contains('is-shown')) {
        if (toastMsg.length && !targetRedir) wsutil.showToast(toastMsg);
        return;
    }

    // reset quick filters
    if (finalTarget === 'section-transactions' && window.TXOPTSAPI) {
        window.TXOPTSAPI.api.setQuickFilter('');
    }
    if (finalTarget === 'section-addressbook' && window.ABOPTSAPI) {
        window.ABOPTSAPI.api.setQuickFilter('');
    }

    // navbar active section indicator, only for main section
    let finalButtonTarget = (finalTarget === 'section-welcome' ? 'section-overview' : finalTarget);
    let newActiveNavbarButton = document.querySelector(`.navbar button[data-section="${finalButtonTarget}"]`);
    if (newActiveNavbarButton) {
        const activeButton = document.querySelector(`.btn-active`);
        if (activeButton) activeButton.classList.remove('btn-active');
        if (newActiveNavbarButton) newActiveNavbarButton.classList.add('btn-active');
    }

    // re-init node selection
    if (finalTarget === 'section-overview-load' && walletOpenSelectBox.dataset.loading === "0") {
        initNodeSelection(settings.get('node_address'));
    }

    // toggle section
    formMessageReset();
    const activeSection = document.querySelector('.is-shown');
    if (activeSection) activeSection.classList.remove('is-shown');
    section.classList.add('is-shown');
    section.dispatchEvent(new Event('click')); // make it focusable

    // show msg when needed
    if (toastMsg.length && !targetRedir) wsutil.showToast(toastMsg);
    // notify section was changed
    let currentButton = document.querySelector(`button[data-section="${finalButtonTarget}"]`);
    if (currentButton) {
        wsmanager.notifyUpdate({
            type: 'sectionChanged',
            data: currentButton.getAttribute('id')
        });
    }
}

function initNodeSelection(nodeAddr) {
    let forceNew = nodeAddr ? true : false;
    if (forceNew) settings.set('node_address', nodeAddr);
    walletOpenInputNode.dataset.updating = 0;
    // selected node
    let selected = settings.get('node_address');
    // custom node list
    let customNodes = settings.get('pubnodes_custom', []);
    // nodes completed fee info check
    let testedNodes = settings.get('pubnodes_tested', []);
    // remove node update progress, replace current list
    walletOpenInputNode.removeAttribute('disabled');
    walletOpenSelectBox.dataset.loading = "0";
    walletOpenInputNode.options.length = 0;
    let fallback = false;
    let timeoutStr = 'timeout';
    let onlines = testedNodes.filter((v) => v.label.indexOf(timeoutStr) < 0);
    let offlines = [];
    if (!settings.get('pubnodes_exclude_offline', false)) {
        offlines = testedNodes.filter((v) => v.label.indexOf(timeoutStr) >= 0);
    }

    let pubnodes_fallbacks = config.remoteNodeListFallback;
    // shuffle nodes
    if (onlines.length) {
        let rndMethod = wsutil.arrShuffle([0, 1]);
        if (pubnodes_fallbacks.length && config.remoteNodeListFiltered)  {
            let fallbackMerge = [];
            pubnodes_fallbacks.forEach(n => {
                if(!onlines.find(x => x.host === n)) {
                    fallbackMerge.push({ host: n, label: `${n}|FREE` });
                }
            });
            onlines = onlines.concat(fallbackMerge);
        }
        onlines = wsutil.arrShuffle(onlines, rndMethod);
    } else {
        if (pubnodes_fallbacks.length) {
            customNodes = pubnodes_fallbacks;
        } else {
            customNodes = customNodes.concat(settings.get('pubnodes_data', []));
        }
        fallback = true;
    }

    // for visual selector
    let fakeSelect = document.querySelector('#fakeNodeOptions > ul');
    // reset list
    fakeSelect.innerHTML = '';
    // default value
    let selectedLabel = '';

    if (customNodes.length) {
        customNodes.forEach(node => {
            // actual list items
            let opt = document.createElement('option');
            opt.text = `${node} | Custom Node`;
            opt.value = node;
            // list items display
            let fakeOpt = document.createElement('li');
            fakeOpt.setAttribute('class', 'fake-options');
            fakeOpt.dataset.value = node;
            if (!fallback) {
                fakeOpt.innerHTML = `<span class="node-address">${node}</span> <span class="node-info">(Custom Node)</span>`;
            } else {
                fakeOpt.innerHTML = `<span class="node-address">${node}</span> <span class="node-info">(Fee: N/A)</span>`;
            }

            if (node === selected) {
                opt.setAttribute('selected', true);
                fakeOpt.classList.add('selected');
                selectedLabel = fakeOpt.innerHTML;
            }
            walletOpenInputNode.add(opt, null);
            fakeSelect.appendChild(fakeOpt);
        });
    }

    // merge back
    let remoteNodes = onlines.concat(offlines);
    if (remoteNodes.length) {
        remoteNodes.forEach(node => {
            let all_labels = node.label.split('|');
            if (all_labels.length === 2) {
                let opt = document.createElement('option');
                opt.text = node.label;
                opt.value = node.host;

                let fakeOpt = document.createElement('li');
                fakeOpt.setAttribute('class', 'fake-options');
                fakeOpt.dataset.value = node.host;
                fakeOpt.innerHTML = `<span class="node-address">${all_labels[0].trim()}</span> <span class="node-info">(${all_labels[1].trim()})</span>`;

                if (node.host === selected) {
                    opt.setAttribute('selected', true);
                    fakeOpt.classList.add('selected');
                    selectedLabel = fakeOpt.innerHTML;
                }

                walletOpenInputNode.add(opt, null);
                fakeSelect.appendChild(fakeOpt);
            }
        });
    }

    if (!selectedLabel.length) {
        if (remoteNodes.length) {
            selected = remoteNodes[0];
            let opt = walletOpenInputNode.querySelector('option[value="' + selected.host + '"]');
            opt.setAttribute('selected', true);
            walletOpenInputNode.value = selected.host;
            let all_labels = selected.label.split('|');
            selectedLabel = `<span class="node-address">${all_labels[0].trim()}</span> <span class="node-info">(${all_labels[1].trim()})</span>`;
        }
    }
    walletOpenNodeLabel.innerHTML = selectedLabel;

    var event = new Event('change');
    walletOpenInputNode.dispatchEvent(event);

    customNodes = null;
    testedNodes = null;
}

// initial settings value or updater
function initSettingVal(values) {
    values = values || null;
    if (values) {
        // save new settings
        settings.set('service_bin', values.service_bin);
        settings.set('node_address', values.node_address);
        settings.set('tray_minimize', values.tray_minimize);
        settings.set('tray_close', values.tray_close);
        settings.set('service_timeout', values.service_timeout);
        settings.set('pubnodes_exclude_offline', values.pubnodes_exclude_offline);
    }
    settingsInputServiceBin.value = settings.get('service_bin');
    settingsInputMinToTray.checked = settings.get('tray_minimize');
    settingsInputCloseToTray.checked = settings.get('tray_close');
    settingsInputExcludeOfflineNodes.checked = settings.get('pubnodes_exclude_offline');

    // if custom node, save it
    let mynode = settings.get('node_address');
    let pnodes = settings.get('pubnodes_data');
    if (!settings.has('pubnodes_custom')) settings.set('pubnodes_custom', []);
    let cnodes = settings.get('pubnodes_custom');
    if (pnodes.indexOf(mynode) === -1 && cnodes.indexOf(mynode) === -1) {
        cnodes.push(mynode);
        settings.set('pubnodes_custom', cnodes);
    }
}

// generic form message reset
function formMessageReset() {
    if (!genericFormMessage.length) return;
    for (var i = 0; i < genericFormMessage.length; i++) {
        genericFormMessage[i].classList.add('hidden');
        wsutil.clearChild(genericFormMessage[i]);
    }
}

function formMessageSet(target, status, txt) {
    // clear all msg
    formMessageReset();
    let the_target = `${target}-${status}`;
    let the_el = null;
    try {
        the_el = document.querySelector('.form-ew[id$="' + the_target + '"]');
    } catch (e) { }

    if (the_el) {
        the_el.classList.remove('hidden');
        wsutil.innerHTML(the_el, txt);
    }
}

// utility: blank tx filler
function setTxFiller(show) {
    show = show || false;
    let fillerRow = document.getElementById('txfiller');
    let txRow = document.getElementById('transaction-lists');

    if (!show && fillerRow) {
        fillerRow.classList.add('hidden');
        txRow.classList.remove('hidden');
    } else {
        txRow.classList.add('hidden');
        fillerRow.classList.remove('hidden');
    }
}

// display initial page, settings page on first run, else overview page
function showInitialPage() {
    // other initiations here
    formMessageReset();
    initSettingVal(); // initial settings value
    changeSection('section-welcome');
    settings.set('firstRun', 0);
    let versionInfo = document.getElementById('walletShellVersion');
    if (versionInfo) versionInfo.innerHTML = WS_VERSION;
    let tsVersionInfo = document.getElementById('turtleServiceVersion');
    if (tsVersionInfo) tsVersionInfo.innerHTML = config.walletServiceBinaryVersion;
}

// settings page handlers
function handleSettings() {
    settingsButtonSave.addEventListener('click', function () {
        formMessageReset();
        let serviceBinValue = settingsInputServiceBin.value ? settingsInputServiceBin.value.trim() : '';
        let timeoutValue = settingsInputTimeout.value ? parseInt(settingsInputTimeout.value, 10) : 30;

        if (!serviceBinValue.length) {
            formMessageSet('settings', 'error', `Settings can't be saved, please enter correct values`);
            return false;
        }

        if (!wsutil.isRegularFileAndWritable(serviceBinValue)) {
            formMessageSet('settings', 'error', `Unable to find ${config.walletServiceBinaryFilename}, please enter the correct path`);
            return false;
        }

        if (timeoutValue < 30 || timeoutValue > 120) {
            formMessageSet('settings', 'error', `Timeout value must be between 30 and 120`);
            return false;
        }

        let vals = {
            service_bin: serviceBinValue,
            node_address: settings.get('node_address'),
            service_timeout: timeoutValue,
            tray_minimize: settingsInputMinToTray.checked,
            tray_close: settingsInputCloseToTray.checked,
            pubnodes_exclude_offline: settingsInputExcludeOfflineNodes.checked
        };

        initSettingVal(vals);

        formMessageReset();
        let goTo = wsession.get('loadedWalletAddress').length ? 'section-overview' : 'section-welcome';
        changeSection(goTo, true);
        wsutil.showToast('Settings have been updated.', 8000);
    });
}

// address book completions
function initAddressCompletion(data) {
    var addresses = [];
    if (data) {
        addresses = Object.entries(data).map(([k, v]) => `${v.name}###${v.address}###${v.paymentId ? v.paymentId : ''}`);
    }

    try {
        if (window.COMPLETION_ADDRBOOK) window.COMPLETION_ADDRBOOK.destroy();
    } catch (e) {
        console.log(e);
    }

    window.COMPLETION_ADDRBOOK = new autoComplete({
        selector: 'input[id="input-send-address"]',
        minChars: 1,
        cache: false,
        source: function (term, suggest) {
            term = term.toLowerCase();
            var choices = addresses;
            var matches = [];
            for (var i = 0; i < choices.length; i++)
                if (~choices[i].toLowerCase().indexOf(term)) matches.push(choices[i]);
            suggest(matches);
        },
        renderItem: function (item, search) {
            search = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            var re = new RegExp("(" + search.split(' ').join('|') + ")", "gi");
            var spl = item.split("###");
            var wname = spl[0];
            var waddr = spl[1];
            var wpayid = spl[2];
            return `<div class="autocomplete-suggestion" data-paymentid="${wpayid}" data-val="${waddr}">${wname.replace(re, "<b>$1</b>")}<br><span class="autocomplete-wallet-addr">${waddr.replace(re, "<b>$1</b>")}<br>Payment ID: ${(wpayid ? wpayid.replace(re, "<b>$1</b>") : 'N/A')}</span></div>`;
        },
        onSelect: function (e, term, item) {
            document.getElementById('input-send-payid').value = item.getAttribute('data-paymentid');
        }
    });
}
function updateAddressBookSelector(selected) {
    selected = selected || null;
    if (!selected) {
        let ab = wsession.get('addressBook');
        if (ab) selected = ab.path;
    }
    if (!selected || selected.endsWith('SharedAddressBook.json')) {
        selected = 'default';
    } else {
        selected = path.basename(selected);
    }

    let knownAb = settings.get('address_books', []);
    // update addressbook selector
    addressBookSelector.options.length = 0;
    let abopts = document.createElement('option');
    abopts.value = 'default';
    abopts.text = 'Default/builtin Address Book';
    abopts.setAttribute('selected', 'selected');
    addressBookSelector.add(abopts, null);
    knownAb.forEach((v) => {
        let abpath = path.join(ADDRESS_BOOK_DIR, v.filename);
        if (wsutil.isFileExist(abpath)) {
            let opt = document.createElement('option');
            opt.text = v.name;
            opt.value = v.filename;
            opt.dataset.name = v.name;
            if (v.filename === selected) {
                abopts.removeAttribute('selected');
                opt.setAttribute('selected', 'selected');
            }
            addressBookSelector.add(opt, null);
        }
    });
    addressBookSelector.value = selected;
}

function handleAddressBook() {
    function migrateOldFormat(newBook) {
        let oldAddressBook = path.join(remote.app.getPath('userData'), 'AddressBook.json');
        fs.access(oldAddressBook, fs.constants.F_OK | fs.constants.W_OK, (err) => {
            if (err) {
                return newBook;
            } else {
                const oldBook = new Store({
                    name: 'AddressBook',
                    encryptionKey: config.addressBookObfuscateEntries ? config.addressBookObfuscationKey : null
                });
                let addressBookData = newBook.data;
                Object.keys(oldBook.get()).forEach((hash) => {
                    let item = oldBook.get(hash);
                    let entryHash = wsutil.fnvhash(item.address + item.paymentId);
                    if (!addressBookData.hasOwnProperty(entryHash)) {
                        let newAddress = {
                            name: item.name,
                            address: item.address,
                            paymentId: item.paymentId,
                            qrCode: wsutil.genQrDataUrl(item.address)
                        };
                        newBook.data[entryHash] = newAddress;
                    }
                });
                setTimeout(() => {
                    addressBook.save(newBook);
                    fs.rename(oldAddressBook, oldAddressBook + '.deprecated.txt', (err) => {
                        if (err) console.error('Failed to rename old addressbook');
                    });
                }, 500);
                return newBook;
            }
        });
    }

    // address book list
    function renderList(data) {
        if (!window.ABGRID) {
            let columnDefs = [
                { headerName: 'Key', field: 'key', hide: true },
                {
                    headerName: 'Name',
                    field: 'value.name',
                    width: 240,
                    suppressSizeToFit: true,
                    autoHeight: true,
                    checkboxSelection: true,
                    headerCheckboxSelection: true,
                    headerCheckboxSelectionFilteredOnly: true,
                    sortingOrder: ['asc', 'desc']
                },
                { headerName: "Wallet Address", field: "value.address", sortingOrder: ['asc', 'desc'] },
                { headerName: "Payment ID", field: "value.paymentId", sortingOrder: ['asc', 'desc'] }
            ];

            let gridOptions = {
                columnDefs: columnDefs,
                rowData: data,
                pagination: false,
                paginationPageSize: 20,
                cacheQuickFilter: true,
                enableSorting: true,
                suppressRowClickSelection: true,
                rowClass: 'ab-item',
                rowSelection: 'multiple',
                onSelectionChanged: function (e) {
                    let rowCount = e.api.getSelectedNodes().length;
                    let rowCountEl = document.querySelector('#abRowCount');

                    if (rowCount <= 0) {
                        rowCountEl.textContent = 'No item selected';//`Total entries: ${data.length}`;
                        rowCountEl.classList.remove('ab-delselected');
                    } else {
                        rowCountEl.textContent = `Delete ${rowCount} selected item(s)`;
                        rowCountEl.classList.add('ab-delselected');
                    }
                },
                onRowClicked: renderItem
            };
            let abGrid = document.getElementById('abGrid');
            window.ABGRID = new AgGrid.Grid(abGrid, gridOptions);
            window.ABOPTSAPI = gridOptions;

            gridOptions.onGridReady = function () {
                abGrid.style.width = "100%";
                let sp = document.createElement('span');
                sp.setAttribute('id', 'abRowCount');
                sp.textContent = 'No item selected';
                let agPanel = document.querySelector('#abGrid .ag-paging-panel');
                agPanel.prepend(sp);

                setTimeout(function () {
                    window.ABOPTSAPI.api.doLayout();
                    window.ABOPTSAPI.api.sizeColumnsToFit();
                }, 100);
            };

            window.addEventListener('resize', () => {
                if (window.ABOPTSAPI) {
                    window.ABOPTSAPI.api.sizeColumnsToFit();
                }
            });

            let abfilter = document.getElementById('ab-search');
            abfilter.addEventListener('input', function () {
                if (window.ABOPTSAPI) {
                    window.ABOPTSAPI.api.setQuickFilter(this.value);
                }
            });
        } else {
            window.ABOPTSAPI.api.setRowData(data);
            window.ABOPTSAPI.api.deselectAll();
            window.ABOPTSAPI.api.resetQuickFilter();
            window.ABOPTSAPI.api.sizeColumnsToFit();
        }
    }

    // display address book item
    function renderItem(e) {
        let data = e.data;
        let dialog = document.getElementById('ab-dialog');
        if (dialog.hasAttribute('open')) dialog.close();

        let sendTrtl = '';
        let myaddress = wsession.get('loadedWalletAddress');
        let isSynced = wsession.get('synchronized') || false;
        if (myaddress && isSynced) {
            sendTrtl = `<button data-addressid="${data.key}" type="button" class="form-bt button-green ab-send" id="button-addressbook-panel-send">Send ${config.assetTicker}</button>`;
        }

        let tpl = `
        <div class="div-transactions-panel">
                 <h4>Address Detail</h4>
                 <div class="addressBookDetail">
                     <div class="addressBookDetail-qr">
                         <img src="${data.value.qrCode}" />
                     </div>
                     <div class="addressBookDetail-data">
                         <dl>
                             <dt>Name:</dt>
                             <dd data-cplabel="Wallet Name" class="tctcl" title="click to copy">${data.value.name}</dd>
                             <dt>Wallet Address:</dt>
                             <dd data-cplabel="Wallet address" class="tctcl" title="click to copy">${data.value.address}</dd>
                             <dt>Payment Id:</dt>
                             <dd  data-cplabel="Payment ID" class="${data.value.paymentId ? 'tctcl' : 'noclass'}" title="${data.value.paymentId ? 'click to copy' : 'n/a'}">${data.value.paymentId ? data.value.paymentId : '-'}</dd>
                         </dl>
                     </div>
                 </div>
                <div class="div-panel-buttons">
                    ${sendTrtl}
                    <button data-addressid="${data.key}" type="button" class="form-bt button-green ab-edit" id="button-addressbook-panel-edit">Edit</button>
                    <button data-addressid="${data.key}" type="button" class="form-bt button-red ab-delete" id="button-addressbook-panel-delete">Delete</button>
                </div>
                <span title="Close this dialog (esc)" class="dialog-close dialog-close-default" data-target="#ab-dialog"><i class="fas fa-window-close"></i></span>
            </div>`;

        wsutil.innerHTML(dialog, tpl);
        dialog = document.getElementById('ab-dialog');
        dialog.showModal();
    }

    // disable payment id input for non standard adress
    function setAbPaymentIdState(addr) {
        if (addr.length > config.addressLength) {
            addressBookInputPaymentId.value = '';
            addressBookInputPaymentId.setAttribute('disabled', true);
        } else {
            addressBookInputPaymentId.removeAttribute('disabled');
        }
    }

    addressBookInputWallet.addEventListener('change', (event) => {
        let val = event.target.value || '';
        setAbPaymentIdState(val);
    });

    addressBookInputWallet.addEventListener('keyup', (event) => {
        let val = event.target.value || '';
        setAbPaymentIdState(val);
    });

    // add new address book file
    addressBookButtonAdd.addEventListener('click', () => {
        let dialog = document.getElementById('ab-dialog');
        if (dialog.hasAttribute('open')) dialog.close();
        let tpl = `
            <div class="div-transactions-panel">
                <h4>Create New Address Book</h4>
                <p class="form-help">Fill this form to create a new, password protected address book</p>
                <div class="input-wrap">
                    <label>Address Book Name:</label>
                    <input id="pAddressbookName" type="text" required="required" class="text-block" placeholder="Required, any label to identify this address book, example: My Contact" />
                </div>
                <div class="input-wrap">
                    <label>Password:</label>
                    <input id="pAddressbookPass" type="password" required="required" class="text-block" placeholder="Required, password to open this address book" />
                    <button data-pf="pAddressbookPass" tabindex="-1" class="togpass notabindex"><i class="fas fa-eye"></i></button>
                </div>
                <div class="input-wrap">
                    <span class="form-ew form-msg text-spaced-error hidden" id="text-paddressbook-error"></span>
                </div>
                <div class="div-panel-buttons">
                    <button id="createNewAddressBook" type="button" class="button-green">Create & activate</button>
                </div>
                <span title="Close this dialog (esc)" class="dialog-close dialog-close-default" data-target="#ab-dialog"><i class="fas fa-window-close"></i></span>
            </div>             
        `;

        wsutil.innerHTML(dialog, tpl);
        dialog = document.getElementById('ab-dialog');
        dialog.showModal();
    });

    wsutil.liveEvent('#button-addressbook-panel-send', 'click', (e) => {
        let origHash = e.target.dataset.addressid;
        let entry = wsession.get('addressBook').data[origHash] || null;
        if (!entry) {
            wsutil.showToast('Invalid address book entry');
        }
        changeSection('section-send');
        sendInputAddress.value = entry.address;
        if (entry.paymentId.length) {
            sendInputPaymentId.value = entry.paymentId;
        }
        // close dialog
        let axdialog = document.getElementById('ab-dialog');
        axdialog.close();
        wsutil.clearChild(axdialog);
    });

    wsutil.liveEvent('#createNewAddressBook', 'click', () => {
        let addrBookNameEl = document.getElementById('pAddressbookName');
        let addrBookPassEl = document.getElementById('pAddressbookPass');
        let name = addrBookNameEl.value.trim() || null;
        let pass = addrBookPassEl.value.trim() || null;
        if (!name || !pass) {
            formMessageReset();
            formMessageSet('paddressbook', 'error', "Address book name & password can not be left blank!");
            return;
        }

        let addrFilename = `ab-${wsutil.fnvhash(name + pass)}.json`;
        let addrPath = path.join(ADDRESS_BOOK_DIR, addrFilename);
        if (wsutil.isFileExist(addrPath)) {
            formMessageReset();
            formMessageSet('paddressbook', 'error', "Same filename exists, please use different filename!");
            return;
        }
        let knownAb = settings.get('address_books', []);
        knownAb.push({
            name: name,
            filename: addrFilename,
        });
        settings.set('address_books', knownAb);

        // finally create & load new adddressbook
        loadAddressBook({ path: addrPath, name: name, pass: pass });
        // close dialog
        let axdialog = document.getElementById('ab-dialog');
        axdialog.close();
        wsutil.clearChild(axdialog);
        // display message
        wsutil.showToast('New address book have been created');
    });

    // switch address book file
    addressBookSelector.addEventListener('change', () => {
        let filename = addressBookSelector.value;
        let name = addressBookSelector.options[addressBookSelector.selectedIndex].text;

        if (filename !== 'default') {
            let dialog = document.getElementById('ab-dialog');
            if (dialog.hasAttribute('open')) dialog.close();
            let tpl = `
                <div class="div-transactions-panel">
                    <h4>Enter password for to open ${name}</h4>
                    <div class="input-wrap">
                        <label>Password:</label>
                        <input id="pAddressbookOpenName" type="hidden" value="${name}" />
                        <input id="pAddressbookOpenFilename" type="hidden" value="${filename}" />
                        <input id="pAddressbookOpenPass" type="password" required="required" class="text-block" placeholder="Required, password to open this address book" />
                        <button data-pf="pAddressbookOpenPass" tabindex="-1" class="togpass notabindex"><i class="fas fa-eye"></i></button>
                    </div>
                    <div class="input-wrap">
                        <span class="form-ew form-msg text-spaced-error hidden" id="text-paddressbookopen-error"></span>
                    </div>
                    <div class="div-panel-buttons">
                        <button id="loadAddressBook" type="button" class="button-green">Open</button>
                    </div>
                    <span id="addressBookSwitcherClose" title="Close this dialog (esc)" class="dialog-close dialog-close-defaultx" data-target="#ab-dialog"><i class="fas fa-window-close"></i></span>
                </div>             
            `;
            wsutil.innerHTML(dialog, tpl);
            dialog = document.getElementById('ab-dialog');
            dialog.showModal();
        } else {
            loadAddressBook({ name: 'default' });
            if (window.addressBookInitialize) {
                wsutil.showToast(`Address book switched to: Default/builtin`);
            }
        }
    });

    wsutil.liveEvent('#addressBookSwitcherClose', 'click', () => {
        let dialog = document.getElementById('ab-dialog');
        if (dialog.hasAttribute('open')) dialog.close();
        updateAddressBookSelector();
    });

    wsutil.liveEvent('#loadAddressBook', 'click', () => {
        formMessageReset();
        let name = document.getElementById('pAddressbookOpenName').value || null;
        let pass = document.getElementById('pAddressbookOpenPass').value || null;
        let filename = document.getElementById('pAddressbookOpenFilename').value || null;
        let abpath = path.join(ADDRESS_BOOK_DIR, filename);


        if (!pass || !name || !filename) {
            formMessageSet('paddressbookopen', 'error', "Please enter your password!");
            return;
        }
        // try to load
        loadAddressBook({ name: name, pass: pass, path: abpath });
        setTimeout(() => {
            let err = wsession.get('addressBookErr');
            if (false !== err) {
                formMessageSet('paddressbookopen', 'error', err);
                // fallback to builtin
                loadAddressBook({ name: 'default' });
                return;
            } else {
                // close dialog
                let axdialog = document.getElementById('ab-dialog');
                axdialog.close();
                wsutil.clearChild(axdialog);
                // show msg
                if (window.addressBookInitialize) {
                    wsutil.showToast(`Address book switched to: ${name}`);
                }
            }
        }, 100);
    });

    // insert address book entry
    addressBookButtonSave.addEventListener('click', () => {
        formMessageReset();
        let nameValue = addressBookInputName.value ? addressBookInputName.value.trim() : '';
        let addressValue = addressBookInputWallet.value ? addressBookInputWallet.value.trim() : '';
        let paymentIdValue = addressBookInputPaymentId.value ? addressBookInputPaymentId.value.trim() : '';
        let isUpdate = addressBookInputUpdate.value ? addressBookInputUpdate.value : 0;

        if (!nameValue || !addressValue) {
            formMessageSet('addressbook', 'error', "Name and wallet address can not be left empty!");
            return;
        }

        if (!wsutil.validateAddress(addressValue)) {
            formMessageSet('addressbook', 'error', `Invalid ${config.assetName} address`);
            return;
        }

        if (paymentIdValue.length) {
            if (!wsutil.validatePaymentId(paymentIdValue)) {
                formMessageSet('addressbook', 'error', "Invalid Payment ID");
                return;
            }
        }

        if (addressValue.length > config.addressLength) paymentIdValue.value = '';

        let entryName = nameValue.trim();
        let entryAddr = addressValue.trim();
        let entryPaymentId = paymentIdValue.trim();
        let entryHash = wsutil.fnvhash(entryAddr + entryPaymentId);

        let abook = wsession.get('addressBook');
        let addressBookData = abook.data;
        if (addressBookData.hasOwnProperty(entryHash) && !isUpdate) {
            formMessageSet('addressbook', 'error', "This combination of address and payment ID already exist, please enter new address or different payment id.");
            return;
        }

        let newAddress = {
            name: entryName,
            address: entryAddr,
            paymentId: entryPaymentId,
            qrCode: wsutil.genQrDataUrl(entryAddr)
        };
        abook.data[entryHash] = newAddress;

        // update but address+payid is new
        let oldHash = addressBookInputName.dataset.oldhash || '';
        let isNew = (oldHash.length && oldHash !== entryHash);

        if (isUpdate && isNew) {
            delete abook.data[oldHash];
        }
        wsession.set('addressBook', abook);
        let rowData = Object.entries(abook.data).map(([key, value]) => ({ key, value }));
        window.ABOPTSAPI.api.setRowData(rowData);
        window.ABOPTSAPI.api.deselectAll();
        window.ABOPTSAPI.api.resetQuickFilter();
        window.ABOPTSAPI.api.sizeColumnsToFit();
        wsutil.showToast('Address book entry have been saved.');
        changeSection('section-addressbook');

        // reset
        addressBookInputName.value = '';
        addressBookInputName.dataset.oldhash = '';
        addressBookInputWallet.value = '';
        addressBookInputPaymentId.value = '';
        addressBookInputUpdate.value = 0;
        formMessageReset();

        setTimeout(() => {
            addressBook.save(abook);
            initAddressCompletion(abook.data);
        }, 500);
    });

    // edit entry
    wsutil.liveEvent('.ab-edit', 'click', function (e) {
        let origHash = e.target.dataset.addressid;
        let entry = wsession.get('addressBook').data[origHash] || null;
        if (!entry) {
            wsutil.showToast('Invalid address book entry');
        } else {
            const nameField = document.getElementById('input-addressbook-name');
            const walletField = document.getElementById('input-addressbook-wallet');
            const payidField = document.getElementById('input-addressbook-paymentid');
            const updateField = document.getElementById('input-addressbook-update');
            nameField.value = entry.name;
            nameField.dataset.oldhash = origHash;
            walletField.value = entry.address;
            payidField.value = entry.paymentId;
            updateField.value = 1;
        }
        changeSection('section-addressbook-add');
        let axdialog = document.getElementById('ab-dialog');
        axdialog.close();
        wsutil.clearChild(axdialog);
    });

    // delete entry
    wsutil.liveEvent('.ab-delete', 'click', function (e) {
        if (!confirm('Are you sure?')) return;

        let et = e.target.dataset.addressid;
        let addressBookData = wsession.get('addressBook');
        if (!addressBookData.data) {
            wsutil.showToast('Invalid address book data');
            return;
        }

        let entry = addressBookData.data[et] || null;
        if (!entry) {
            wsutil.showToast('Invalid address book entry');
            return;
        }

        delete addressBookData.data[et];
        wsession.set('addressBook', addressBookData);
        let rowData = Object.entries(addressBookData.data).map(([key, value]) => ({ key, value }));
        window.ABOPTSAPI.api.setRowData(rowData);
        let axdialog = document.getElementById('ab-dialog');
        axdialog.close();
        wsutil.clearChild(axdialog);
        wsutil.showToast('Address book entry have been deleted');
        setTimeout(() => {
            addressBook.save(addressBookData);
            initAddressCompletion(addressBookData.data);
        }, 500);
    });

    // delete selected
    wsutil.liveEvent('.ab-delselected', 'click', function () {
        if (!confirm('Are you sure?')) return;
        let nodes = window.ABOPTSAPI.api.getSelectedNodes();
        if (nodes.length) {
            let addressBookData = wsession.get('addressBook');
            if (!addressBookData.data) {
                wsutil.showToast('Invalid address book data');
                return;
            }

            nodes.forEach((e) => {
                let entry = addressBookData.data[e.data.key] || null;
                if (entry) {
                    delete addressBookData.data[e.data.key];
                }
            });
            wsession.set('addressBook', addressBookData);
            let rowData = Object.entries(addressBookData.data).map(([key, value]) => ({ key, value }));
            window.ABOPTSAPI.api.setRowData(rowData);
            window.ABOPTSAPI.api.deselectAll();
            wsutil.showToast(`Address book item(s) have been deleted`);
            setTimeout(() => {
                addressBook.save(addressBookData);
                initAddressCompletion(addressBookData.data);
            }, 800);
        }
    });

    function loadAddressBook(params) {
        params = params || false;
        wsession.set('addressBookErr', false);
        if (params) {
            // new address book, reset ab object + session
            wsession.set('addressBook', null);
            if (params.name === 'default') {
                addressBook = new WalletShellAddressbook(ADDRESS_BOOK_DEFAULT_PATH);
            } else {
                addressBook = new WalletShellAddressbook(params.path, params.name, params.pass);
            }
        }

        let currentAddressBook = wsession.get('addressBook');
        let abdata = [];
        if (!currentAddressBook) {
            // new session, load from file
            try {
                addressBook.load()
                    .then((addressData) => {
                        if (!window.addressBookMigrated) {
                            addressData = migrateOldFormat(addressData);
                            window.addressBookMigrated = true;
                        }
                        wsession.set('addressBook', addressData);
                        updateAddressBookSelector(addressData.path);
                        abdata = addressData.data;
                        let ibdata = Object.entries(abdata).map(([key, value]) => ({ key, value }));
                        renderList(ibdata);
                        setTimeout(() => {
                            initAddressCompletion(abdata);
                        }, 800);
                        wsession.set('addressBookErr', false);
                    }).catch((e) => {
                        // todo handle error
                        wsession.set('addressBookErr', e.message);
                    });
            } catch (e) {
                // todo handle error
                wsession.set('addressBookErr', e.message);
            }
        } else {
            // address book already opened
            abdata = currentAddressBook.data;
            let ibdata = Object.entries(abdata).map(([key, value]) => ({ key, value }));
            updateAddressBookSelector(abdata.path);
            renderList(ibdata);
            setTimeout(() => {
                initAddressCompletion(abdata);
            }, 800);
            wsession.set('addressBookErr', false);
        }
    }
    // startup, load default address book
    loadAddressBook();
    // chromium select lag workaround
    setTimeout(() => {
        let event = new MouseEvent('change', {
            view: window,
            bubbles: false,
            cancelable: true
        });
        addressBookSelector.dispatchEvent(event);
        window.addressBookInitialize = true;
    }, 2000);
}

function handleWalletOpen() {
    if (settings.has('recentWallet')) {
        walletOpenInputPath.value = settings.get('recentWallet');
    }

    function setOpenButtonsState(isInProgress) {
        isInProgress = isInProgress ? 1 : 0;
        let extras = document.querySelectorAll('.wallet-open-extra');
        if (isInProgress) {
            walletOpenButtons.classList.add('hidden');
            extras.forEach((x) => { x.classList.add('hidden'); });
        } else {
            walletOpenButtons.classList.remove('hidden');
            extras.forEach((x) => { x.classList.remove('hidden'); });
        }
    }

    function addCustomNodeForm() {
        let dialog = document.getElementById('ab-dialog');
        if (dialog.hasAttribute('open')) dialog.close();
        let customNodes = settings.get('pubnodes_custom');
        let cnode = '<ul class="cnodes">';
        customNodes.forEach(node => {
            cnode += `<li>${node} (<a href="#" title="remove this node" class="cnode-item" data-value="${node}">REMOVE</a>)</li>`;
        });
        cnode += '</ul>';

        let iaform = `
            <div class="transaction-panel">
                <h4>Custom daemon/node address:</h4>
                <div class="splitted-area splitted-2">
                    <div class="splitted-content first">
                        <p>Your Custom Nodes:</p>
                        ${cnode}
                    </div>
                    <div class="splitted-content last">
                        <div class="input-wrap f-right">
                            <label>Add New Custom Node</label>
                            <input type="text" id="customNodeAddress" placeholder="my.example.com:${config.daemonDefaultRpcPort}" class="text-block" />
                            <span class="form-help">Required, example: my.example-domain.com:${config.daemonDefaultRpcPort}, 123.123.123.123:${config.daemonDefaultRpcPort}</span>
                        </div>
                        <div class="input-wrap">
                            <span class="form-ew form-msg text-spaced-error hidden" id="text-customnode-error"></span>
                        </div>
                    </div>
                </div>
                <div class="div-panel-buttons">
                    <button id="saveCustomNode" type="button" class="button-green">Save & activate</button>
                </div>
                <span title="Close this dialog (esc)" class="dialog-close dialog-close-default" data-target="#ab-dialog"><i class="fas fa-window-close"></i></span>
            </div>`;
        dialog.innerHTML = iaform;
        dialog.showModal();
    }

    wsutil.liveEvent('.cnode-item', 'click', (e) => {
        e.preventDefault();
        let item = e.target.dataset.value.trim();
        let tbr = e.target.closest('li');
        let customNodes = settings.get('pubnodes_custom', []);
        var index = customNodes.indexOf(item);
        if (index !== -1) customNodes.splice(index, 1);
        settings.set('pubnodes_custom', customNodes);
        tbr.parentNode.removeChild(tbr);
        initNodeSelection();
    });

    wsutil.liveEvent("#saveCustomNode", "click", (e) => {
        e.preventDefault();
        formMessageReset();
        let customNodeAddressInput = document.getElementById('customNodeAddress');
        let nodeAddressVal = customNodeAddressInput.value ? customNodeAddressInput.value.trim() : false;
        if (!nodeAddressVal) {
            formMessageSet('customnode', 'error', 'Invalid node address, accepted format: &lt;domain.tld&gt;:&lt;port_number&gt; or &lt;ip_address&gt;:&lt;port_number&gt;');
            return;
        }
        let nodeAddress = nodeAddressVal.split(":");
        if (nodeAddress.length !== 2) {
            formMessageSet('customnode', 'error', 'Invalid node address, accepted format: &lt;domain.tld&gt;:&lt;port_number&gt;<br>&lt;ip_address&gt;:&lt;port_number&gt;');
            return;
        }

        let validHost = nodeAddress[0] === 'localhost' ? true : false;
        if (net.isIPv4(nodeAddress[0])) validHost = true;
        if (!validHost) {
            let domRe = new RegExp(/([a-z])([a-z0-9]+\.)*[a-z0-9]+\.[a-z.]+/i);
            if (domRe.test(nodeAddress[0])) validHost = true;
        }
        if (!validHost) {
            formMessageSet('customnode', 'error', 'Invalid node address');
            return false;
        }

        if (parseInt(nodeAddress[1], 10) <= 0) {
            formMessageSet('customnode', 'error', 'Invalid port');
            return false;
        }

        let customNodes = settings.get('pubnodes_custom', []);
        customNodes.push(nodeAddressVal);
        settings.set('pubnodes_custom', customNodes);
        initNodeSelection(nodeAddressVal);
        let dialog = document.getElementById('ab-dialog');
        if (dialog.hasAttribute('open')) dialog.close();
        wsutil.showToast('New custom node have been added');
    });

    walletOpenAddCustomNode.addEventListener('click', (e) => {
        e.preventDefault();
        addCustomNodeForm();
    });

    walletOpenRefreshNodes.addEventListener('click', () => {
        if (!navigator.onLine) {
            wsutil.showToast('Network connectivity problem detected, node list update can not be performed');
            return;
        }

        if (!confirm("Refreshing node list may take a while to complete, are you sure?")) return;
        fetchNodeInfo(true);
    });

    walletOpenButtonOpen.addEventListener('click', () => {
        formMessageReset();

        if (parseInt(walletOpenInputNode.dataset.updating, 10) === 1) {
            wsutil.showToast('Node list update in progress, please wait...');
            return;
        }

        let nodeAddressValue = walletOpenInputNode.value;
        let nodeAddress = nodeAddressValue.split(':');

        let validHost = nodeAddress[0] === 'localhost' ? true : false;
        if (net.isIPv4(nodeAddress[0])) validHost = true;
        if (!validHost) {
            let domRe = new RegExp(/([a-z])([a-z0-9]+\.)*[a-z0-9]+\.[a-z.]+/i);
            if (domRe.test(nodeAddress[0])) validHost = true;
        }
        if (!validHost) {
            formMessageSet('load', 'error', `Invalid daemon/node address!`);
            return false;
        }

        if (parseInt(nodeAddress[1], 10) <= 0) {
            formMessageSet('load', 'error', `Invalid daemon/node port number!`);
            return false;
        }

        if (!navigator.onLine && !nodeAddress[0].startsWith('127') && nodeAddress[0] !== 'localhost') {
            formMessageSet('load', 'error', `Network connectivity problem detected, unable to connect to remote node`);
            return false;
        }

        let settingVals = {
            service_bin: settings.get('service_bin'),
            service_timeout: settings.get('service_timeout'),
            node_address: nodeAddressValue,
            tray_minimize: settings.get('tray_minimize'),
            tray_close: settings.get('tray_close'),
            pubnodes_exclude_offline: settingsInputExcludeOfflineNodes.checked
        };
        initSettingVal(settingVals);

        // actually open wallet
        if (!walletOpenInputPath.value) {
            formMessageSet('load', 'error', "Invalid wallet file path");
            WALLET_OPEN_IN_PROGRESS = false;
            setOpenButtonsState(0);
            return;
        }

        function onError(err) {
            formMessageReset();
            formMessageSet('load', 'error', err);
            WALLET_OPEN_IN_PROGRESS = false;
            setOpenButtonsState(0);
            return false;
        }

        function onSuccess() {
            walletOpenInputPath.value = settings.get('recentWallet');
            overviewWalletAddress.value = wsession.get('loadedWalletAddress');

            wsmanager.getNodeFee();
            WALLET_OPEN_IN_PROGRESS = false;
            changeSection('section-overview');

            setTimeout(() => {
                setOpenButtonsState(0);
            }, 300);
        }

        function onDelay(msg) {
            formMessageSet('load', 'warning', `${msg}<br><progress></progress>`);
        }

        let walletFile = walletOpenInputPath.value;
        let walletPass = walletOpenInputPassword.value;

        fs.access(walletFile, fs.constants.R_OK, (err) => {
            if (err) {
                formMessageSet('load', 'error', "Invalid wallet file path");
                setOpenButtonsState(0);
                WALLET_OPEN_IN_PROGRESS = false;
                return false;
            }

            setOpenButtonsState(1);
            WALLET_OPEN_IN_PROGRESS = true;
            settings.set('recentWallet', walletFile);
            settings.set('recentWalletDir', path.dirname(walletFile));
            formMessageSet('load', 'warning', "Accessing wallet...<br><progress></progress>");
            wsmanager.stopService().then(() => {

                formMessageSet('load', 'warning', "Starting wallet service...<br><progress></progress>");
                setTimeout(() => {
                    formMessageSet('load', 'warning', "Opening wallet, please be patient...<br><progress></progress>");
                    wsmanager.startService(walletFile, walletPass, onError, onSuccess, onDelay);
                }, 800);
            }).catch((err) => {
                console.log(err);
                formMessageSet('load', 'error', "Unable to start service");
                WALLET_OPEN_IN_PROGRESS = false;
                setOpenButtonsState(0);
                return false;
            });
        });
    });

    // node selector
    walletOpenSelectBox.addEventListener('click', () => {
        if (walletOpenSelectBox.dataset.loading === "1") {
            return;
        }

        if (walletOpenSelectOpts.classList.contains("hidden")) {
            walletOpenSelectOpts.classList.remove("hidden");
        } else {
            walletOpenSelectOpts.classList.add("hidden");
        }
    });

    wsutil.liveEvent('.fake-options', 'click', (e) => {
        let sel = e.target.classList.contains('fake-options') ? e.target : e.target.closest('.fake-options');
        let val = sel.dataset.value;
        walletOpenNodeLabel.innerHTML = sel.innerHTML;
        walletOpenInputNode.value = val;
        var event = new Event('change');
        walletOpenInputNode.dispatchEvent(event);
    });

    let mox = document.getElementById('section-overview-load');
    mox.addEventListener('click', function (e) {
        function isChild(obj, parentObj) {
            while (obj !== undefined && obj !== null && obj.tagName.toUpperCase() !== 'BODY') {
                if (obj === parentObj) {
                    return true;
                }
                obj = obj.parentNode;
            }
            return false;
        }
        let eid = e.target.getAttribute('id');
        if (eid === 'fake-selected-node' || eid === 'fake-select') return;
        if (isChild(e.target, walletOpenSelectBox)) return;
        walletOpenSelectOpts.classList.add('hidden');
    });
}

function handleWalletRescan() {
    overviewWalletRescanButton.addEventListener('click', (event) => {
        event.preventDefault();
        let walletOpened = wsession.get('serviceReady') || false;
        if (!walletOpened) return;

        let dialogTpl = `<div class="transaction-panel">
            <h4>Rescan Wallet</h4>
            <p class="form-help">
                Re-scan the blockchain to search transactions belongs to your wallet address.
                Do this if you think there are missing transactions data or if you put wrong scan height value during import.
            </p>
            <div class="input-wrap">
                <label>Starting block height:</label>
                <input type="number" min="0" step="1" class="text-block" 
                        id="rescanScanHeight" value="1" 
                        title="First block index to be scanned"
                        />
            </div>
            <div class="input-wrap">
                <span class="form-ew form-msg text-spaced-error hidden" id="text-rescanheight-error"></span>
            </div>
            <div class="div-panel-buttons">
                <button type="button" class="form-bt button-green" id="button-rescan-start">Start Rescan</button>
            </div>
            <span title="Close this dialog (esc)" class="dialog-close dialog-close-default" data-target="#ab-dialog"><i class="fas fa-window-close"></i></span>
        </div>`;
        let dialog = document.getElementById('ab-dialog');
        if (dialog.hasAttribute('open')) dialog.close();
        dialog.innerHTML = dialogTpl;
        dialog.showModal();
    });

    wsutil.liveEvent('#button-rescan-start', 'click', () => {
        let scanHeightEl = document.getElementById('rescanScanHeight');
        let scanHeight = scanHeightEl.value.length ? parseInt(scanHeightEl.value, 10) : -1;
        formMessageReset();
        if (scanHeight < 0) {
            formMessageSet('rescanheight', 'error', 'Please specify a valid scan height');
            return;
        }
        let confirmMsg = 'Rescanning process may take a long time to complete, are you sure?';
        if (scanHeight === 0) {
            confirmMsg = 'Setting scan height to 0 will fully reset your wallet. Rescanning process may take a long time to complete, are you sure?';
        }
        if (!confirm(confirmMsg)) return;
        wsmanager.rescanWallet(scanHeight).then(() => {
            resetTransactions();
            wsutil.showToast('Rescan OK, your wallet will be re-synchronize');
        }).catch(() => {
            resetTransactions();
            wsutil.showToast('Rescan OK, your wallet will be re-synchronize');
        });
        let d = document.querySelector('dialog[open]');
        if (d) d.close();
    });
}

function handleWalletClose() {
    overviewWalletCloseButton.addEventListener('click', (event) => {
        event.preventDefault();
        if (!confirm('Are you sure want to close your wallet?')) return;

        let dialog = document.getElementById('main-dialog');
        let htmlStr = '<div class="div-save-main" style="text-align: center;padding:1rem;"><i class="fas fa-spinner fa-pulse"></i><span style="padding:0px 10px;">Saving &amp; closing your wallet...</span></div>';
        wsutil.innerHTML(dialog, htmlStr);

        dialog = document.getElementById('main-dialog');
        dialog.showModal();
        // save + SIGTERMed wallet daemon
        // reset tx
        resetTransactions();
        wsmanager.stopService().then(() => {
            setTimeout(function () {
                // clear form err msg
                formMessageReset();
                changeSection('section-overview');
                // update/clear tx
                txInputUpdated.value = 1;
                txInputUpdated.dispatchEvent(new Event('change'));
                // send fake blockUpdated event
                let resetdata = {
                    type: 'blockUpdated',
                    data: {
                        blockCount: syncStatus.IDLE,
                        displayBlockCount: syncStatus.IDLE,
                        knownBlockCount: syncStatus.IDLE,
                        displayKnownBlockCount: syncStatus.IDLE,
                        syncPercent: syncStatus.IDLE
                    }
                };
                wsmanager.notifyUpdate(resetdata);
                dialog = document.getElementById('main-dialog');
                if (dialog.hasAttribute('open')) dialog.close();
                wsmanager.resetState();
                wsutil.clearChild(dialog);
            }, 1200);
        }).catch((err) => {
            wsmanager.terminateService(true);
            console.log(err);
        });
    });
}

function handleWalletCreate() {
    overviewButtonCreate.addEventListener('click', () => {
        formMessageReset();
        let filePathValue = walletCreateInputPath.value ? walletCreateInputPath.value.trim() : '';
        let passwordValue = walletCreateInputPassword.value ? walletCreateInputPassword.value.trim() : '';

        // validate path
        wsutil.validateWalletPath(filePathValue, DEFAULT_WALLET_PATH).then((finalPath) => {

            // validate password
            if (!passwordValue.length) {
                formMessageSet('create', 'error', `Please enter a password, creating wallet without a password will not be supported!`);
                return;
            }
            settings.set('recentWalletDir', path.dirname(finalPath));

            // user already confirm to overwrite
            if (wsutil.isRegularFileAndWritable(finalPath)) {
                try {
                    // for now, backup instead of delete
                    let ts = new Date().getTime();
                    let backfn = `${finalPath}.bak.${ts}`;
                    fs.renameSync(finalPath, backfn);
                    //fs.unlinkSync(finalPath);
                } catch (err) {
                    formMessageSet('create', 'error', `Unable to overwrite existing file, please enter new wallet file path`);
                    return;
                }
            }

            // create
            wsmanager.createWallet(
                finalPath,
                passwordValue
            ).then((walletFile) => {
                settings.set('recentWallet', walletFile);
                walletOpenInputPath.value = walletFile;
                changeSection('section-overview-load');
                wsutil.showToast('Wallet have been created, you can now open your wallet!', 12000);
            }).catch((err) => {
                formMessageSet('create', 'error', err.message);
                return;
            });
        }).catch((err) => {
            formMessageSet('create', 'error', err.message);
            return;
        });
    });
}

function handleWalletImportKeys() {
    importKeyButtonImport.addEventListener('click', () => {
        formMessageReset();
        let filePathValue = importKeyInputPath.value ? importKeyInputPath.value.trim() : '';
        let passwordValue = importKeyInputPassword.value ? importKeyInputPassword.value.trim() : '';
        let viewKeyValue = importKeyInputViewKey.value ? importKeyInputViewKey.value.trim() : '';
        let spendKeyValue = importKeyInputSpendKey.value ? importKeyInputSpendKey.value.trim() : '';
        let scanHeightValue = importKeyInputScanHeight.value ? parseInt(importKeyInputScanHeight.value, 10) : 0;

        // validate path
        wsutil.validateWalletPath(filePathValue, DEFAULT_WALLET_PATH).then((finalPath) => {
            if (!passwordValue.length) {
                formMessageSet('import', 'error', `Please enter a password, creating wallet without a password will not be supported!`);
                return;
            }

            if (scanHeightValue < 0 || scanHeightValue.toPrecision().indexOf('.') !== -1) {
                formMessageSet('import', 'error', 'Invalid scan height!');
                return;
            }

            // validate viewKey
            if (!viewKeyValue.length || !spendKeyValue.length) {
                formMessageSet('import', 'error', 'View Key and Spend Key can not be left blank!');
                return;
            }

            if (!wsutil.validateSecretKey(viewKeyValue)) {
                formMessageSet('import', 'error', 'Invalid view key!');
                return;
            }
            // validate spendKey
            if (!wsutil.validateSecretKey(spendKeyValue)) {
                formMessageSet('import', 'error', 'Invalid spend key!');
                return;
            }

            settings.set('recentWalletDir', path.dirname(finalPath));

            // user already confirm to overwrite
            if (wsutil.isRegularFileAndWritable(finalPath)) {
                try {
                    // for now, backup instead of delete, just to be safe
                    let ts = new Date().getTime();
                    let backfn = `${finalPath}.bak${ts}`;
                    fs.renameSync(finalPath, backfn);
                    //fs.unlinkSync(finalPath);
                } catch (err) {
                    formMessageSet('import', 'error', `Unable to overwrite existing file, please enter new wallet file path`);
                    return;
                }
            }
            wsmanager.importFromKeys(
                finalPath,// walletfile
                passwordValue,
                viewKeyValue,
                spendKeyValue,
                scanHeightValue
            ).then((walletFile) => {
                settings.set('recentWallet', walletFile);
                walletOpenInputPath.value = walletFile;
                changeSection('section-overview-load');
                wsutil.showToast('Wallet have been imported, you can now open your wallet!', 12000);
            }).catch((err) => {
                formMessageSet('import', 'error', err);
                return;
            });

        }).catch((err) => {
            formMessageSet('import', 'error', err.message);
            return;
        });
    });
}

function handleWalletImportSeed() {
    importSeedButtonImport.addEventListener('click', () => {
        formMessageReset();

        let filePathValue = importSeedInputPath.value ? importSeedInputPath.value.trim() : '';
        let passwordValue = importSeedInputPassword.value ? importSeedInputPassword.value.trim() : '';
        let seedValue = importSeedInputMnemonic.value ? importSeedInputMnemonic.value.trim() : '';
        let scanHeightValue = importSeedInputScanHeight.value ? parseInt(importSeedInputScanHeight.value, 10) : 0;
        // validate path
        wsutil.validateWalletPath(filePathValue, DEFAULT_WALLET_PATH).then((finalPath) => {
            // validate password
            if (!passwordValue.length) {
                formMessageSet('import-seed', 'error', `Please enter a password, creating wallet without a password will not be supported!`);
                return;
            }

            if (scanHeightValue < 0 || scanHeightValue.toPrecision().indexOf('.') !== -1) {
                formMessageSet('import-seed', 'error', 'Invalid scan height!');
                return;
            }

            if (!wsutil.validateMnemonic(seedValue)) {
                formMessageSet('import-seed', 'error', 'Invalid mnemonic seed value!');
                return;
            }

            settings.set('recentWalletDir', path.dirname(finalPath));

            // user already confirm to overwrite, but...
            if (wsutil.isRegularFileAndWritable(finalPath)) {
                try {
                    // backup instead of delete
                    let ts = new Date().getTime();
                    let backfn = `${finalPath}.bak${ts}`;
                    fs.renameSync(finalPath, backfn);
                    //fs.unlinkSync(finalPath);
                } catch (err) {
                    formMessageSet('import-seed', 'error', `Unable to overwrite existing file, please enter new wallet file path`);
                    return;
                }
            }

            wsmanager.importFromSeed(
                finalPath,
                passwordValue,
                seedValue,
                scanHeightValue
            ).then((walletFile) => {
                settings.set('recentWallet', walletFile);
                walletOpenInputPath.value = walletFile;
                changeSection('section-overview-load');
                wsutil.showToast('Wallet have been imported, you can now open your wallet!', 12000);
            }).catch((err) => {
                formMessageSet('import-seed', 'error', err);
                return;
            });

        }).catch((err) => {
            formMessageSet('import-seed', 'error', err.message);
            return;
        });
    });
}

function handleWalletExport() {
    overviewShowKeyButton.addEventListener('click', () => {
        formMessageReset();
        if (!overviewWalletAddress.value) return;
        wsmanager.getSecretKeys(overviewWalletAddress.value).then((keys) => {
            showkeyInputViewKey.value = keys.viewSecretKey;
            showkeyInputSpendKey.value = keys.spendSecretKey;
            if (keys.mnemonicSeed && keys.mnemonicSeed.length > 1) {
                showkeyInputSeed.value = keys.mnemonicSeed;
                showkeyInputSeed.classList.add('ctcl');
            } else {
                showkeyInputSeed.value = `- Mnemonic seed is not available for this wallet -${os.EOL}You still can restore your wallet using private keys shown above.`;
                showkeyInputSeed.classList.remove('ctcl');
            }
        }).catch(() => {
            formMessageSet('secret', 'error', "Failed to get key, please try again in a few seconds");
        });
    });

    showkeyButtonExportKey.addEventListener('click', () => {
        formMessageReset();
        let filename = remote.dialog.showSaveDialog({
            title: "Export keys to file...",
            filters: [
                { name: 'Text files', extensions: ['txt'] }
            ]
        });
        if (filename) {
            wsmanager.getSecretKeys(overviewWalletAddress.value).then((keys) => {
                let textContent = `Wallet Address:${os.EOL}${wsession.get('loadedWalletAddress')}${os.EOL}`;
                textContent += `${os.EOL}View Secret Key:${os.EOL}${keys.viewSecretKey}${os.EOL}`;
                textContent += `${os.EOL}Spend Secret Key:${os.EOL}${keys.spendSecretKey}${os.EOL}`;
                if (keys.mnemonicSeed && keys.mnemonicSeed.length > 1) {
                    textContent += `${os.EOL}Mnemonic Seed:${os.EOL}${keys.mnemonicSeed}${os.EOL}`;
                }
                try {
                    fs.writeFileSync(filename, textContent);
                    formMessageSet('secret', 'success', 'Your keys have been exported, please keep the file secret!');
                } catch (err) {
                    formMessageSet('secret', 'error', "Failed to save your keys, please check that you have write permission to the file");
                }
            }).catch(() => {
                formMessageSet('secret', 'error', "Failed to get keys, please try again in a few seconds");
            });
        }
    });
}

function handleSendTransfer() {
    sendMaxAmount.addEventListener('click', (event) => {
        let maxsend = event.target.dataset.maxsend || 0;
        if (maxsend) sendInputAmount.value = maxsend;
    });

    sendInputFee.value = config.minimumFee;
    function setPaymentIdState(addr) {
        if (addr.length > config.addressLength) {
            sendInputPaymentId.value = '';
            sendInputPaymentId.setAttribute('disabled', true);
        } else {
            sendInputPaymentId.removeAttribute('disabled');
        }
    }
    sendInputAddress.addEventListener('change', (event) => {
        let addr = event.target.value || '';
        let abdata = wsession.get('addressBook').data || null;
        if (!addr.length) initAddressCompletion(abdata);
        setPaymentIdState(addr);
    });
    sendInputAddress.addEventListener('keyup', (event) => {
        let addr = event.target.value || '';
        let abdata = wsession.get('addressBook').data || null;
        if (!addr.length) initAddressCompletion(abdata);
        setPaymentIdState(addr);
    });


    sendButtonSend.addEventListener('click', () => {
        formMessageReset();
        function precision(a) {
            if (!isFinite(a)) return 0;
            let e = 1, p = 0;
            while (Math.round(a * e) / e !== a) { e *= 10; p++; }
            return p;
        }

        let recipientAddress = sendInputAddress.value ? sendInputAddress.value.trim() : '';
        if (!recipientAddress.length || !wsutil.validateAddress(recipientAddress)) {
            formMessageSet('send', 'error', `Invalid ${config.assetName} address`);
            return;
        }

        let paymentId = sendInputPaymentId.value ? sendInputPaymentId.value.trim() : '';
        if (recipientAddress.length > config.addressLength) {
            paymentId = '';
        } else if (paymentId.length) {
            if (!wsutil.validatePaymentId(paymentId)) {
                formMessageSet('send', 'error', 'Sorry, invalid Payment ID');
                return;
            }
        }

        let total = 0;
        let amount = sendInputAmount.value ? parseFloat(sendInputAmount.value) : 0;
        if (amount <= 0 || amount < config.mininumSend) {
            formMessageSet('send', 'error', `Sorry, minimum amount you can send is ${config.mininumSend}`);
            return;
        }

        if (precision(amount) > config.decimalPlaces) {
            formMessageSet('send', 'error', `Amount can't have more than ${config.decimalPlaces} decimal places`);
            return;
        }

        total += amount;
        let txAmount = wsutil.amountForImmortal(amount); // final transfer amount

        let fee = sendInputFee.value ? parseFloat(sendInputFee.value) : 0;
        let minFee = config.minimumFee;
        if (fee < minFee) {
            formMessageSet('send', 'error', `Fee can't be less than ${wsutil.amountForMortal(minFee)}`);
            return;
        }

        if (precision(fee) > config.decimalPlaces) {
            formMessageSet('send', 'error', `Fee can't have more than  ${config.decimalPlaces} decimal places`);
            return;
        }

        total += fee;
        let txFee = wsutil.amountForImmortal(fee);

        let nodeFee = wsession.get('nodeFee') || 0; // nodeFee value is already for mortal
        total += nodeFee;
        let txTotal = wsutil.amountForMortal(total);

        const availableBalance = wsession.get('walletUnlockedBalance') || (0).toFixed(config.decimalPlaces);

        if (parseFloat(txTotal) > parseFloat(availableBalance)) {
            formMessageSet(
                'send',
                'error',
                `Sorry, you don't have enough funds to process this transfer. Transfer amount+fees: ${(txTotal)}`
            );
            return;
        }

        // todo: adjust decimal
        let tx = {
            address: recipientAddress,
            amount: txAmount,
            fee: txFee
        };

        if (paymentId.length) tx.paymentId = paymentId;
        let tpl = `
            <div class="div-transaction-panel">
                <h4>Transfer Confirmation</h4>
                <div class="transferDetail">
                    <p>Please confirm that you have everything entered correctly.</p>
                    <dl>
                        <dt class="dt-ib">Recipient address:</dt>
                        <dd class="dd-ib">${tx.address}</dd>
                        <dt class="${paymentId.length ? 'dt-ib' : 'hidden'}">Payment ID:</dt>
                        <dd class="${paymentId.length ? 'dd-ib' : 'hidden'}">${paymentId.length ? paymentId : 'N/A'}</dd>
                        <dt class="dt-ib">Amount:</dt>
                        <dd class="dd-ib">${amount} ${config.assetTicker}</dd>
                        <dt class="dt-ib">Transaction Fee:</dt>
                        <dd class="dd-ib">${fee} ${config.assetTicker}</dd>
                        <dt class="dt-ib">Node Fee:</dt>
                        <dd class="dd-ib">${(nodeFee > 0 ? nodeFee : '0.00')} ${config.assetTicker}</dd>
                        <dt class="dt-ib">Total:</dt>
                        <dd class="dd-ib">${total} ${config.assetTicker}</dd>
                    </dl>
                </div>
                <div class="div-panel-buttons">
                    <button data-target='#tf-dialog' type="button" class="form-bt button-red dialog-close-default" id="button-send-ko">Cancel</button>
                    <button data-target='#tf-dialog' type="button" class="form-bt button-green" id="button-send-ok">OK, Send it!</button>
                </div>
                <span title="Close this dialog (esc)" class="dialog-close dialog-close-default" data-target="#ab-dialog"><i class="fas fa-window-close"></i></span>
            </div>`;

        let dialog = document.getElementById('tf-dialog');
        wsutil.innerHTML(dialog, tpl);
        dialog = document.getElementById('tf-dialog');
        dialog.showModal();

        let sendBtn = dialog.querySelector('#button-send-ok');

        sendBtn.addEventListener('click', (event) => {
            let md = document.querySelector(event.target.dataset.target);
            md.close();
            formMessageSet('send', 'warning', 'Sending transaction, please wait...<br><progress></progress>');
            wsmanager.sendTransaction(tx).then((result) => {
                formMessageReset();
                let txhashUrl = `<a class="external" title="view in block explorer" href="${config.blockExplorerUrl.replace('[[TX_HASH]]', result.transactionHash)}">${result.transactionHash}</a>`;
                let okMsg = `Transaction sent!<br>Tx. hash: ${txhashUrl}.<br>Your balance may appear incorrect while transaction not fully confirmed.`;
                formMessageSet('send', 'success', okMsg);
                // save to address book if it's new address
                let entryHash = wsutil.fnvhash(recipientAddress + paymentId);
                let abook = wsession.get('addressBook');
                let addressBookData = abook.data;
                if (!addressBookData.hasOwnProperty(entryHash)) {
                    let now = new Date().toISOString().split('T');
                    let newAddress = {
                        name: `NEW (${now[0]} ${now[1].split('.')[0]})`,
                        address: recipientAddress,
                        paymentId: paymentId,
                        qrCode: wsutil.genQrDataUrl(recipientAddress)
                    };
                    abook.data[entryHash] = newAddress;
                    wsession.set('addressBook', abook);
                    let rowData = Object.entries(abook.data).map(([key, value]) => ({ key, value }));
                    window.ABOPTSAPI.api.setRowData(rowData);
                    window.ABOPTSAPI.api.deselectAll();
                    window.ABOPTSAPI.api.resetQuickFilter();
                    window.ABOPTSAPI.api.sizeColumnsToFit();
                    setTimeout(() => {
                        addressBook.save(abook);
                        initAddressCompletion(abook.data);
                    }, 500);
                }

                sendInputAddress.value = '';
                sendInputPaymentId.value = '';
                sendInputAmount.value = '';
            }).catch((err) => {
                err = err.message || err;
                let msg = `${err}`;
                if (err.includes('ESOCKETTIMEDOUT')) {
                    msg = `Transaction was sent but failed to get transaction hash.
                    Please wait for a few blocks, check your balance and transaction history before resending!`;
                } else if (err.includes('size is too big')) {
                    msg = `Failed to send Transaction:
                    Transaction size is too big. Please optimize your wallet, or try sending in smaller amount`;
                }
                formMessageSet('send', 'error', `${msg}`);
            });
            wsutil.clearChild(md);
        });
    });

    sendOptimize.addEventListener('click', () => {
        if (!wsession.get('synchronized', false)) {
            wsutil.showToast('Synchronization is in progress, please wait.');
            return;
        }

        if (wsession.get('fusionProgress')) {
            wsutil.showToast('Wallet optimization in progress, please wait');
            return;
        }

        if (!confirm('You are about to perform wallet optimization. This process may take a while to complete, are you sure?')) return;
        wsutil.showToast('Optimization started, your balance may appear incorrect during the process', 3000);

        // start progress
        let progressBar = document.getElementById('fusionProgress');
        progressBar.classList.remove('hidden');
        wsession.set('fusionProgress', true);
        wsmanager.optimizeWallet().then(() => {
            console.log('fusion started');
        }).catch(() => {
            console.log('fusion err');
        });
        return; // just return, it will notify when its done.
    });
}

function resetTransactions() {
    setTxFiller(true);
    if (window.TXGRID === null || window.TXOPTSAPI === null) {
        return;
    }
    window.TXOPTSAPI.api.destroy();
    window.TXOPTSAPI = null;
    window.TXGRID = null;
    if (document.querySelector('.txlist-item')) {
        let grid = document.getElementById('txGrid');
        wsutil.clearChild(grid);
    }

}

window.TXOPTSAPI = null;
window.TXGRID = null;
function handleTransactions() {
    function resetTxSortMark() {
        let sortedEl = document.querySelectorAll('#transaction-lists .asc, #transaction-lists .desc');
        Array.from(sortedEl).forEach((el) => {
            el.classList.remove('asc');
            el.classList.remove('desc');
        });
    }

    function sortDefault() {
        resetTxSortMark();
        window.TXOPTSAPI.api.setSortModel(getSortModel('timestamp', 'desc'));
        txButtonSortDate.dataset.dir = 'desc';
        txButtonSortDate.classList.add('desc');
    }

    function getSortModel(col, dir) {
        return [{ colId: col, sort: dir }];
    }

    function renderList(txs) {
        setTxFiller();
        if (window.TXGRID === null) {
            let columnDefs = [
                {
                    headerName: 'Data',
                    field: 'timestamp',
                    autoHeight: true,
                    cellClass: 'txinfo',
                    cellRenderer: function (params) {
                        let out = `
                            <p class="tx-date">${params.data.timeStr}</p>
                            <p class="tx-ov-info">Tx. Hash: ${params.data.transactionHash}</p>
                            <p class="tx-ov-info">Payment ID: ${params.data.paymentId}</p>
                            `;
                        return out;
                    },
                    getQuickFilterText: function (params) {
                        let txdate = new Date(params.data.timeStr).toLocaleString(
                            'en-US',
                            { weekday: 'long', year: 'numeric', month: 'long', timeZone: 'UTC' }
                        );
                        let search_data = `${txdate} ${params.data.transactionHash}`;
                        if (params.data.paymentId !== '-') {
                            search_data += ` ${params.data.paymentId}`;
                        }
                        if (params.data.extra !== '-') {
                            search_data += ` ${params.data.extra}`;
                        }
                        search_data += ` ${params.data.amount}`;
                        return search_data;
                    }
                },
                {
                    headerName: "Amount",
                    field: "rawAmount",
                    width: 200,
                    suppressSizeToFit: true,
                    cellClass: ['amount', 'tx-amount'],
                    cellRenderer: function (params) {
                        return `<span data-txType="${params.data.txType}">${params.data.amount}</span>`;
                    },
                    suppressFilter: true,
                    getQuickFilterText: function () { return null; }
                }
            ];
            let gridOptions = {
                columnDefs: columnDefs,
                rowData: txs,
                pagination: true,
                rowClass: 'txlist-item',
                paginationPageSize: 20,
                cacheQuickFilter: true,
                enableSorting: true,
                onRowClicked: showTransaction

            };
            let txGrid = document.getElementById('txGrid');
            window.TXGRID = new AgGrid.Grid(txGrid, gridOptions);
            window.TXOPTSAPI = gridOptions;

            gridOptions.onGridReady = function () {
                setTxFiller();
                txGrid.style.width = "100%";
                setTimeout(function () {
                    window.TXOPTSAPI.api.doLayout();
                    window.TXOPTSAPI.api.sizeColumnsToFit();
                    sortDefault();
                }, 10);
            };

            window.addEventListener('resize', () => {
                if (window.TXOPTSAPI) {
                    window.TXOPTSAPI.api.sizeColumnsToFit();
                }
            });

            let txfilter = document.getElementById('tx-search');
            txfilter.addEventListener('input', function () {
                if (window.TXOPTSAPI) {
                    window.TXOPTSAPI.api.setQuickFilter(this.value);
                }
            });
        } else {
            window.TXOPTSAPI.api.updateRowData({ add: txs });
            window.TXOPTSAPI.api.resetQuickFilter();
            sortDefault();
        }
    }

    function listTransactions() {
        if (wsession.get('txLen') <= 0) {
            //setTxFiller(true);
            return;
        }

        let txs = wsession.get('txNew');
        if (!txs.length) {
            //if(window.TXGRID === null ) setTxFiller(true);
            return;
        }
        setTxFiller();
        renderList(txs);
    }

    // txupdate
    txInputUpdated.addEventListener('change', (event) => {
        let updated = parseInt(event.target.value, 10) === 1;
        if (!updated) return;
        txInputUpdated.value = 0;
        listTransactions();
    });

    txButtonRefresh.addEventListener('click', listTransactions);

    function showTransaction(el) {
        let tx = el.data;
        let txdate = new Date(tx.timestamp * 1000).toUTCString();
        let txhashUrl = `<a class="external" title="view in block explorer" href="${config.blockExplorerUrl.replace('[[TX_HASH]]', tx.transactionHash)}">View in block explorer</a>`;
        let dialogTpl = `
                <div class="div-transactions-panel">
                    <h4>Transaction Detail</h4>
                    <table class="custom-table" id="transactions-panel-table">
                        <tbody>
                            <tr><th scope="col">Hash</th>
                                <td data-cplabel="Tx. hash" class="tctcl">${tx.transactionHash}</td></tr>
                            <tr><th scope="col">Address</th>
                                <td data-cplabel="Address" class="tctcl">${wsession.get('loadedWalletAddress')}</td></tr>
                            <tr><th scope="col">Payment Id</th>
                                <td data-cplabel="Payment ID" class="${tx.paymentId !== '-' ? 'tctcl' : 'xtctl'}">${tx.paymentId}</td></tr>
                            <tr><th scope="col">Amount</th>
                                <td data-cplabel="Tx. amount" class="tctcl">${tx.amount}</td></tr>
                            <tr><th scope="col">Fee</th>
                                <td  data-cplabel="Tx. fee" class="tctcl">${tx.fee}</td></tr>
                            <tr><th scope="col">Timestamp</th>
                                <td data-cplabel="Tx. date" class="tctcl">${tx.timestamp} (${txdate})</td></tr>
                            <tr><th scope="col">Block Index</th>
                                <td data-cplabel="Tx. block index" class="tctcl">${tx.blockIndex}</td></tr>
                            <tr><th scope="col">Is Base?</th>
                                <td>${tx.isBase}</td></tr>
                            <tr><th scope="col">Extra</th>
                                <td data-cplabel="Tx. extra" class="${tx.extra !== '-' ? 'tctcl' : 'xtctl'}">${tx.extra}</td></tr>
                            <tr><th scope="col">Unlock Time</th>
                                <td>${tx.unlockTime}</td></tr>
                        </tbody>
                    </table>
                    <p class="text-center">${txhashUrl}</p>
                    <span title="Close this dialog (esc)" class="dialog-close dialog-close-default" data-target="#ab-dialog"><i class="fas fa-window-close"></i></span>
                </div>
            `;

        let dialog = document.getElementById('tx-dialog');
        wsutil.innerHTML(dialog, dialogTpl);
        dialog = document.getElementById('tx-dialog');
        dialog.showModal();
    }

    // sort
    txButtonSortAmount.addEventListener('click', (event) => {
        event.preventDefault();
        let currentDir = event.target.dataset.dir;
        let targetDir = (currentDir === 'desc' ? 'asc' : 'desc');
        event.target.dataset.dir = targetDir;
        resetTxSortMark();
        event.target.classList.add(targetDir);
        window.TXOPTSAPI.api.setSortModel(getSortModel('rawAmount', targetDir));
    });


    txButtonSortDate.addEventListener('click', (event) => {
        event.preventDefault();
        let currentDir = event.target.dataset.dir;
        let targetDir = (currentDir === 'desc' ? 'asc' : 'desc');
        event.target.dataset.dir = targetDir;
        resetTxSortMark();
        event.target.classList.add(targetDir);
        window.TXOPTSAPI.api.setSortModel(getSortModel('timestamp', targetDir));
    });

    // export
    function exportAsCsv(mode) {
        if (wsession.get('txLen') <= 0) return;

        formMessageReset();
        mode = mode || 'all';
        let recentDir = settings.get('recentWalletDir', remote.app.getPath('documents'));
        let filename = remote.dialog.showSaveDialog({
            title: "Export transactions as scv...",
            defaultPath: recentDir,
            filters: [
                { name: 'CSV files', extensions: ['csv'] }
            ]
        });
        if (!filename) return;

        const createCsvWriter = require('csv-writer').createObjectCsvWriter;
        const csvWriter = createCsvWriter({
            path: filename,
            header: [
                { id: 'timeStr', title: 'Time' },
                { id: 'amount', title: 'Amount' },
                { id: 'paymentId', title: 'PaymentId' },
                { id: 'transactionHash', title: 'Transaction Hash' },
                { id: 'fee', title: 'Transaction Fee' },
                { id: 'extra', title: 'Extra Data' },
                { id: 'blockIndex', title: 'Block Height' }
            ]
        });
        let rawTxList = wsession.get('txList');
        let txlist = rawTxList.map((obj) => {
            return {
                timeStr: obj.timeStr,
                amount: obj.amount,
                paymentId: obj.paymentId,
                transactionHash: obj.transactionHash,
                fee: obj.fee,
                extra: obj.extra,
                blockIndex: obj.blockIndex,
                txType: obj.txType
            };
        });

        let dialog = document.getElementById('ab-dialog');
        let outData = [];
        let outType = '';
        switch (mode) {
            case 'in':
                outData = txlist.filter((obj) => obj.txType === "in");
                outType = "incoming";
                break;
            case 'out':
                outData = txlist.filter((obj) => { return obj.txType === "out"; });
                outType = "outgoing";
                break;
            default:
                outData = txlist;
                outType = 'all';
                break;
        }

        if (!outData.length) {
            wsutil.showToast(`Transaction export failed, ${outType} transactions is not available!`);
            if (dialog.hasAttribute('open')) dialog.close();
            return;
        }

        csvWriter.writeRecords(outData).then(() => {
            if (dialog.hasAttribute('open')) dialog.close();
            wsutil.showToast(`Transaction list exported to ${filename}`);
        }).catch((err) => {
            if (dialog.hasAttribute('open')) dialog.close();
            wsutil.showToast(`Transaction export failed, ${err.message}`);
        });
    }

    wsutil.liveEvent('button.export-txtype', 'click', (event) => {
        let txtype = event.target.dataset.txtype || 'all';
        return exportAsCsv(txtype);
    });

    txButtonExport.addEventListener('click', () => {
        let dialogTpl = `<div class="transaction-panel">
            <h4>Export Transactions to CSV:</h4>
            <div class="div-panel-buttons">
                <button data-txtype="all" type="button" class="button-green export-txtype">All Transfers</button>
                <button data-txtype="in" type="button" class="button-green export-txtype">Incoming Transfers</button>
                <button data-txtype="out" type="button" class="button-green export-txtype">Outgoing Transfers</button>
                <button data-target="#ab-dialog" type="button" class="button-gray dialog-close-default">Cancel</button>
            </div>
        `;
        let dialog = document.getElementById('ab-dialog');
        if (dialog.hasAttribute('open')) dialog.close();
        dialog.innerHTML = dialogTpl;
        dialog.showModal();
    });
}

function handleNetworkChange() {
    window.addEventListener('online', () => {
        let connectedNode = wsession.get('connectedNode');
        if (!connectedNode.length || connectedNode.startsWith('127.0.0.1')) return;
        wsmanager.networkStateUpdate(1);
    });
    window.addEventListener('offline', () => {
        let connectedNode = wsession.get('connectedNode');
        if (!connectedNode.length || connectedNode.startsWith('127.0.0.1')) return;
        wsmanager.networkStateUpdate(0);
    });
}

// event handlers
function initHandlers() {
    initSectionTemplates();
    setDarkMode(settings.get('darkmode', true));

    // main section link handler
    for (var ei = 0; ei < sectionButtons.length; ei++) {
        let target = sectionButtons[ei].dataset.section;
        sectionButtons[ei].addEventListener('click', changeSection.bind(this, target), false);
    }
    // misc shortcut
    dmswitch.addEventListener('click', () => {
        let tmode = thtml.classList.contains('dark') ? '' : 'dark';
        setDarkMode(tmode);
    });
    kswitch.addEventListener('click', showKeyBindings);
    iswitch.addEventListener('click', showAbout);

    function handleBrowseButton(args) {
        if (!args) return;
        let tbtn = document.getElementById(args.targetButton);
        if (tbtn.classList.contains('d-opened')) return;
        tbtn.classList.add('d-opened');
        let dialogType = args.dialogType;
        let targetName = (args.targetName ? args.targetName : 'file');
        let targetInput = args.targetInput;
        let recentDir = settings.get('recentWalletDir', remote.app.getPath('documents'));
        let dialogOpts = {
            defaultPath: recentDir
        };

        if (dialogType === 'saveFile') {
            dialogOpts.defaultPath = path.join(
                recentDir,
                `new_wallet_${(new Date()).getTime()}.${config.walletFileDefaultExt}`
            );
            dialogOpts.title = `Select directory to store your ${targetName}, and give it a filename.`;
            dialogOpts.buttonLabel = 'OK';

            remote.dialog.showSaveDialog(dialogOpts, (file) => {
                if (file) targetInput.value = file;
                tbtn.classList.remove('d-opened');
            });
        } else {
            dialogOpts.properties = [dialogType];

            remote.dialog.showOpenDialog(dialogOpts, (files) => {
                if (files) targetInput.value = files[0];
                tbtn.classList.remove('d-opened');
            });
        }
    }

    function handleFormEnter(el) {
        try { clearTimeout(window.enterHandler); } catch (_e) { }
        let key = this.event.key;
        window.enterHandler = setTimeout(() => {
            if (key === 'Enter') {
                let section = el.closest('.section');
                let target = section.querySelector('button:not(.notabindex)');
                if (target) {
                    let event = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    target.dispatchEvent(event);
                }
            }
        }, 400);
    }

    //handleNetworkChange();
    // open wallet
    handleWalletOpen();
    // create wallet
    handleWalletCreate();
    // import keys
    handleWalletImportKeys();
    // import seed
    handleWalletImportSeed();
    // delay some handlers
    setTimeout(() => {
        // settings handlers
        handleSettings();
        // addressbook handlers
        handleAddressBook();
        // close wallet
        handleWalletClose();
        // rescan/reset wallet
        handleWalletRescan();
        // export keys/seed
        handleWalletExport();
        // send transfer
        handleSendTransfer();
        // transactions
        handleTransactions();
        // netstatus
        handleNetworkChange();
        //external link handler
        wsutil.liveEvent('a.external', 'click', (event) => {
            event.preventDefault();
            shell.openExternal(event.target.getAttribute('href'));
            return false;
        });
        // toggle password visibility
        wsutil.liveEvent('.togpass', 'click', (e) => {
            let tg = e.target.classList.contains('.togpas') ? e.target : e.target.closest('.togpass');
            if (!tg) return;
            let targetId = tg.dataset.pf || null;
            if (!targetId) return;
            let target = document.getElementById(targetId);
            target.type = (target.type === "password" ? 'text' : 'password');
            tg.firstChild.dataset.icon = (target.type === 'password' ? 'eye-slash' : 'eye');
        });
        // context menu
        const pasteMenu = Menu.buildFromTemplate([{ label: 'Paste', role: 'paste' }]);
        for (var ui = 0; ui < genericEditableInputs.length; ui++) {
            let el = genericEditableInputs[ui];
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                pasteMenu.popup(remote.getCurrentWindow());
            }, false);
        }
        // generic browse path btn event
        for (var i = 0; i < genericBrowseButton.length; i++) {
            let targetInputId = genericBrowseButton[i].dataset.targetinput;
            let args = {
                dialogType: genericBrowseButton[i].dataset.selection,
                targetName: genericBrowseButton[i].dataset.fileobj ? genericBrowseButton[i].dataset.fileobj : '',
                targetInput: document.getElementById(targetInputId),
                targetButton: genericBrowseButton[i].id
            };
            genericBrowseButton[i].addEventListener('click', handleBrowseButton.bind(this, args));
        }
        // generic dialog closer
        wsutil.liveEvent('.dialog-close-default', 'click', () => {
            let d = document.querySelector('dialog[open]');
            if (d) d.close();
        });
        // form submit
        for (var oi = 0; oi < genericEnterableInputs.length; oi++) {
            let el = genericEnterableInputs[oi];
            el.addEventListener('keyup', handleFormEnter.bind(this, el));
        }
        wsutil.liveEvent('dialog input:not(.noenter)', 'keyup', (e) => {
            let key = this.event.key;
            try { clearTimeout(window.enterHandler); } catch (_e) { }
            window.enterHandler = setTimeout(() => {
                if (key === 'Enter') {
                    let section = e.target.closest('dialog');
                    let target = section.querySelector('button:not(.notabindex)');
                    if (target) {
                        let event = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        target.dispatchEvent(event);
                    }
                }
            });
        });
        //genpaymentid+integAddress
        overviewPaymentIdGen.addEventListener('click', () => {
            genPaymentId(false);
        });
        wsutil.liveEvent('#makePaymentId', 'click', () => {
            let payId = genPaymentId(true);
            let iaf = document.getElementById('genOutputIntegratedAddress');
            document.getElementById('genInputPaymentId').value = payId;
            iaf.value = '';
        });
        overviewIntegratedAddressGen.addEventListener('click', showIntegratedAddressForm);
        wsutil.liveEvent('#doGenIntegratedAddr', 'click', () => {
            formMessageReset();
            let genInputAddress = document.getElementById('genInputAddress');
            let genInputPaymentId = document.getElementById('genInputPaymentId');
            let outputField = document.getElementById('genOutputIntegratedAddress');
            let addr = genInputAddress.value ? genInputAddress.value.trim() : '';
            let pid = genInputPaymentId.value ? genInputPaymentId.value.trim() : '';
            outputField.value = '';
            outputField.removeAttribute('title');
            if (!addr.length || !pid.length) {
                formMessageSet('gia', 'error', 'Address & Payment ID is required');
                return;
            }
            if (!wsutil.validateAddress(addr)) {
                formMessageSet('gia', 'error', `Invalid ${config.assetName} address`);
                return;
            }
            // only allow standard address
            if (addr.length > config.addressLength) {
                formMessageSet('gia', 'error', `Only standard ${config.assetName} address are supported`);
                return;
            }
            if (!wsutil.validatePaymentId(pid)) {
                formMessageSet('gia', 'error', 'Invalid Payment ID');
                return;
            }

            wsmanager.genIntegratedAddress(pid, addr).then((res) => {
                formMessageReset();
                outputField.value = res.integratedAddress;
                outputField.setAttribute('title', 'click to copy');
            }).catch((err) => {
                formMessageSet('gia', 'error', err.message);
            });
        });
        // inputs click to copy handlers
        wsutil.liveEvent('textarea.ctcl, input.ctcl', 'click', (event) => {
            let el = event.target;
            let wv = el.value ? el.value.trim() : '';
            if (!wv.length) return;
            clipboard.writeText(wv);

            let cplabel = el.dataset.cplabel ? el.dataset.cplabel : '';
            let cpnotice = cplabel ? `${cplabel} copied to clipboard!` : 'Copied to clipboard';
            wsutil.showToast(cpnotice);
        });
        // non-input elements ctc handlers
        wsutil.liveEvent('.tctcl', 'click', (event) => {
            let el = event.target;
            let wv = el.textContent.trim();
            if (!wv.length) return;
            clipboard.writeText(wv);
            let cplabel = el.dataset.cplabel ? el.dataset.cplabel : '';
            let cpnotice = cplabel ? `${cplabel} copied to clipboard!` : 'Copied to clipboard';
            wsutil.showToast(cpnotice);
        });
        initKeyBindings();
    }, 1200);
}

function initKeyBindings() {
    let walletOpened;
    // switch tab: ctrl+tab
    Mousetrap.bind(['ctrl+tab', 'command+tab', 'ctrl+pagedown'], switchTab);
    Mousetrap.bind(['ctrl+o', 'command+o'], () => {
        walletOpened = wsession.get('serviceReady') || false;
        if (walletOpened) {
            wsutil.showToast('Please close current wallet before opening another wallet!');
            return;
        }
        return changeSection('section-overview-load');
    });
    Mousetrap.bind(['ctrl+x', 'command+x'], () => {
        walletOpened = wsession.get('serviceReady') || false;
        if (!walletOpened) {
            wsutil.showToast('No wallet is currently opened');
            return;
        }
        overviewWalletCloseButton.dispatchEvent(new Event('click'));
    });
    // display/export private keys: ctrl+e
    Mousetrap.bind(['ctrl+e', 'command+e'], () => {
        walletOpened = wsession.get('serviceReady') || false;
        if (!walletOpened) return;
        return changeSection('section-overview-show');
    });
    // create new wallet: ctrl+n
    Mousetrap.bind(['ctrl+n', 'command+n'], () => {
        walletOpened = wsession.get('serviceReady') || false;
        if (walletOpened) {
            wsutil.showToast('Please close current wallet before creating/importing new wallet');
            return;
        }
        return changeSection('section-overview-create');
    });
    // import from keys: ctrl+i
    Mousetrap.bind(['ctrl+i', 'command+i'], () => {
        walletOpened = wsession.get('serviceReady') || false;
        if (walletOpened) {
            wsutil.showToast('Please close current wallet before creating/importing new wallet');
            return;
        }
        return changeSection('section-overview-import-key');
    });
    // tx page: ctrl+t
    Mousetrap.bind(['ctrl+t', 'command+t'], () => {
        walletOpened = wsession.get('serviceReady') || false;
        if (!walletOpened) {
            wsutil.showToast('Please open your wallet to view your transactions');
            return;
        }
        return changeSection('section-transactions');
    });
    // send tx: ctrl+s
    Mousetrap.bind(['ctrl+s', 'command+s'], () => {
        walletOpened = wsession.get('serviceReady') || false;
        if (!walletOpened) {
            wsutil.showToast('Please open your wallet to make a transfer');
            return;
        }
        return changeSection('section-send');
    });
    // import from mnemonic seed: ctrl+shift+i
    Mousetrap.bind(['ctrl+shift+i', 'command+shift+i'], () => {
        walletOpened = wsession.get('serviceReady') || false;
        if (walletOpened) {
            wsutil.showToast('Please close current wallet before creating/importing new wallet');
            return;
        }
        return changeSection('section-overview-import-seed');
    });

    // back home
    Mousetrap.bind(['ctrl+home', 'command+home'], () => {
        walletOpened = wsession.get('serviceReady') || false;
        let section = walletOpened ? 'section-overview' : 'section-welcome';
        return changeSection(section);
    });

    // show key binding
    Mousetrap.bind(['ctrl+/', 'command+/'], () => {
        let openedDialog = document.querySelector('dialog[open]');
        if (openedDialog) return openedDialog.close();
        return showKeyBindings();
    });

    Mousetrap.bind('esc', () => {
        let openedDialog = document.querySelector('dialog[open]');
        if (!openedDialog) return;
        return openedDialog.close();
    });

    Mousetrap.bind([`ctrl+\\`, `command+\\`], () => {
        setDarkMode(!document.documentElement.classList.contains('dark'));
    });
}

function fetchFromRaw() {
    if(!settings.has('pubnodes_raw')){
        setTimeout(() => initNodeSelection, 100);
        return;
    }
    
    let nodeStr = atob(settings.get('pubnodes_raw', ""));
    if(!nodeStr.length) return;
    console.debug(nodeStr);
    
    let tested_nodes = [];
    let nodes = JSON.parse(nodeStr);

    for(const n of nodes) {
        let feeLabel = parseInt(n.fee, 10) > 0 ? `Fee: ${wsutil.amountForMortal(n.fee)} ${config.assetTicker}` : "FREE";
        tested_nodes.push({
            host: `${n.url}:${n.port}`,
            label: `${n.url}|${feeLabel}`
        });
    }
    
    settings.set('pubnodes_tested', tested_nodes);
    initNodeSelection();
    
}

function fetchNodeInfo(force) {
    force = force || false;

    function fetchWait(url, timeout) {
        let controller = new AbortController();
        let signal = controller.signal;
        timeout = timeout || 6800;
        return Promise.race([
            fetch(url, { signal }),
            new Promise((resolve) =>
                setTimeout(() => {
                    let fakeout = { "address": "", "amount": 0, "status": "KO" };
                    window.FETCHNODESIG = controller;
                    return resolve(fakeout);
                }, timeout)
            )
        ]);
    }

    // disable node selection during update
    walletOpenInputNode.options.length = 0;
    let opt = document.createElement('option');
    opt.text = "Updating node list, please wait...";
    opt.value = "-";
    opt.setAttribute('selected', true);
    walletOpenInputNode.add(opt, null);
    walletOpenInputNode.setAttribute('disabled', true);
    walletOpenInputNode.dataset.updating = 1;
    walletOpenNodeLabel.innerHTML = '<i class="fas fa-sync fa-spin"></i> Updating node list, please wait...';
    walletOpenSelectBox.dataset.loading = "1";

    window.ELECTRON_ENABLE_SECURITY_WARNINGS = false;
    let aliveNodes = settings.get('pubnodes_tested', []);
    if (aliveNodes.length && !force) {
        initNodeSelection(settings.get('node_address'));
        return aliveNodes;
    }

    // todo: also check block height?
    let nodes = settings.get('pubnodes_data');

    let reqs = [];
    //let hrstart = process.hrtime();
    nodes.forEach(h => {
        let out = {
            host: h,
            label: h,
        };

        let url = `http://${h}/feeinfo`;
        reqs.push(function (callback) {
            return fetchWait(url)
                .then((response) => {
                    if (response.hasOwnProperty('status')) { // fake/timeout response
                        try { window.FETCHNODESIG.abort(); } catch (e) { }
                        return response;
                    } else {
                        return response.json();
                    }
                }).then(json => {
                    if (!json || !json.hasOwnProperty("address") || !json.hasOwnProperty("amount")) {
                        return callback(null, null);
                    }

                    let feeAmount = "";
                    if (json.status === "KO") {
                        feeAmount = 'Fee: unknown/timeout';
                    } else {
                        feeAmount = parseInt(json.amount, 10) > 0 ? `Fee: ${wsutil.amountForMortal(json.amount)} ${config.assetTicker}` : "FREE";
                    }
                    out.label = `${h.split(':')[0]} | ${feeAmount}`;
                    return callback(null, out);
                }).catch(() => {
                    callback(null, null);
                });
        });
    });
    const parLimit = 12;
    async.parallelLimit(reqs, parLimit, function (error, results) {
        if (results) {
            let res = results.filter(val => val);
            if (res.length) {
                settings.set('pubnodes_tested', res);
            }

            //let hrend = process.hrtime(hrstart);
            // console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000);
            // console.info(`parlimit: ${parLimit}`);
            // console.info(`total nodes: ${nodes.length}`);
            // console.info(`alive nodes: ${res.length}`);
            initNodeSelection();
        } else {
            initNodeSelection();
        }
    });
}

// spawn event handlers
document.addEventListener('DOMContentLoaded', () => {
    initHandlers();
    showInitialPage();
    if (!config.remoteNodeListFiltered) {
        if (navigator.onLine) {
            fetchNodeInfo();
        } else {
            setTimeout(() => initNodeSelection, 500);
        }
    } else {
        walletOpenRefreshNodes.classList.add('hidden');
        fetchFromRaw();
    }
}, false);

ipcRenderer.on('cleanup', () => {
    if (!win.isVisible()) win.show();
    if (win.isMinimized()) win.restore();

    win.focus();

    var dialog = document.getElementById('main-dialog');
    let htmlText = 'Terminating WalletShell...';
    if (wsession.get('loadedWalletAddress') !== '') {
        htmlText = 'Saving &amp; closing your wallet...';
    }

    let htmlStr = `<div class="div-save-main" style="text-align: center;padding:1rem;"><i class="fas fa-spinner fa-pulse"></i><span style="padding:0px 10px;">${htmlText}</span></div>`;
    dialog.innerHTML = htmlStr;
    dialog.showModal();
    wsmanager.stopSyncWorker();
    wsmanager.stopService().then(() => {
        setTimeout(function () {
            wsmanager.terminateService(true);
            try { fs.unlinkSync(wsession.get('walletConfig')); } catch (e) { }
            win.close();
        }, 1200);
    }).catch((err) => {
        console.log(err);
        wsmanager.terminateService(true);
        try { fs.unlinkSync(wsession.get('walletConfig')); } catch (e) { }
        win.close();
    });
});
