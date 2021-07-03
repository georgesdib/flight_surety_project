var HDWalletProvider = require("@truffle/hdwallet-provider");
var mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
const Web3 = require('web3');

module.exports = {
  networks: {
    develop: {
      websockets: true,
      accounts: 50
    },
    development: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
      },
      network_id: '*',
      gas: 9999999
    },
    ganache: {
      host: "127.0.0.1",
      port: 7545,
      websockets: true,
      network_id: '*',
    }
  },
  compilers: {
    solc: {
      version: "0.8.6"
    }
  }
};