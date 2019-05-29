import * as log from 'electron-log';
import { syncStatus } from './ws_constants';
import { WalletShellApi } from './ws_api';

let DEBUG = false;
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.console.level = 'debug';
log.transports.file.level = 'debug';

const SYNC_INTERVAL = 4 * 1000;
const SYNC_FAILED_MAX = 24;

interface WorkerStatus { 
    CONNECTED: boolean,
    PAUSED: boolean,
    TX_CHECK_INITIALIZED: boolean,
    FAILED_COUNT: number,
    SAVE_TICK: number,
    STATE_CONNECTED: boolean,
}

interface WalletStatus {
    LAST_BLOCK_COUNT: number,
    LAST_KNOWN_BLOCK_COUNT: number,
    TX_LAST_INDEX: number,
    TX_LAST_COUNT: number,
    TX_CHECK_SKIPPED_COUNT: number,
    TX_SKIPPED_COUNT: number,
}

let serviceConfig = null; // { service_host: '127.0.0.1', service_port: '8070', service_password: 'xxx'};
let workerStatus: WorkerStatus = {
    CONNECTED: true,
    PAUSED: false,
    TX_CHECK_INITIALIZED: false,
    FAILED_COUNT: 0,
    SAVE_TICK: 0,
    STATE_CONNECTED: false,
};
let walletStatus: WalletStatus = {
    LAST_BLOCK_COUNT: 1,
    LAST_KNOWN_BLOCK_COUNT: 1,
    TX_LAST_INDEX: 1,
    TX_LAST_COUNT: 0,
    TX_CHECK_SKIPPED_COUNT: 0,
    TX_SKIPPED_COUNT: 0,
};
let wsapi = null;
let taskWorker = null;

function logDebug(msg) {
    // if (!DEBUG) return;
    log.debug(`[syncworker] ${msg}`);
}

function initApi(cfg) {
    if (wsapi instanceof WalletShellApi) return;
    logDebug('Initializing WalletShellApi');
    serviceConfig = cfg;
    wsapi = new WalletShellApi(serviceConfig);
}

function checkBlockUpdate() {
    if (!serviceConfig || wsapi === null) return;
    logDebug('-> blockUpdater: fetching block update');
    wsapi.getStatus().then((blockStatus) => {
        let lastConStatus = workerStatus.CONNECTED;
        let conFailed = parseInt(blockStatus.knownBlockCount, 10) === 1;
        if (conFailed) {
            logDebug('-> blockUpdater: Got bad known block count, mark connection as broken');
            if (lastConStatus !== conFailed) {
                process.send({
                    type: 'blockUpdated',
                    data: {
                        blockCount: syncStatus.NODE_ERROR,
                        knownBlockCount: syncStatus.NODE_ERROR,
                        displayBlockCount: syncStatus.NODE_ERROR,
                        displayKnownBlockCount: syncStatus.NODE_ERROR,
                        syncPercent: syncStatus.NODE_ERROR
                    }
                });
            }
            workerStatus.CONNECTED = false;
            return;
        }

        // we have good connection
        workerStatus.CONNECTED = true;
        workerStatus.FAILED_COUNT = 0;
        let blockCount = parseInt(blockStatus.blockCount, 10);
        let knownBlockCount = parseInt(blockStatus.knownBlockCount, 10);

        let blockCountUpdated = (blockCount > walletStatus.LAST_BLOCK_COUNT);
        let knownBlockCountUpdated = (knownBlockCount > walletStatus.LAST_KNOWN_BLOCK_COUNT);
        if (!blockCountUpdated && !knownBlockCountUpdated && walletStatus.TX_CHECK_SKIPPED_COUNT < 8) {
            logDebug(`-> blockUpdater: no update, skip block notifier (${walletStatus.TX_CHECK_SKIPPED_COUNT})`);
            walletStatus.TX_CHECK_SKIPPED_COUNT += 1;
            return;
        }

        walletStatus.TX_CHECK_SKIPPED_COUNT = 0;
        logDebug('-> blockUpdater: block updated, notify block update');
        let txcheck = (walletStatus.LAST_KNOWN_BLOCK_COUNT < knownBlockCount || walletStatus.LAST_BLOCK_COUNT < knownBlockCount);
        walletStatus.LAST_BLOCK_COUNT = blockCount;
        walletStatus.LAST_KNOWN_BLOCK_COUNT = knownBlockCount;

        // add any extras here, so renderer not doing too much things
        let dispKnownBlockCount = (knownBlockCount - 1);
        let dispBlockCount = (blockCount > dispKnownBlockCount ? dispKnownBlockCount : blockCount);
        let syncPercent = ((dispBlockCount / dispKnownBlockCount) * 100);
        if (syncPercent <= 0 || syncPercent >= 99.995) {
            syncPercent = 100;
        } else {
            syncPercent = parseInt(syncPercent.toFixed(2));
        }

        blockStatus.displayBlockCount = dispBlockCount;
        blockStatus.displayKnownBlockCount = dispKnownBlockCount;
        blockStatus.syncPercent = syncPercent;
        process.send({
            type: 'blockUpdated',
            data: blockStatus
        });

        // don't check if we can't get any block
        if (walletStatus.LAST_BLOCK_COUNT <= 1) return;

        // don't check tx if block count not updated
        if (!txcheck && workerStatus.TX_CHECK_INITIALIZED) {
            logDebug('-> blockUpdater: Tx check skipped');
            return;
        }

        checkTransactionsUpdate();

    }).catch((err) => {
        workerStatus.FAILED_COUNT++;
        logDebug(`-> blockUpdater: FAILED, ${err.message} | failed count: ${workerStatus.FAILED_COUNT}`);
        if (workerStatus.FAILED_COUNT > SYNC_FAILED_MAX) {
            logDebug('-> blockUpdater: too many timeout, mark connection as broken');
            process.send({
                type: 'blockUpdated',
                data: {
                    blockCount: syncStatus.NODE_ERROR,
                    knownBlockCount: syncStatus.NODE_ERROR,
                    displayBlockCount: syncStatus.NODE_ERROR,
                    displayKnownBlockCount: syncStatus.NODE_ERROR,
                    syncPercent: syncStatus.NODE_ERROR
                }
            });
            workerStatus.STATE_CONNECTED = false;
            return;
        }
        return false;
    });
}

