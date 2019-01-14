const log = require('electron-log');
const WalletShellApi = require('./ws_api');

let DEBUG = false;
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.console.level = 'debug';
log.transports.file.level = 'debug';

const CHECK_INTERVAL = 8 * 1000;
var LAST_BLOCK_COUNT = 1;
var LAST_KNOWN_BLOCK_COUNT = 1;

var SERVICE_CFG = null; // { service_host: '127.0.0.1', service_port: '8070', service_password: 'xxx'};
var SAVE_COUNTER = 0;
var TX_LAST_INDEX = 1;
var TX_LAST_COUNT = 0;
var TX_CHECK_STARTED = false;
var TX_SKIPPED_COUNT = 0;
var STATE_CONNECTED = true;
var STATE_SAVING = false;
var STATE_PAUSED = false;
var STATE_PENDING_SAVE = false;
var PENDING_SAVE_SKIP_COUNTER = 0;
var PENDING_SAVE_SKIP_MAX = 5;

var wsapi = null;
var taskWorker = null;

function logDebug(msg) {
    if (!DEBUG) return;
    log.debug(`[syncworker] ${msg}`);
}

function initApi(cfg) {
    if (wsapi instanceof WalletShellApi) return;
    logDebug('Initializing WalletShellApi');
    SERVICE_CFG = cfg;
    wsapi = new WalletShellApi(SERVICE_CFG);
}

function checkBlockUpdate() {
    if (!SERVICE_CFG || STATE_SAVING || wsapi === null) return;
    if (STATE_PENDING_SAVE && (PENDING_SAVE_SKIP_COUNTER < PENDING_SAVE_SKIP_MAX)) {
        PENDING_SAVE_SKIP_COUNTER += 1;
        logDebug('checkBlockUpdate: there is pending saveWallet, delaying block update check');
        return;
    }

    PENDING_SAVE_SKIP_COUNTER = 0;
    logDebug('checkBlockUpdate: fetching block update');
    //let svc = new WalletShellApi(SERVICE_CFG);
    wsapi.getStatus().then((blockStatus) => {
        STATE_PENDING_SAVE = false;
        let lastConStatus = STATE_CONNECTED;
        let conFailed = parseInt(blockStatus.knownBlockCount, 10) === 1;
        if (conFailed) {
            logDebug('checkBlockUpdate: Got bad known block count, mark connection as broken');
            if (lastConStatus !== conFailed) {
                let fakeStatus = {
                    blockCount: -200,
                    knownBlockCount: -200,
                    displayBlockCount: -200,
                    displayKnownBlockCount: -200,
                    syncPercent: -200
                };
                process.send({
                    type: 'blockUpdated',
                    data: fakeStatus
                });
            }
            STATE_CONNECTED = false;
            return;
        }

        // we have good connection
        STATE_CONNECTED = true;
        let blockCount = parseInt(blockStatus.blockCount, 10);
        let knownBlockCount = parseInt(blockStatus.knownBlockCount, 10);
        if (blockCount <= LAST_BLOCK_COUNT && knownBlockCount <= LAST_KNOWN_BLOCK_COUNT && TX_SKIPPED_COUNT < 10) {
            logDebug(`checkBlockUpdate: no update, skip block notifier (${TX_SKIPPED_COUNT})`);
            TX_SKIPPED_COUNT += 1;
            return;
        }
        TX_SKIPPED_COUNT = 0;
        logDebug('checkBlockUpdate: block updated, notify block update');
        let txcheck = (LAST_KNOWN_BLOCK_COUNT < knownBlockCount || LAST_BLOCK_COUNT < knownBlockCount);
        LAST_BLOCK_COUNT = blockCount;
        LAST_KNOWN_BLOCK_COUNT = knownBlockCount;

        // add any extras here, so renderer not doing too much things
        let dispKnownBlockCount = (knownBlockCount - 1);
        let dispBlockCount = (blockCount > dispKnownBlockCount ? dispKnownBlockCount : blockCount);
        let syncPercent = ((dispBlockCount / dispKnownBlockCount) * 100);
        if (syncPercent <= 0 || syncPercent >= 99.995) {
            syncPercent = 100;
        } else {
            syncPercent = syncPercent.toFixed(2);
        }

        blockStatus.displayBlockCount = dispBlockCount;
        blockStatus.displayKnownBlockCount = dispKnownBlockCount;
        blockStatus.syncPercent = syncPercent;
        process.send({
            type: 'blockUpdated',
            data: blockStatus
        });

        // don't check if we can't get any block
        if (LAST_BLOCK_COUNT <= 1) return;

        // don't check tx if block count not updated
        if (!txcheck && TX_CHECK_STARTED) {
            logDebug('checkBlockUpdate: Tx check skipped');
            return;
        }

        checkTransactionsUpdate();

    }).catch((err) => {
        logDebug(`checkBlockUpdate: FAILED, ${err.message}`);
        return false;
    });
}

