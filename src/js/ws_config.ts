// self explanatory, your application name, descriptions, etc

interface IConfig {
  appName: string,
  appDescription: string,
  appSlogan: string,
  appId: string,
  appGitRepo: string,
  daemonDefaultRpcPort: number,
  walletFileDefaultExt: string,
  walletServiceBinaryFilename: string,
  walletServiceBinaryVersion: string,
  walletServiceConfigFormat: string,
  walletServiceRpcPort: number,
  blockExplorerUrl: string,
  remoteNodeDefaultHost: string,
  remoteNodeListUpdateUrl: string,
  remoteNodeListFiltered: boolean,
  remoteNodeListFallback: string[],
  remoteNodeCacheSupported: boolean,
  remoteNodeSslSupported: boolean,
  assetName: string,
  assetTicker: string,
  addressPrefix: string,
  addressLength: number,
  integratedAddressLength: number,
  minimumFee: number,
  mininumSend: number,
  defaultMixin: number,
  decimalPlaces: number,
  decimalDivisor: number,
  addressBookObfuscateEntries: boolean,
  addressBookObfuscationKey: string,
  addressBookSampleEntries: any[],
  addressBookCipherConfig: object,
}

export const config: IConfig = {
  appName: 'WalletShell',
  appDescription: 'TurtleCoin Wallet',
  appSlogan: 'Slow and steady wins the race!',
  appId: 'lol.turtlecoin.walletshell',
  appGitRepo: 'https://github.com/turtlecoin/turtle-wallet-electron',

  // default port number for your daemon (e.g. TurtleCoind)
  daemonDefaultRpcPort: 11898,

  // wallet file created by this app will have this extension
  walletFileDefaultExt: 'twl',

  // change this to match your wallet service executable filename
  walletServiceBinaryFilename: 'turtle-service',

  // version on the bundled service (turtle-service)
  walletServiceBinaryVersion: "v0.13.0",

  // config file format supported by wallet service, possible values:
  // ini -->  for turtle service (or its forks) version <= v0.8.3
  // json --> for turtle service (or its forks) version >= v0.8.4
  walletServiceConfigFormat: "json",

  // default port number for your wallet service (e.g. turtle-service)
  walletServiceRpcPort: 8070,

  // block explorer url, the [[TX_HASH]] will be substituted w/ actual transaction hash
  blockExplorerUrl: 'https://explorer.turtlecoin.lol/transaction.html?hash=[[TX_HASH]]',

  // default remote node to connect to, set this to a known reliable node for 'just works' user experience
  remoteNodeDefaultHost: 'turtlenode.co',

  // remote node list update url, set to null if you don't have one
  // for TRTL:
  // raw list: https://raw.githubusercontent.com/turtlecoin/turtlecoin-nodes-json/master/turtlecoin-nodes.json
  // filtered: https://trtl.nodes.pub/api/getNodes
  remoteNodeListUpdateUrl: 'https://trtl.nodes.pub/api/getNodes',

  // set to false if using raw/unfiltered node list
  remoteNodeListFiltered: true,

  // fallback remote node list, in case fetching update failed, fill this with known to works remote nodes
  remoteNodeListFallback: [
    'turtlenode.co:11898',
    'nodes.hashvault.pro:11898',
    'turtle.mine.nu:11898',
  ],
  remoteNodeCacheSupported: false,
  remoteNodeSslSupported: false,

  // your currency name
  assetName: 'TurtleCoin',
  // your currency ticker
  assetTicker: 'TRTL',
  // your currency address prefix, for address validation
  addressPrefix: 'TRTL',
  // standard wallet address length, for address validation
  addressLength: 99,
  // integrated wallet address length, for address validation. Added length is length of payment ID encoded in base58.
  integratedAddressLength: /*addressLength*/ 99 + ((64 * 11) / 8),

  // minimum fee for sending transaction
  minimumFee: 0.1,
  // minimum amount for sending transaction
  mininumSend: 0.1,
  // default mixin/anonymity for transaction
  defaultMixin: 3,
  // to represent human readable value
  decimalPlaces: 2,
  // to convert from atomic unit
  decimalDivisor: 10 ** 2, //this.decimalPlaces

  // obfuscate address book entries, set to false if you want to save it in plain json file.
  // not for security because the encryption key is attached here
  addressBookObfuscateEntries: true,
  // key use to obfuscate address book contents
  addressBookObfuscationKey: '79009fb00ca1b7130832a42de45142cf6c4b7f333fe6fba5',
  // initial/sample entries to fill new address book
  addressBookSampleEntries: [
    {
      name: 'WalletShell Donation',
      address: 'TRTLv1A26ngXApin33p1JsSE9Yf6REj97Xruz15D4JtSg1wuqYTmsPj5Geu2kHtBzD8TCsfd5dbdYRsrhNXMGyvtJ61AoYqLXVS',
      paymentId: '',
    }
  ],
  // cipher config for private address book
  addressBookCipherConfig: {
    algorithm: 'aes-256-gcm',
    saltLenght: 128,
    pbkdf2Rounds: 10000,
    pbkdf2Digest: 'sha512'
  },
}