import Store from 'electron-store';
import { config } from '../../src/js/ws_config';

const settings: Store = new Store({ name: 'Settings' });
const WS_VERSION: any = settings.get('version', 'unknown');
const DEFAULT_TITLE: string = `${config.appName} ${WS_VERSION} - ${config.appDescription}`;
const SESSION_KEY: string = 'wlshell';

interface Options {
    walletConfig: string | undefined;
    debug: boolean;
}

interface SessionDefault {
    loadedWalletAddress: string;
    walletHash: string;
    walletUnlockedBalance: number;
    walletLockedBalance: number;
    walletConfig: string;
    synchronized: boolean;
    syncStarted: boolean;
    serviceReady: boolean;
    connectedNode: string;
    txList: any[];
    txLastHash: any;
    txLastTimestamp: any;
    txNew: any[];
    txLen: number;
    nodeFee: number;
    nodeChoices: any;
    servicePath: any;
    configUpdated: boolean;
    uiStateChanged: false;
    defaultTitle: string;
    debug: boolean;
    fusionStarted: boolean;
    fusionProgress: boolean;
    addressBookErr: boolean;
}

interface StickyValues {
    publicNodes: any[];
    addressBook: any;
}

export class WalletShellSession {
    public sessKey: string = SESSION_KEY;
    public eventName: string = 'sessionUpdated';
    public sessDefault: SessionDefault;

    public stickyVals: StickyValues = {
        publicNodes: [],
        addressBook: null,
    };

    public keys: string[];

    constructor(opts?: Options) {
        this.sessDefault = {
            loadedWalletAddress: '',
            walletHash: '',
            walletUnlockedBalance: 0,
            walletLockedBalance: 0,
            walletConfig: opts.walletConfig || 'wconfig.txt',
            synchronized: false,
            syncStarted: false,
            serviceReady: false,
            connectedNode: '',
            txList: [],
            txLen: 0,
            txLastHash: null,
            txLastTimestamp: null,
            txNew: [],
            nodeFee: 0,
            nodeChoices: settings.get('pubnodes_data', []),
            servicePath: settings.get('service_bin', 'turtle-service'),
            configUpdated: false,
            uiStateChanged: false,
            defaultTitle: DEFAULT_TITLE,
            debug: opts.debug || false,
            fusionStarted: false,
            fusionProgress: false,
            addressBookErr: false
        };

        /* jshint ignore:start */
        this.keys = Object.keys({ ...this.sessDefault, ...this.stickyVals });

        // initialize
        if (!sessionStorage.getItem(this.sessKey)) {
            sessionStorage.setItem(this.sessKey, JSON.stringify({ ...this.sessDefault, ...this.stickyVals }));
        }
        /* jshint ignore:end */
    }

    get(key) {
        key = key || false;
        if (!key) {
            return JSON.parse(sessionStorage.getItem(this.sessKey)) || this.sessDefault;
        }
    
        if (!this.keys.includes(key)) {
            throw new Error(`Invalid session key: ${key}`);
        }
    
        return JSON.parse(sessionStorage.getItem(this.sessKey))[key];
    };

    getDefault(key) {
        if (!key) {
            return this.sessDefault;
        }
        return this.sessDefault[key];
    };

    set(key, val) {
        if (!this.keys.includes(key)) {
            throw new Error(`Invalid session key: ${key}`);
        }
    
        let sessData = this.get(); // all current data obj
        sessData[key] = val; // update value
        return sessionStorage.setItem(this.sessKey, JSON.stringify(sessData));
    };

    reset(key) {
        if (key) {
            if (!this.sessDefault.hasOwnProperty(key)) {
                throw new Error('Invalid session key');
            }
    
            let sessData = this.get(); // all current data obj
            sessData[key] = this.sessDefault[key]; // set to default value
            return sessionStorage.setItem(this.sessKey, JSON.stringify(sessData[key]));
        }
        //return sessionStorage.setItem(this.sessKey, JSON.stringify(this.sessDefault));
        let stickyData = {};
        Object.keys(this.stickyVals).forEach((e) => {
            stickyData[e] = this.get(e);
        });
        /* jshint ignore: start */
        return sessionStorage.setItem(this.sessKey, JSON.stringify({ ...this.sessDefault, ...stickyData }));
        /* jshint ignore: end */
    };

    destroy() {
        return sessionStorage.removeItem(this.sessKey);
    }
};
