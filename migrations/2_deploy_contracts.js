const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');

module.exports = function(deployer, network, accounts) {
    // Owner is accounts[0], first airline is accounts[1]
    let firstAirline = accounts[1];
    deployer.deploy(FlightSuretyData, firstAirline)
    .then(() => {
        return deployer.deploy(FlightSuretyApp, FlightSuretyData.address)
                .then(() => {
                    let config = {
                        localhost: {
                            url: 'http://localhost:7545',
                            dataAddress: FlightSuretyData.address,
                            appAddress: FlightSuretyApp.address
                        }
                    }
                    fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
                    fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '\t'), 'utf-8');

                    // Authorise app to call data contract
                    const dataContract = new this.web3.eth.Contract(FlightSuretyData.abi, FlightSuretyData.address);
                    dataContract.methods.authorizeCaller(FlightSuretyApp.address).send({from: accounts[0]})
                        .then((result) => {
                            console.log('App authorised, transaction ID: ', result.transactionHash);
                        });
                });
    });
}