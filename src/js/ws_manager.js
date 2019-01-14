const path = require('path');
const fs = require('fs');
const os = require('os');
const childProcess = require('child_process');
const log = require('electron-log');
const Store = require('electron-store');
const WalletShellSession = require('./ws_session');
const WalletShellApi = require('./ws_api');
const uiupdater = require('./wsui_updater');
const wsutil = require('./ws_utils');
const config = require('./ws_config');

const settings = new Store({ name: 'Settings' });
const wsession = new WalletShellSession();

const SERVICE_LOG_DEBUG = wsession.get('debug');
const SERVICE_LOG_LEVEL_DEFAULT = 0;
const SERVICE_LOG_LEVEL_DEBUG = 4;
const SERVICE_LOG_LEVEL = (SERVICE_LOG_DEBUG ? SERVICE_LOG_LEVEL_DEBUG : SERVICE_LOG_LEVEL_DEFAULT);

const ERROR_WALLET_EXEC = `Failed to start ${config.walletServiceBinaryFilename}. Set the path to ${config.walletServiceBinaryFilename} properly in the settings tab.`;
const ERROR_WALLET_PASSWORD = 'Failed to load your wallet, please check your password';
const ERROR_WALLET_IMPORT = 'Import failed, please check that you have entered all information correctly';
const ERROR_WALLET_CREATE = 'Wallet can not be created, please check your input and try again';
const ERROR_RPC_TIMEOUT = 'Unable to communicate with selected node, please try again using different node';
const INFO_FUSION_DONE = 'Wallet optimization completed, your balance may appear incorrect for a while.';
const INFO_FUSION_SKIPPED = 'Wallet already optimized. No further optimization is needed.';
const ERROR_FUSION_FAILED = 'Unable to optimize your wallet, please try again in a few seconds';

var WalletShellManager = function () {
    if (!(this instanceof WalletShellManager)) {
        return new WalletShellManager();
    }

    this.daemonHost = settings.get('daemon_host');
    this.daemonPort = settings.get('daemon_port');
    this.serviceProcess = null;
    this.serviceBin = settings.get('service_bin');
    this.servicePassword = settings.get('service_password');
    this.serviceHost = settings.get('service_host');
    this.servicePort = settings.get('service_port');
    this.serviceArgsDefault = ['--rpc-password', settings.get('service_password')];
    this.walletConfigDefault = { 'rpc-password': settings.get('service_password') };
    this.servicePid = null;
    this.serviceLastPid = null;
    this.serviceActiveArgs = [];
    this.serviceApi = null;
    this.syncWorker = null;
    this.fusionTxHash = [];
};

WalletShellManager.prototype.init = function () {
    this._getSettings();
    if (this.serviceApi !== null) return;

    let cfg = {
        service_host: this.serviceHost,
        service_port: this.servicePort,
        service_password: this.servicePassword
    };
    this.serviceApi = new WalletShellApi(cfg);
};

WalletShellManager.prototype._getSettings = function () {
    this.daemonHost = settings.get('daemon_host');
    this.daemonPort = settings.get('daemon_port');
    this.serviceBin = settings.get('service_bin');
};

WalletShellManager.prototype._reinitSession = function () {
    wsession.reset();
    // remove wallet config
    let configFile = wsession.get('walletConfig');
    if (configFile) try { fs.unlinkSync(configFile); } catch (e) { }
    this.notifyUpdate({
        type: 'sectionChanged',
        data: 'reset-oy'
    });
};

// check 
WalletShellManager.prototype.serviceStatus = function () {
    return (undefined !== this.serviceProcess && null !== this.serviceProcess);
};

WalletShellManager.prototype.isRunning = function () {
    this.init();
    let proc = path.basename(this.serviceBin);
    let platform = process.platform;
    let cmd = '';
    switch (platform) {
        case 'win32': cmd = `tasklist`; break;
        case 'darwin': cmd = `ps -ax | grep ${proc}`; break;
        case 'linux': cmd = `ps -A`; break;
        default: break;
    }
    if (cmd === '' || proc === '') return false;

    childProcess.exec(cmd, (err, stdout, stderr) => {
        if (err) log.debug(err.message);
        if (stderr) log.debug(stderr.toLocaleLowerCase());
        let found = stdout.toLowerCase().indexOf(proc.toLowerCase()) > -1;
        log.debug(`Process found: ${found}`);
        return found;
    });
};