//var TX_CHECK_COUNTER = 0;
function checkTransactionsUpdate() {
    if (!SERVICE_CFG || STATE_SAVING || wsapi === null) return;


    wsapi.getBalance().then((balance) => {
        STATE_PENDING_SAVE = false;
        process.send({
            type: 'balanceUpdated',
            data: balance
        });

        if (LAST_BLOCK_COUNT > 1) {
            logDebug('checkTransactionsUpdate: checking tx update');
            let currentBLockCount = LAST_BLOCK_COUNT - 1;
            let startIndex = (!TX_CHECK_STARTED ? 1 : TX_LAST_INDEX);
            let searchCount = currentBLockCount;
            let needCountMargin = false;
            let blockMargin = 10;
            if (TX_CHECK_STARTED) {
                searchCount = (currentBLockCount - TX_LAST_COUNT);
                needCountMargin = true;
            }

            let startIndexWithMargin = (startIndex === 1 ? 1 : (startIndex - blockMargin));
            let searchCountWithMargin = needCountMargin ? searchCount + blockMargin : searchCount;
            let trx_args = {
                firstBlockIndex: startIndexWithMargin,
                blockCount: searchCountWithMargin
            };
            logDebug(`checkTransactionsUpdate: args=${JSON.stringify(trx_args)}`);
            wsapi.getTransactions(trx_args).then((trx) => {
                process.send({
                    type: 'transactionUpdated',
                    data: trx
                });
                return true;
            }).catch((err) => {
                logDebug(`checkTransactionsUpdate: getTransactions FAILED, ${err.message}`);
                return false;
            });
            TX_CHECK_STARTED = true;
            TX_LAST_INDEX = currentBLockCount;
            TX_LAST_COUNT = currentBLockCount;
        }
    }).catch((err) => {
        logDebug(`checkTransactionsUpdate: getBalance FAILED, ${err.message}`);
        return false;
    });
}

function delayReleaseSaveState() {
    setTimeout(() => {
        STATE_SAVING = false;
    }, 3000);
}

// function doExit() {
//     if (taskWorker === undefined || taskWorker === null) {
//         try {
//             clearInterval(taskWorker);
//             process.exit(0);
//         } catch (e) {
//             logDebug(`FAILED, ${e.message}`);
//         }
//     }
// }

function saveWallet() {
    if (!SERVICE_CFG) return;
    if (STATE_PENDING_SAVE) {
        logDebug('saveWallet: skipped, last save operation still pending');
        return;
    }
    STATE_SAVING = true;
    logDebug(`saveWallet: trying to save wallet`);
    setTimeout(() => {
        wsapi.save().then(() => {
            logDebug(`saveWallet: OK`);
            STATE_SAVING = false;
            STATE_PENDING_SAVE = false;
            //if(exit) doExit();
            return true;
        }).catch((err) => {
            STATE_PENDING_SAVE = true;
            logDebug(`saveWallet: FAILED, ${err.message}`);
            delayReleaseSaveState();
            //if (exit) doExit();
            return false;
        });
    }, 2222);
}

function workOnTasks() {
    taskWorker = setInterval(() => {
        if (STATE_PAUSED) return;
        logDebug(`Running wallet synchronization tasks`);
        checkBlockUpdate();
        if (SAVE_COUNTER > 20) {
            saveWallet();
            SAVE_COUNTER = 0;
        }
        SAVE_COUNTER++;
    }, CHECK_INTERVAL);
}

// {type: 'blah', msg: 'any'}
process.on('message', (msg) => {
    let cmd = msg || '';
    cmd.type = msg.type || 'cfg';
    cmd.data = msg.data || null;

    switch (cmd.type) {
        case 'cfg':
            if (cmd.data) {
                SERVICE_CFG = cmd.data;
                initApi(SERVICE_CFG);
                process.send({
                    type: 'serviceStatus',
                    data: 'OK'
                });
            }
            if (cmd.debug) {
                DEBUG = true;
                logDebug('Config received.');
                logDebug('Running in debug mode.');
            }
            break;
        case 'start':
            logDebug('Starting');
            try { clearInterval(taskWorker); } catch (err) { }
            // initial block check;
            checkBlockUpdate();

            // initial check
            checkTransactionsUpdate(); // just to get balance

            setTimeout(workOnTasks, 5000);
            break;
        case 'pause':
            if (STATE_PAUSED) return;
            logDebug('Got suspend command');
            process.send({
                type: 'blockUpdated',
                data: {
                    blockCount: -50,
                    knownBlockCount: -50,
                    displayBlockCount: -50,
                    displayKnownBlockCount: -50,
                    syncPercent: -50
                }
            });
            STATE_PAUSED = true;
            break;
        case 'resume':
            logDebug('Got resume command');
            TX_SKIPPED_COUNT = 5;
            SAVE_COUNTER = 0;
            wsapi = null;
            initApi(SERVICE_CFG);
            setTimeout(() => {
                wsapi.getBalance().then(() => {
                    logDebug(`Warming up: getBalance OK`);
                }).catch((err) => {
                    logDebug(`Warming up: getBalance FAILED, ${err.message}`);
                });
                STATE_PAUSED = false;
            }, 15000);

            process.send({
                type: 'blockUpdated',
                data: {
                    blockCount: -10,
                    knownBlockCount: -10,
                    displayBlockCount: -10,
                    displayKnownBlockCount: -10,
                    syncPercent: -10
                }
            });
            break;
        case 'stop':
            logDebug('Got stop command, halting all tasks and exit...');
            TX_SKIPPED_COUNT = 0;
            SERVICE_CFG = wsapi = null;
            //saveWallet(true);
            if (taskWorker === undefined || taskWorker === null) {
                try {
                    clearInterval(taskWorker);
                    process.exit(0);
                } catch (e) {
                    logDebug(`FAILED, ${e.message}`);
                    process.exit(1);
                }
            }
            break;
        default:
            break;
    }
});

process.on('uncaughtException', function (err) {
    logDebug(`worker uncaughtException: ${err.message}`);
    process.exit(1);
});

process.on('disconnect', () => function () {
    logDebug(`worker disconnected`);
    process.exit(1);
});