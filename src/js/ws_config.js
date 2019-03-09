var config = {};

// self explanatory, your application name, descriptions, etc
config.appName = 'XWallet';
config.appDescription = 'LightChain Wallet';
config.appSlogan = 'A lightweight digital cryptonote currency.';
config.appId = 'lightchain.xwallet';
config.appGitRepo = 'https://github.com/lcxnetwork/XWallet-GUI';

// default port number for your daemon (e.g. TurtleCoind)
config.daemonDefaultRpcPort = 10002;

// wallet file created by this app will have this extension
config.walletFileDefaultExt = 'wallet';

// change this to match your wallet service executable filename
config.walletServiceBinaryFilename = 'lc-service';

// version on the bundled service (turtle-service)
config.walletServiceBinaryVersion = "v0.2.0";

// config file format supported by wallet service, possible values:
// ini -->  for turtle service (or its forks) version <= v0.8.3
// json --> for turtle service (or its forks) version >= v0.8.4
config.walletServiceConfigFormat = "json";

// default port number for your wallet service (e.g. turtle-service)
config.walletServiceRpcPort = 8070;

// block explorer url, the [[TX_HASH]] will be substituted w/ actual transaction hash
config.blockExplorerUrl = 'https://explorer.lightchain.net/transaction.html?hash=[[TX_HASH]]';

// default remote node to connect to, set this to a known reliable node for 'just works' user experience
config.remoteNodeDefaultHost = 'xmlc.ml';

// remote node list update url, set to null if you don't have one
config.remoteNodeListUpdateUrl = 'https://raw.githubusercontent.com/lcxnetwork/public-nodes-json/master/public-nodes.json';

// fallback remote node list, in case fetching update failed, fill this with known to works remote nodes
config.remoteNodeListFallback = [
  'xmlc.ml:10002',
  'hashblaster.com:10002',
  'explorer.lightchain.net:10002',
];

// your currency name
config.assetName = 'LightChain';
// your currency ticker
config.assetTicker = 'LCX';
// your currency address prefix, for address validation
config.addressPrefix = 'X';
// standard wallet address length, for address validation
config.addressLength = 97;
// integrated wallet address length, for address validation. Added length is length of payment ID encoded in base58.
config.integratedAddressLength = 185;

// minimum fee for sending transaction
config.minimumFee = 0.00000100;
// minimum amount for sending transaction
config.mininumSend = 0.00000001;
// default mixin/anonimity for transaction
config.defaultMixin = 3;
// to represent human readable value
config.decimalPlaces = 8;
// to convert from atomic unit
config.decimalDivisor = 10 ** config.decimalPlaces;

// obfuscate address book entries, set to false if you want to save it in plain json file.
// not for security because the encryption key is attached here
config.addressBookObfuscateEntries = true;
// key use to obfuscate address book contents
config.addressBookObfuscationKey = '79009fb00ca1b7130832a42de45142cf6c4b7f333fe6fba5';
// initial/sample entries to fill new address book
config.addressBookSampleEntries = [
  {
    name: 'XWallet Donation',
    address: 'Xwmmuem45YVbFmN29GNDxie1foHypTioBUivW4fEKo3BSu4LPfPtjQY8zpnp1GxXx2PZL1Q4idD6gNDVuvPaHR3B2TpmdVoba',
    paymentId: '',
  }
];
// cipher config for private address book
config.addressBookCipherConfig = {
  algorithm: 'aes-256-gcm',
  saltLenght: 128,
  pbkdf2Rounds: 10000,
  pbkdf2Digest: 'sha512'
};

module.exports = config;