WalletShellManager.prototype._writeIniConfig = function (cfg) {
    let configFile = wsession.get('walletConfig');
    if (!configFile) return '';

    try {
        fs.writeFileSync(configFile, cfg);
        return configFile;
    } catch (err) {
        log.error(err);
        return '';
    }
};

WalletShellManager.prototype._writeConfig = function (cfg) {
    let configFile = wsession.get('walletConfig');
    if (!configFile) return '';

    cfg = cfg || {};
    if (!cfg) return '';

    let configData = '';
    Object.keys(cfg).map((k) => { configData += `${k}=${cfg[k]}${os.EOL}`; });
    try {
        fs.writeFileSync(configFile, configData);
        return configFile;
    } catch (err) {
        log.error(err);
        return '';
    }
};

WalletShellManager.prototype.startService = function (walletFile, password, onError, onSuccess, onDelay) {
    this.init();

    if (null !== this.serviceLastPid) {
        // try to kill last process, in case it was stalled
        log.debug(`Trying to clean up old/stalled process, target pid: ${this.serviceLastPid}`);
        try {
            process.kill(this.serviceLastPid, 'SIGKILL');
        } catch (e) { }
    }

    if (this.syncWorker) this.stopSyncWorker();

    let serviceArgs = this.serviceArgsDefault.concat([
        '-w', walletFile,
        '-p', password,
        '--log-level', 0,
        '--address'
    ]);

    let wsm = this;

    childProcess.execFile(this.serviceBin, serviceArgs, (error, stdout, stderr) => {
        if (stderr) log.error(stderr);

        if (error) {
            log.error(error.message);
            onError(`ERROR_WALLET_EXEC: ${error.message}`);
        } else {
            log.debug(stdout);
            if (stdout && stdout.length && stdout.indexOf(config.addressPrefix) !== -1) {
                let trimmed = stdout.trim();
                let walletAddress = trimmed.substring(trimmed.indexOf(config.addressPrefix), trimmed.length);
                wsession.set('loadedWalletAddress', walletAddress);
                wsm._spawnService(walletFile, password, onError, onSuccess, onDelay);
            } else {
                // just stop here
                onError(ERROR_WALLET_PASSWORD);
            }
        }
    }
    );
};

WalletShellManager.prototype._argsToIni = function (args) {
    let configData = "";
    if ("object" !== typeof args || !args.length) return configData;
    args.forEach((k, v) => {
        let sep = ((v % 2) === 0) ? os.EOL : "=";
        configData += `${sep}${k.toString().replace('--', '')}`;
    });
    return configData.trim();
};

