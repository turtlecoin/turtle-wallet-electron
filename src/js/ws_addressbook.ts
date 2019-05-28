import GCM from 'node-crypto-gcm';
import fs from 'fs';
import { config } from './ws_config';
import { Utils } from './ws_utils';

const wsutil = new Utils();

interface AddressBookOptions {
    path: string,
    name?: string,
    pass?: string,
    cipherConfig?: string,
}

export class WalletShellAddressBook {

    public path: string;
    public name: string;
    public pass: string;
    public cipherConfig: string | object;
    public exists: any;

    constructor(opts?: AddressBookOptions) {
        this.path = opts.path,
        this.name = opts.name || 'Default/Builtin',
        this.pass = opts.pass || config.addressBookObfuscationKey,
        this.cipherConfig = opts.cipherConfig || config.addressBookCipherConfig
    }

    public setParams(path: string, pass: string) {
        if (path) this.path = path;
        if (pass) this.pass = pass;
        return true;
    };

    public create(ignoreExists?: boolean) {
        ignoreExists = ignoreExists || false;
        return new Promise((resolve, reject) => {
            if (this.exists) {
                return reject(new Error('Already exists!'));
            }

            const sampleData = config.addressBookSampleEntries;
            let sampleEntries = {};
            if (sampleData && Array.isArray(sampleData)) {
                sampleData.forEach((item) => {
                    let ahash = wsutil.fnvhash(item.address + item.paymentId);
                    let aqr = wsutil.genQrDataUrl(item.address);
                    item.qrCode = aqr;
                    sampleEntries[ahash] = item;
                });
            }
            let abData = {
                name: this.name,
                data: sampleEntries
            };
            this.save(abData).then(function () {
                return resolve(this.path);
            });
        });
    };

    public initFile() {
        return new Promise((resolve, reject) => {
            try {
                if (fs.existsSync(this.path)) {
                    return resolve(this.path);
                } else {
                    this.create().then(() => {
                        return resolve(this.path);
                    }).catch((err) => {
                        return reject(err);
                    });
                }
            } catch (e) {
                return reject(e);
            }
        });
    };

    public load() {
        return new Promise((resolve, reject) => {
            this.initFile().then((ret) => {
                let rawcontents = '';
                try {
                    rawcontents = fs.readFileSync(this.path, 'utf8');
                } catch (e) {
                    return reject(new Error('Unable to load specified file'));
                }

                let jdata = null;
                try {
                    jdata = JSON.parse(rawcontents);
                } catch (e) {
                    return reject(Error("Invalid or broken address book file 1"));
                }

                if (!jdata.hasOwnProperty('name') || !jdata.hasOwnProperty('data')) {
                    return reject(new Error("Invalid or broken address book file 2"));
                }
                if (typeof jdata.name !== "string" || typeof jdata.data !== "string") {
                    return reject(new Error("Invalid or broken address book file 3"));
                }
                let gcm = new GCM(this.pass, this.cipherConfig);
                let abdata = gcm.decrypt(jdata.data);
                if (null === abdata) {
                    return reject(new Error("Invalid password"));
                }

                return resolve({
                    name: jdata.name,
                    path: this.path,
                    data: JSON.parse(abdata)
                });
            }).catch((err) => {
                return reject(err);
            });
        });
    };

    public save(addressBookData: any) {
        return new Promise((resolve, reject) => {
            let gcm = new GCM(this.pass, this.cipherConfig);

            try {
                let plainData = JSON.stringify(addressBookData.data);
                addressBookData.data = gcm.encrypt(plainData);
                fs.writeFile(this.path, JSON.stringify(addressBookData), (err) => {
                    if (err) return reject(err);
                    return resolve(true);
                });
            } catch (e) {
                return reject(e);
            }
        });
    };

}