function checkTransactionsUpdate() {
    if (!serviceConfig || wsapi === null) return;

    wsapi.getBalance().then((balance) => {
        process.send({
            type: 'balanceUpdated',
            data: balance
        });

        if (walletStatus.LAST_BLOCK_COUNT > 1) {
            logDebug('-> txUpdater: checking tx update');
            let currentBLockCount = walletStatus.LAST_BLOCK_COUNT - 1;
            let startIndex = (!workerStatus.TX_CHECK_INITIALIZED ? 1 : walletStatus.TX_LAST_INDEX);
            let searchCount = currentBLockCount;
            let needCountMargin = false;
            let blockMargin = 10;
            if (workerStatus.TX_CHECK_INITIALIZED) {
                searchCount = (currentBLockCount - walletStatus.TX_LAST_COUNT);
                needCountMargin = true;
            }

            let startIndexWithMargin = (startIndex === 1 ? 1 : (startIndex - blockMargin));
            let searchCountWithMargin = needCountMargin ? searchCount + blockMargin : searchCount;
            let trx_args = {
                firstBlockIndex: startIndexWithMargin,
                blockCount: searchCountWithMargin
            };
            logDebug(`-> txUpdater: args=${JSON.stringify(trx_args)}`);
            wsapi.getTransactions(trx_args).then((trx) => {
                process.send({
                    type: 'transactionUpdated',
                    data: trx
                });
                saveWallet();
                return true;
            }).catch((err) => {
                logDebug(`-> txUpdater: getTransactions FAILED, ${err.message}`);
                return false;
            });
            workerStatus.TX_CHECK_INITIALIZED = true;
            walletStatus.TX_LAST_INDEX = currentBLockCount;
            walletStatus.TX_LAST_COUNT = currentBLockCount;
        }
    }).catch((err) => {
        logDebug(`-> txUpdater: getBalance FAILED, ${err.message}`);
        return false;
    });
}

function saveWallet() {
    if (!serviceConfig) return;
    if (workerStatus.SAVE_TICK < 5) {
        workerStatus.SAVE_TICK += 1;
        return;
    }
    workerStatus.SAVE_TICK = 0;
    logDebug(`-> saveWallet: saving wallet`);
    wsapi.save().then(() => {
        return true;
    }).catch(() => {
        return false;
    });
}

function syncWallet() {
    taskWorker = setInterval(() => {
        if (workerStatus.PAUSED) return;
        logDebug(`Wallet sync tasks...`);
        checkBlockUpdate();
    }, SYNC_INTERVAL);
}

// {type: 'blah', msg: 'any'}
process.on('message', (msg) => {
    let cmd = msg || '';
    cmd.type = msg.type || 'cfg';
    cmd.data = msg.data || null;

    switch (cmd.type) {
        case 'cfg':
            if (cmd.data) {
                serviceConfig = cmd.data;
                initApi(serviceConfig);
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

            // initial check, only to get balance
            checkTransactionsUpdate();

            setTimeout(syncWallet, 5000);
            break;
        case 'pause':
            if (workerStatus.PAUSED) return;
            logDebug('Got suspend command');
            process.send({
                type: 'blockUpdated',
                data: {
                    blockCount: syncStatus.NET_OFFLINE,
                    knownBlockCount: syncStatus.NET_OFFLINE,
                    displayBlockCount: syncStatus.NET_OFFLINE,
                    displayKnownBlockCount: syncStatus.NET_OFFLINE,
                    syncPercent: syncStatus.NET_OFFLINE
                }
            });
            workerStatus.PAUSED = true;
            break;
        case 'resume':
            logDebug('Got resume command');
            walletStatus.TX_CHECK_SKIPPED_COUNT = 5;
            wsapi = null;
            initApi(serviceConfig);
            setTimeout(() => {
                wsapi.getBalance().then(() => {
                    logDebug(`Warming up: getBalance OK`);
                }).catch((err) => {
                    logDebug(`Warming up: getBalance FAILED, ${err.message}`);
                });
                workerStatus.PAUSED = false;
            }, 15000);

            process.send({
                type: 'blockUpdated',
                data: {
                    blockCount: syncStatus.NET_ONLINE,
                    knownBlockCount: syncStatus.NET_ONLINE,
                    displayBlockCount: syncStatus.NET_ONLINE,
                    displayKnownBlockCount: syncStatus.NET_ONLINE,
                    syncPercent: syncStatus.NET_ONLINE
                }
            });
            break;
        case 'stop':
            logDebug('Got stop command, halting all tasks and exit...');
            walletStatus.TX_SKIPPED_COUNT = 0;
            serviceConfig = wsapi = null;
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