WalletShellManager.prototype._spawnService = function (walletFile, password, onError, onSuccess, onDelay) {
    this.init();
    let file = path.basename(walletFile);
    let logFile = path.join(
        path.dirname(walletFile),
        `${file.split(' ').join('').split('.')[0]}.log`
    );

    let serviceArgs = this.serviceArgsDefault.concat([
        '--container-file', walletFile,
        '--container-password', password,
        '--enable-cors', '*',
        '--daemon-address', this.daemonHost,
        '--daemon-port', this.daemonPort,
        '--log-level', SERVICE_LOG_LEVEL
    ]);

    if (SERVICE_LOG_LEVEL > 0) {
        serviceArgs.push('--log-file');
        serviceArgs.push(logFile);
    }


    let configFile = wsession.get('walletConfig', null);
    if (configFile) {
        let configFormat = settings.get('service_config_format', 'ini');
        if (configFormat === 'json') {
            childProcess.execFile(this.serviceBin, serviceArgs.concat(['--save-config', configFile]), (error) => {
                if (error) configFile = null;
            });
        } else {
            let newConfig = this._argsToIni(serviceArgs);
            configFile = this._writeIniConfig(newConfig);
        }
        serviceArgs = ['--config', configFile];
    } else {
        log.warn('Failed to create config file, fallback to cmd args ');
    }

    let wsm = this;
    log.debug('Starting service...');
    try {
        this.serviceProcess = childProcess.spawn(wsm.serviceBin, serviceArgs);
        this.servicePid = this.serviceProcess.pid;
    } catch (e) {
        if (onError) onError(ERROR_WALLET_EXEC);
        log.error(`${config.walletServiceBinaryFilename} is not running`);
        return false;
    }

    this.serviceProcess.on('close', () => {
        this.terminateService(true);
        log.debug(`${config.walletServiceBinaryFilename} closed`);
    });

    this.serviceProcess.on('error', (err) => {
        this.terminateService(true);
        wsm.syncWorker.stopSyncWorker();
        log.error(`${config.walletServiceBinaryFilename} error: ${err.message}`);
    });

    if (!this.serviceStatus()) {
        if (onError) onError(ERROR_WALLET_EXEC);
        log.error(`${config.walletServiceBinaryFilename} is not running`);
        return false;
    }

    let TEST_OK = false;
    let MAX_CHECK = 20;
    function testConnection(retry) {
        wsm.serviceApi.getAddress().then((address) => {
            log.debug('Got an address, connection ok!');
            if (!TEST_OK) {
                wsm.serviceActiveArgs = serviceArgs;
                // update session
                wsession.set('loadedWalletAddress', address);
                wsession.set('serviceReady', true);
                wsession.set('connectedNode', `${settings.get('daemon_host')}:${settings.get('daemon_port')}`);
                // start the worker here?
                wsm.startSyncWorker();
                wsm.notifyUpdate({
                    type: 'addressUpdated',
                    data: address
                });

                onSuccess(walletFile);
                TEST_OK = true;
            }
            return true;
        }).catch((err) => {
            log.debug('Connection failed or timeout');
            log.debug(err.message);
            if (retry === 10 && onDelay) onDelay(`Still no respond from ${config.walletServiceBinaryFilename}, please wait a few more seconds...`);
            if (retry >= MAX_CHECK && !TEST_OK) {
                if (wsm.serviceStatus()) {
                    wsm.terminateService();
                }
                wsm.serviceActiveArgs = [];
                onError(ERROR_RPC_TIMEOUT);
                return false;
            } else {
                setTimeout(function () {
                    let nextTry = retry + 1;
                    log.debug(`retrying testconn (${nextTry})`);
                    testConnection(nextTry);
                }, 1200);
            }
        });
    }

    setTimeout(function () {
        log.debug('performing connection test');
        testConnection(0);
    }, 15000);
};

WalletShellManager.prototype.stopService = function () {
    log.debug('stopping service');
    this.init();
    let wsm = this;
    return new Promise(function (resolve) {
        if (wsm.serviceStatus()) {
            log.debug("Service is running");
            wsm.serviceLastPid = wsm.serviceProcess.pid;
            wsm.stopSyncWorker(true);
            wsm.serviceApi.save().then(() => {
                log.debug('saving wallet');
                try {
                    wsm.terminateService(true);
                    wsm._reinitSession();
                    resolve(true);
                } catch (err) {
                    log.debug(`SIGTERM failed: ${err.message}`);
                    wsm.terminateService(true);
                    wsm._reinitSession();
                    resolve(false);
                }
            }).catch((err) => {
                log.debug(`Failed to save wallet: ${err.message}`);
                // try to wait for save to completed before force killing
                setTimeout(() => {
                    wsm.terminateService(true); // force kill
                    wsm._reinitSession();
                    resolve(true);
                }, 10000);
            });
        } else {
            console.log("Service is not running");
            wsm._reinitSession();
            resolve(false);
        }
    });
};

