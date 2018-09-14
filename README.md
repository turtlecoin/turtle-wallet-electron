# WalletShell

![Overview Tab](https://image.ibb.co/d9ovhH/overview.png "Overview Tab")

This is a GUI wallet for TurtleCoin made using Electron, this means it's written in JavaScript, HTML and CSS. 
It is meant to be able to work on Windows, Linux and MacOS, however so far I've only been able to test it on Windows.

As of now, this wallet contains the basic functions required to operate with TurtleCoin, this includes:
  * Load a wallet file
  * Generate a new wallet container file
  * Import an existing wallet using keys
  * Show private keys
  * See balance and transactions
  * Send TurtleCoin

There is still plenty of room for improvements and features, so I will gladly accept help from anyone who is capable of lending a hand. Right now the code is still in beta phase with some rough edges and should be polished in order to make a proper release.

### How to Use

Once you got WalletShell running (see the sections below), you will need to specify the path to walletd.exe in the Settings tab (the cog icon in the top left). Walletd comes with the turtlecoin .zip, and will not work with a versions below 0.3.1.

Now you can switch back to the Overview and click the 'Load Wallet' button to start using WalletShell. If you don't have a wallet file you can generate a new one with the 'Create Wallet' button or import one using your private keys with the 'Import Wallet' button.

### How to Launch

You need to have `Node.js` and `npm` installed to launch WalletShell. You can download the Node installer from https://nodejs.org/ and it comes bundled with `npm`. The versions I used are `v9.4.0` for Node and `5.8.0` for npm however it might work with older versions.

Once you have Node installed and this repository downloaded to some folder, `cd` into that folder and use the command `npm install`. This will install the dependencies of WalletShell to a `node_modules` folder that you need in order to run the wallet. The dependencies are:

```
  "devDependencies": {
    "electron": "^1.8.4"
  },
  "dependencies": {
    "electron-settings": "^3.1.4",
    "jayson": "^2.0.5"
  }
```

Now all you need to do is type `npm start` and the wallet should launch.

### How to Build

You can build it manually following the [Application Distribution](https://electronjs.org/docs/tutorial/application-distribution) guide in the Electron documentation. 

However, the easiest way I have tried so far is using a npm package called `electron-packager`. In order to do so you need to install it globally by typing `npm install electron-packager -g`. 

Now you can build WalletShell by typing:

`electron-packager <path_source> --out <path_out> --asar`

Where `<path_source>` is the path to your folder and `<path_out>` is the path to the folder where the app is going to be generated.

Using that command will generate a build for the platform and architecture you are currently using. You can use the `--platform=<platform>` and `--arch=<arch>` optional flags if you want to build it for something else. You can check https://github.com/electron-userland/electron-packager for extra info regarding this tool.
