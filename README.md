## WalletShell - GUI wallet for TurtleCoin.

![WalletShell Screens](https://i.imgur.com/41Ujq0S.gif "WalletShell Screens")

### Features:

This wallet contains the basic functions required to manage your TurtleCoin assets:

* Wallet creation:
  * Create new wallet.
  * Import/recover from private keys OR mnemonic seed.
* Basic wallet operation/transactions:
  * Open an existing  wallet
  * Display wallet address & balance
  * Display & Backup private keys/seed
  * Sending/transferring. Integrated Address or Payment ID are supported. Also provides address lookup from your addressbook.
  * Transactions history listing/sorting/searching/detail.
  * Incoming transaction notification.
  * Export incoming, outgoing, or all transactions to csv file.
  * Rescan wallet from specific block height.
  * Perform wallet optimization.
  * Utilities: generate payment id and integrated address.
* Address book:
  * Add/Edit/Delete address entry.
  * Listing/sorting/searching existing entries.
  * Allow to store same wallet address with different payment id.
  * Autosave address after sending to new/unknown recipient
  * Allow to optionally create password protected address book.
* Misc:
  * Option to use system tray (on closing/minimizing wallet)
  * Provides list of public nodes, fetch/updated daily from [turtlecoin-nodes-json](https://github.com/turtlecoin/turtlecoin-nodes-json) repo.
  * Allow to add custom node address.
  * Theme: Dark & Light Mode
  * [Keyboard shortcuts](docs/shortcut.md)

### Download &amp; Run WalletShell

#### Windows:
1. Download the latest installer here: https://github.com/turtlecoin/turtle-wallet-electron/releases/latest
2. Run the installer (`walletshell-<version>-win-setup.exe`) and follow the installation wizard.
3. Launch WalletShell via start menu or desktop shortcut.

#### GNU/Linux (AppImage):
1. Download latest AppImage bundle here: https://github.com/turtlecoin/turtle-wallet-electron/releases/latest
2. Make it executable, either via GUI file manager or command line, e.g. `chmod +x walletshell-<version>-linux.AppImage`
3. Run/execute the file, double click in file manager, or run via shell/command line (See: https://docs.appimage.org/user-guide/run-appimages.html)

#### macOS
1. Download latest archive here: https://github.com/turtlecoin/turtle-wallet-electron/releases/latest
2. Extract downloaded zip archived
3. Run the executable binary (`WalletShell.app/Contents/MacOs/WalletShell`)

### Using WalletShell
Please visit our wiki page: [WalletShell User Guide](../../wiki).

### Building/Packaging WalletShell

* You need to have `Node.js` and `npm` installed, go to https://nodejs.org and find out how to get it installed on your platform.
* You'll need `typescript` installed (install it with `npm` using `npm i -g typescript`)
* You'll need the latest version of turtle-service, download it from the latest release here: https://github.com/turtlecoin/turtlecoin/releases


Once you have Node+npm and typescript installed:
```
# assuming you're building it on GNU/Linux
# first, download turtle-service binary for each platform
# from TurtleCoin official repo
# https://github.com/turtlecoin/turtlecoin/releases
# extract the turtle-service executable somewhere

# clone the repo
$ git clone https://github.com/turtlecoin/turtle-wallet-electron
$ cd turtle-wallet-electron

# install dependencies
$ npm install

# compile the typescript
$ tsc 

# create build+dist directory
$ mkdir -p ./build && mkdir -p ./dist

# copy/symlink icons from assets, required for packaging
$ cp ./src/assets/icon.* ./build/

# build GNU/Linux package
$ mkdir -p ./bin/lin
$ cp /path/to/linux-version-of/turtle-service ./bin/lin/
$ npm run dist-lin

# build Windows package (you need to have wine 2.0+ installed)
$ mkdir -p ./bin/win
$ cp /path/to/win-version-of/turtle-service.exe ./bin/win/
$ npm run dist-win

# build OSX package
$ mkdir -p ./bin/osx
$ cp /path/to/osx-version-of/turtle-service ./bin/osx/
$ npm run dist-mac
```

Resulting packages or installer can be found inside `dist/` directory.

### Porting for another coin
Please see [this guide](docs/porting.md) if you want to adapt WalletShell to be use for your own TurtleCoin fork.

![WalletShell](docs/walletshell.png)