WalletShellManager.prototype.terminateService = function (force) {
    if (!this.serviceStatus()) return;
    force = force || false;
    let signal = force ? 'SIGKILL' : 'SIGTERM';
    // ugly!
    this.serviceLastPid = this.servicePid;
    try {
        this.serviceProcess.kill(signal);
        if (this.servicePid) process.kill(this.servicePid, signal);
    } catch (e) {
        if (!force && this.serviceProcess) {
            log.debug(`SIGKILLing ${config.walletServiceBinaryFilename}`);
            try { this.serviceProcess.kill('SIGKILL'); } catch (err) { }
            if (this.servicePid) {
                try { process.kill(this.servicePid, 'SIGKILL'); } catch (err) { }
            }
        }
    }

    this.serviceProcess = null;
    this.servicePid = null;
};

WalletShellManager.prototype.startSyncWorker = function () {
    this.init();
    let wsm = this;
    if (this.syncWorker !== null) {
        this.syncWorker = null;
        try { wsm.syncWorker.kill('SIGKILL'); } catch (e) { }
    }

    this.syncWorker = childProcess.fork(
        path.join(__dirname, './ws_syncworker.js')
    );

    this.syncWorker.on('message', (msg) => {
        if (msg.type === 'serviceStatus') {
            wsm.syncWorker.send({
                type: 'start',
                data: {}
            });
            wsession.set('serviceReady', true);
            wsession.set('syncStarted', true);
        } else {
            wsm.notifyUpdate(msg);
        }
    });

    this.syncWorker.on('close', function () {
        wsm.syncWorker = null;
        try { wsm.syncWorker.kill('SIGKILL'); } catch (e) { }
        log.debug(`service worker terminated.`);
    });

    this.syncWorker.on('exit', function () {
        wsm.syncWorker = null;
        log.debug(`service worker exited.`);
    });

    this.syncWorker.on('error', function (err) {
        try { wsm.syncWorker.kill('SIGKILL'); } catch (e) { }
        wsm.syncWorker = null;
        log.debug(`service worker error: ${err.message}`);
    });

    let cfgData = {
        type: 'cfg',
        data: {
            service_host: this.serviceHost,
            service_port: this.servicePort,
            service_password: this.servicePassword
        },
        debug: SERVICE_LOG_DEBUG
    };
    this.syncWorker.send(cfgData);
};

WalletShellManager.prototype.stopSyncWorker = function () {
    //if (null === this.syncWorker) return;
    log.debug('stopping syncworker');

    try {
        this.syncWorker.send({ type: 'stop', data: {} });
        this.syncWorker.kill('SIGTERM');
        this.syncWorker = null;
    } catch (e) {
        log.debug(`syncworker already stopped`);
    }
};

WalletShellManager.prototype.getNodeFee = function () {
    let wsm = this;

    this.serviceApi.getFeeInfo().then((res) => {
        let theFee;
        if (!res.amount || !res.address) {
            theFee = 0;
        } else {
            theFee = (res.amount / config.decimalDivisor);
        }
        wsession.set('nodeFee', theFee);
        if (theFee <= 0) return theFee;

        wsm.notifyUpdate({
            type: 'nodeFeeUpdated',
            data: theFee
        });
        return theFee;
    }).catch((err) => {
        log.debug(`failed to get node fee: ${err.message}`);
    });
};

WalletShellManager.prototype.genIntegratedAddress = function (paymentId, address) {
    let wsm = this;
    return new Promise((resolve, reject) => {
        address = address || wsession.get('loadedWalletAddress');
        let params = { address: address, paymentId: paymentId };
        wsm.serviceApi.createIntegratedAddress(params).then((result) => {
            return resolve(result);
        }).catch((err) => {
            return reject(err);
        });
    });
};

WalletShellManager.prototype.createWallet = function (walletFile, password) {
    this.init();
    let wsm = this;
    return new Promise((resolve, reject) => {
        let serviceArgs = wsm.serviceArgsDefault.concat(
            ['-g', '-w', walletFile, '-p', password]
        );
        childProcess.execFile(
            wsm.serviceBin, serviceArgs, (error, stdout, stderr) => {
                if (stdout) log.debug(stdout);
                if (stderr) log.error(stderr);
                if (error) {
                    log.error(`Failed to create wallet: ${error.message}`);
                    return reject(new Error(ERROR_WALLET_CREATE));
                } else {
                    if (!wsutil.isRegularFileAndWritable(walletFile)) {
                        log.error(`${walletFile} is invalid or unreadable`);
                        return reject(new Error(ERROR_WALLET_CREATE));
                    }
                    return resolve(walletFile);
                }
            }
        );
    });
};

