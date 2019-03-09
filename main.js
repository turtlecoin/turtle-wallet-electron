const { app, dialog, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const https = require('https');
const platform = require('os').platform();
const crypto = require('crypto');
const Store = require('electron-store');
const settings = new Store({ name: 'Settings' });
const log = require('electron-log');
const splash = require('@trodi/electron-splashscreen');
const config = require('./src/js/ws_config');

const IS_DEV = (process.argv[1] === 'dev' || process.argv[2] === 'dev');
const IS_DEBUG = IS_DEV || process.argv[1] === 'debug' || process.argv[2] === 'debug';
const LOG_LEVEL = IS_DEBUG ? 'debug' : 'warn';
const WALLET_CFGFILE = path.join(app.getPath('userData'), 'wconfig.txt');

const WALLETSHELL_VERSION = app.getVersion() || '0.3.x';
const SERVICE_FILENAME = (platform === 'win32' ? `${config.walletServiceBinaryFilename}.exe` : config.walletServiceBinaryFilename);
const SERVICE_OSDIR = (platform === 'win32' ? 'win' : (platform === 'darwin' ? 'osx' : 'lin'));
const DEFAULT_SERVICE_BIN = path.join(process.resourcesPath, 'bin', SERVICE_OSDIR, SERVICE_FILENAME);

const DEFAULT_REMOTE_NODE = config.remoteNodeListFallback
    .map((a) => ({ sort: Math.random(), value: a }))
    .sort((a, b) => a.sort - b.sort)
    .map((a) => a.value)[0];

const DEFAULT_SETTINGS = {
    service_bin: DEFAULT_SERVICE_BIN,
    service_host: '127.0.0.1',
    service_port: config.walletServiceRpcPort,
    service_password: 'passwrd',
    service_timeout: 30,
    node_address: DEFAULT_REMOTE_NODE,
    pubnodes_last_updated: 946697799000,
    pubnodes_data: config.remoteNodeListFallback,
    pubnodes_custom: ['localhost:10002'],
    pubnodes_exclude_offline: false,
    tray_minimize: false,
    tray_close: false,
    darkmode: true,
    service_config_format: config.walletServiceConfigFormat
};
const DEFAULT_SIZE = { width: 840, height: 680 };
const WIN_TITLE = `${config.appName} ${WALLETSHELL_VERSION} - ${config.appDescription}`;

app.prompExit = true;
app.prompShown = false;
app.needToExit = false;
app.debug = IS_DEBUG;
app.walletConfig = WALLET_CFGFILE;
app.publicNodesUpdated = false;
app.setAppUserModelId(config.appId);

log.transports.console.level = LOG_LEVEL;
log.transports.file.level = LOG_LEVEL;
log.transports.file.maxSize = 5 * 1024 * 1024;
log.info(`Starting WalletShell ${WALLETSHELL_VERSION}`);
if (IS_DEV || IS_DEBUG) log.warn(`Running in ${IS_DEV ? 'dev' : 'debug'} mode`);

let trayIcon = path.join(__dirname, 'src/assets/tray.png');
let trayIconHide = path.join(__dirname, 'src/assets/trayon.png');

let win;
let tray;

function createWindow() {
    // Create the browser window.
    let darkmode = settings.get('darkmode', true);
    let bgColor = darkmode ? '#000000' : '#02853E';

    const winOpts = {
        title: WIN_TITLE,
        icon: path.join(__dirname, 'src/assets/walletshell_icon.png'),
        frame: true,
        width: DEFAULT_SIZE.width,
        height: DEFAULT_SIZE.height,
        minWidth: DEFAULT_SIZE.width,
        minHeight: DEFAULT_SIZE.height,
        show: false,
        backgroundColor: bgColor,
        center: true,
        autoHideMenuBar: false,
        menuBarVisibility: false,
        webPreferences: {
            nativeWindowOpen: true,
            nodeIntegrationInWorker: true,
        },
    };

    win = splash.initSplashScreen({
        windowOpts: winOpts,
        templateUrl: path.join(__dirname, "src/html/splash.html"),
        delay: 0,
        minVisible: 800,
        splashScreenOpts: {
            width: 425,
            height: 325,
            transparent: true
        },
    });

    //load the index.html of the app.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'src/html/index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // open devtools
    if (IS_DEV) win.webContents.openDevTools();

    // show windosw
    win.once('ready-to-show', () => {
        //win.show();
        win.setTitle(WIN_TITLE);
        if (platform !== 'darwin') {
            tray.setToolTip(config.appSlogan);
        }
    });

    win.on('close', (e) => {
        if ((settings.get('tray_close') && !app.needToExit && platform !== 'darwin')) {
            e.preventDefault();
            win.hide();
        } else if (app.prompExit) {
            e.preventDefault();
            if (app.prompShown) return;
            let msg = 'Are you sure want to exit?';
            app.prompShown = true;
            dialog.showMessageBox({
                type: 'question',
                buttons: ['Yes', 'No'],
                title: 'Exit Confirmation',
                message: msg
            }, function (response) {
                app.prompShown = false;
                if (response === 0) {
                    app.prompExit = false;
                    win.webContents.send('cleanup', 'Clean it up, Dad!');
                } else {
                    app.prompExit = true;
                    app.needToExit = false;
                }
            });
        }
    });

    if (platform !== 'darwin') {
        let contextMenu = Menu.buildFromTemplate([
            { label: 'Minimize to tray', click: () => { win.hide(); } },
            {
                label: 'Quit', click: () => {
                    app.needToExit = true;
                    if (win) {
                        win.close();
                    } else {
                        process.exit(0);
                    }
                }
            }
        ]);

        tray = new Tray(trayIcon);
        tray.setPressedImage(trayIconHide);
        tray.setTitle(config.appName);
        tray.setToolTip(config.appSlogan);
        tray.setContextMenu(contextMenu);


        tray.on('click', () => {
            if (!win.isFocused() && win.isVisible()) {
                win.focus();
            } else if (settings.get('tray_minimize', false)) {
                if (win.isVisible()) {
                    win.hide();
                } else {
                    win.show();
                }
            } else {
                if (win.isMinimized()) {
                    win.restore();
                    win.focus();
                } else {
                    win.minimize();
                }
            }
        });

        win.on('show', () => {
            tray.setHighlightMode('always');
            tray.setImage(trayIcon);
            contextMenu = Menu.buildFromTemplate([
                { label: 'Minimize to tray', click: () => { win.hide(); } },
                {
                    label: 'Quit', click: () => {
                        app.needToExit = true;
                        win.close();
                    }
                }
            ]);
            tray.setContextMenu(contextMenu);
            tray.setToolTip(config.appSlogan);
        });

        win.on('hide', () => {
            tray.setHighlightMode('never');
            tray.setImage(trayIconHide);
            if (platform === 'darwin') return;

            contextMenu = Menu.buildFromTemplate([
                { label: 'Restore', click: () => { win.show(); } },
                {
                    label: 'Quit', click: () => {
                        app.needToExit = true;
                        win.close();
                    }
                }
            ]);
            tray.setContextMenu(contextMenu);
        });

        win.on('minimize', (event) => {
            if (settings.get('tray_minimize') && platform !== 'darwin') {
                event.preventDefault();
                win.hide();
            }
        });
    }

    win.on('closed', () => {
        win = null;
    });

    win.setMenu(null);

    // misc handler
    win.webContents.on('crashed', () => {
        // todo: prompt to restart
        log.debug('webcontent was crashed');
    });

    win.on('unresponsive', () => {
        // todo: prompt to restart
        log.debug('webcontent is unresponsive');
    });
}

function storeNodeList(pnodes) {
    pnodes = pnodes || settings.get('pubnodes_data');
    let validNodes = [];
    if (pnodes.hasOwnProperty('nodes')) {
        pnodes.nodes.forEach(addr => {
            let item = `${addr.url}:${addr.port}`;
            validNodes.push(item);
        });
    }
    if (validNodes.length) settings.set('pubnodes_data', validNodes);
}

function doNodeListUpdate() {
    try {
        https.get(config.remoteNodeListUpdateUrl, (res) => {
            var result = '';
            res.setEncoding('utf8');

            res.on('data', (chunk) => {
                result += chunk;
            });

            res.on('end', () => {
                try {
                    var pnodes = JSON.parse(result);
                    storeNodeList(pnodes);
                    settings.set('pubnodes_last_updated', new Date().getTime());
                    settings.delete('pubnodes_tested');
                    log.debug('Public node list has been updated');
                } catch (e) {
                    log.debug(`Failed to update public node list: ${e.message}`);
                    storeNodeList();
                }
            });
        }).on('error', (e) => {
            log.debug(`Failed to update public-node list: ${e.message}`);
            storeNodeList(false);
        });
    } catch (e) {
        log.error(`Failed to update public-node list: ${e.code} - ${e.message}`);
        storeNodeList(false);
    }
}

function updatePublicNodes() {
    if (config.remoteNodeListUpdateUrl) {
        let last_updated = settings.get('pubnodes_last_updated', 946697799000);
        let now = new Date().getTime();
        if (Math.abs(now - last_updated) / 36e5 >= 24) {
            //do update
            log.info('Performing daily public-node list update.');
            doNodeListUpdate();
        } else {
            log.info('Public node list up to date, skipping update');
            storeNodeList(false); // from local cache
        }
    }
}

function serviceBinCheck() {
    if (DEFAULT_SERVICE_BIN.startsWith('/tmp')) {
        log.warn(`AppImage env, copying service bin file`);
        let targetPath = path.join(app.getPath('userData'), SERVICE_FILENAME);
        try {
            fs.renameSync(targetPath, `${targetPath}.bak`, (err) => {
                if (err) log.error(err);
            });
        } catch (_e) { }

        try {
            fs.copyFile(DEFAULT_SERVICE_BIN, targetPath, (err) => {
                if (err) {
                    log.error(err);
                    return;
                }
                settings.set('service_bin', targetPath);
                log.debug(`service binary copied to ${targetPath}`);
            });
        } catch (_e) { }
    } else {
        // don't trust user's settings, recheck
        let svcbin = settings.get('service_bin');
        try {
            if (!fs.existsSync(svcbin)) {
                log.warn(`Service binary can't be found, falling back to default`);
                settings.set('service_bin', DEFAULT_SERVICE_BIN);
            } else {
                log.info('Service binary found');
            }
        } catch (_e) {
            log.warn('Failed to check for service binary path, falling back to default');
            settings.set('service_bin', DEFAULT_SERVICE_BIN);
        }
    }
}

function initSettings() {
    Object.keys(DEFAULT_SETTINGS).forEach((k) => {
        if (!settings.has(k) || settings.get(k) === null) {
            settings.set(k, DEFAULT_SETTINGS[k]);
        }
    });
    settings.set('service_password', crypto.randomBytes(32).toString('hex'));
    settings.set('version', WALLETSHELL_VERSION);
    serviceBinCheck();
    fs.unlink(WALLET_CFGFILE, (err) => {
        if (err) log.debug(err.code === 'ENOENT' ? 'No stalled wallet config' : err.message);
    });
}

app.on('browser-window-created', function (e, window) {
    window.setMenuBarVisibility(false);
    window.setAutoHideMenuBar(false);
});
// Quit when all windows are closed.
app.on('window-all-closed', () => {
    //if (platform !== 'darwin')
    app.quit();
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) createWindow();
});