WalletShellManager.prototype.importFromKeys = function (walletFile, password, viewKey, spendKey, scanHeight) {
    this.init();
    let wsm = this;
    return new Promise((resolve, reject) => {
        scanHeight = scanHeight || 0;

        let serviceArgs = wsm.serviceArgsDefault.concat([
            '-g', '-w', walletFile, '-p', password,
            '--view-key', viewKey, '--spend-key', spendKey,
        ]);

        if (scanHeight > 1024) serviceArgs = serviceArgs.concat(['--scan-height', scanHeight]);

        childProcess.execFile(
            wsm.serviceBin, serviceArgs, (error, stdout, stderr) => {
                if (stdout) log.debug(stdout);
                if (stderr) log.error(stderr);
                if (error) {
                    log.debug(`Failed to import key: ${error.message}`);
                    return reject(new Error(ERROR_WALLET_IMPORT));
                } else {
                    if (!wsutil.isRegularFileAndWritable(walletFile)) {
                        return reject(new Error(ERROR_WALLET_IMPORT));
                    }
                    return resolve(walletFile);
                }
            }
        );

    });
};

WalletShellManager.prototype.importFromSeed = function (walletFile, password, mnemonicSeed, scanHeight) {
    this.init();
    let wsm = this;
    return new Promise((resolve, reject) => {
        scanHeight = scanHeight || 0;

        let serviceArgs = wsm.serviceArgsDefault.concat([
            '-g', '-w', walletFile, '-p', password,
            '--mnemonic-seed', mnemonicSeed,
        ]);

        if (scanHeight > 1024) serviceArgs = serviceArgs.concat(['--scan-height', scanHeight]);

        childProcess.execFile(
            wsm.serviceBin, serviceArgs, (error, stdout, stderr) => {
                if (stdout) log.debug(stdout);
                if (stderr) log.error(stderr);

                if (error) {
                    log.debug(`Error importing seed: ${error.message}`);
                    return reject(new Error(ERROR_WALLET_IMPORT));
                } else {
                    if (!wsutil.isRegularFileAndWritable(walletFile)) {
                        return reject(new Error(ERROR_WALLET_IMPORT));
                    }
                    return resolve(walletFile);
                }
            }
        );
    });
};

WalletShellManager.prototype.getSecretKeys = function (address) {
    let wsm = this;
    return new Promise((resolve, reject) => {
        wsm.serviceApi.getBackupKeys({ address: address }).then((result) => {
            return resolve(result);
        }).catch((err) => {
            log.debug(`Failed to get keys: ${err.message}`);
            return reject(err);
        });
    });
};

WalletShellManager.prototype.sendTransaction = function (params) {
    let wsm = this;
    return new Promise((resolve, reject) => {
        wsm.serviceApi.sendTransaction(params).then((result) => {
            return resolve(result);
        }).catch((err) => {
            return reject(err);
        });
    });
};

WalletShellManager.prototype._fusionGetMinThreshold = function (threshold, minThreshold, maxFusionReadyCount, counter) {
    let wsm = this;
    return new Promise((resolve, reject) => {
        counter = counter || 0;
        threshold = threshold || (parseInt(wsession.get('walletUnlockedBalance'), 10) * 100) + 1;
        threshold = parseInt(threshold, 10);
        minThreshold = minThreshold || threshold;
        maxFusionReadyCount = maxFusionReadyCount || 0;

        let maxThreshCheckIter = 20;

        wsm.serviceApi.estimateFusion({ threshold: threshold }).then((res) => {
            // nothing to optimize
            if (counter === 0 && res.fusionReadyCount === 0) return resolve(0);
            // stop at maxThreshCheckIter or when threshold too low
            if (counter > maxThreshCheckIter || threshold < 10) return resolve(minThreshold);
            // we got a possibly best minThreshold
            if (res.fusionReadyCount < maxFusionReadyCount) {
                return resolve(minThreshold);
            }
            // continue to find next best minThreshold
            maxFusionReadyCount = res.fusionReadyCount;
            minThreshold = threshold;
            threshold /= 2;
            counter += 1;
            resolve(wsm._fusionGetMinThreshold(threshold, minThreshold, maxFusionReadyCount, counter).then((res) => {
                return res;
            }));
        }).catch((err) => {
            return reject(new Error(err));
        });
    });
};

WalletShellManager.prototype._fusionSendTx = function (threshold, counter) {
    let wsm = this;
    return new Promise((resolve, reject) => {
        counter = counter || 0;
        let maxIter = 256;
        if (counter >= maxIter) return resolve(wsm.fusionTxHash); // stop at max iter

        // keep sending fusion tx till it hit IOOR or reaching max iter 
        log.debug(`send fusion tx, iteration: ${counter}`);
        wsm.serviceApi.sendFusionTransaction({ threshold: threshold }).then((resp) => {
            wsm.fusionTxHash.push(resp.transactionHash);
            counter += 1;
            return resolve(wsm._fusionSendTx(threshold, counter).then((resp) => {
                return resp;
            }));
        }).catch((err) => {
            return reject(new Error(err));
        });
    });
};

WalletShellManager.prototype.optimizeWallet = function () {
    let wsm = this;
    return new Promise((resolve, reject) => {
        wsm.fusionTxHash = [];
        wsm._fusionGetMinThreshold().then((res) => {
            if (res <= 0) {
                wsm.notifyUpdate({
                    type: 'fusionTxCompleted',
                    data: INFO_FUSION_SKIPPED
                });
                return resolve(INFO_FUSION_SKIPPED);
            }

            log.debug(`performing fusion tx, threshold: ${res}`);
            return resolve(
                wsm._fusionSendTx(res).then(() => {
                    wsm.notifyUpdate({
                        type: 'fusionTxCompleted',
                        data: INFO_FUSION_DONE
                    });
                    return INFO_FUSION_DONE;
                }).catch((err) => {
                    let msg = err.message.toLowerCase();
                    let outMsg = ERROR_FUSION_FAILED;
                    switch (msg) {
                        case 'index is out of range':
                            outMsg = wsm.fusionTxHash.length >= 1 ? INFO_FUSION_DONE : INFO_FUSION_SKIPPED;
                            break;
                        default:
                            break;
                    }
                    wsm.notifyUpdate({
                        type: 'fusionTxCompleted',
                        data: outMsg
                    });
                    return outMsg;
                })
            );
        }).catch((err) => {
            return reject((err.message));
        });
    });
};

WalletShellManager.prototype.networkStateUpdate = function (state) {
    if (!this.syncWorker) return;
    log.debug('ServiceProcess PID: ' + this.servicePid);
    if (state === 0) {
        // pause the syncworker, but leave service running
        this.syncWorker.send({
            type: 'pause',
            data: null
        });
    } else {
        this.init();
        // looks like turtle-service always stalled after disconnected, just kill & relaunch it
        let pid = this.serviceProcess.pid || null;
        this.terminateService();
        // wait a bit
        setImmediate(() => {
            if (pid) {
                try { process.kill(pid, 'SIGKILL'); } catch (e) { }
            }
            setTimeout(() => {
                log.debug(`respawning ${config.walletServiceBinaryFilename}`);
                this.serviceProcess = childProcess.spawn(this.serviceBin, this.serviceActiveArgs);
                // store new pid
                this.servicePid = this.serviceProcess.pid;
                this.syncWorker.send({
                    type: 'resume',
                    data: null
                });
            }, 15000);
        }, 2500);
    }
};

WalletShellManager.prototype.notifyUpdate = function (msg) {
    uiupdater.updateUiState(msg);
};

WalletShellManager.prototype.resetState = function () {
    return this._reinitSession();
};

module.exports = WalletShellManager;