process.on('uncaughtException', function (e) {
    log.error(`Uncaught exception: ${e.message}`);
    try { fs.unlinkSync(WALLET_CFGFILE); } catch (e) { }
    process.exit(1);
});

process.on('beforeExit', (code) => {
    log.debug(`beforeExit code: ${code}`);
});

process.on('exit', (code) => {
    // just to be sure
    try { fs.unlinkSync(WALLET_CFGFILE); } catch (e) { }
    log.debug(`exit with code: ${code}`);
});

process.on('warning', (warning) => {
    log.warn(`${warning.code}, ${warning.name}`);
});

const silock = app.requestSingleInstanceLock();
app.on('second-instance', () => {
    if (win) {
        if (!win.isVisible()) win.show();
        if (win.isMinimized()) win.restore();
        win.focus();
    }
});
if (!silock) app.quit();

app.on('ready', () => {
    initSettings();
    updatePublicNodes();
    createWindow();
    // try to target center pos of primary display
    let eScreen = require('electron').screen;
    let primaryDisp = eScreen.getPrimaryDisplay();
    let tx = Math.ceil((primaryDisp.workAreaSize.width - DEFAULT_SIZE.width) / 2);
    let ty = Math.ceil((primaryDisp.workAreaSize.height - (DEFAULT_SIZE.height)) / 2);
    if (tx > 0 && ty > 0) {
        try { win.setPosition(parseInt(tx, 10), parseInt(ty, 10)); } catch (_e) { }
    }

    // remove old settings cruft if exist
    setTimeout(() => {
        try { settings.delete('pubnodes_checked'); } catch (e) { }
        try { settings.delete('pubnodes_date'); } catch (e) { }
    }, 2500);
});