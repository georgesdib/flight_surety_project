import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        this.config = Config[network];
        this.initialize(callback);
    }

    initialize(callback) {
        // use MetaMask's provider
        this.web3 = new Web3(window.ethereum);
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, this.config.appAddress);
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, this.config.dataAddress);

        window.ethereum.request({ method: 'eth_requestAccounts' });

        this.web3.eth.getAccounts((error, accts) => {
            if (error) {
                console.error('Failed to get accounts: ', error);
            } else {
                callback();
            }
        });
    }

    addEventsListener(callback) {
        // Handle events
        this.flightSuretyApp.events.allEvents(null, (error, result) => {
            this.handleEvent(result, callback);
        });
        this.flightSuretyData.events.allEvents(null, (error, result) => {
            this.handleEvent(result, callback);
        });
    }

    handleEvent(result, callback) {
        console.log('Event emitted');
        let text;
        let statusCode = null;
        switch(result.event) {
            case 'InsureeCredited':
                text = 'Insuree ' + result.returnValues['insuree'] + ' paid out ' +
                    this.web3.utils.fromWei(result.returnValues['amount'], "ether") + ' ETH';
                break;
            case 'InsuracePayoutWithdrawn':
                text = result.returnValues['insured'] + ' has withdrawn ' +
                    this.web3.utils.fromWei(result.returnValues['insuranceValue'], "ether") + ' ETH';
                break;
            case 'OracleRequest':
                text = 'Oracle Requested: index: ' + result.returnValues['index'] + ', flight: ' +
                    result.returnValues['flight'] + ', time: ' + result.returnValues['timestamp'] +
                    ', airline: ' + result.returnValues['airline'];
                break;
            case 'OracleReport':
                text = 'Oracle Reported: airline: ' + result.returnValues['airline'] + ', flight: ' +
                    result.returnValues['flight'] + ', time: ' + result.returnValues['timestamp'] +
                    ', with : ' + result.returnValues['nbVotes'] + ' votes';
                break;
            case 'FlightStatusInfo':
                text = 'Flight Status Info: airline: ' + result.returnValues['airline'] + ' flight: ' +
                    result.returnValues['flight'] + ', time: ' + result.returnValues['timestamp'] +
                    ' with status: ' + result.returnValues['status'];
                statusCode = result.returnValues['status'];
                break;
            case 'AirlinePreRegistered':
                text = 'Pre registration: Received ' + result.returnValues['votes'] + ' votes so far';
                break;
            case 'FlightRegistered':
                text = 'Flight ' + result.returnValues['flight'] + ' at time ' + result.returnValues['timestamp'] + ' from airline '
                    + result.returnValues['airline'] + ' is registered';
                break;
            case 'InsuranceBought':
                text = result.returnValues['customer'] + ' has bought insurance for ' +
                    result.returnValues['flightName'] + ' flying at ' + result.returnValues['flightTime'] +
                    ' on airline ' + result.returnValues['airline'] + ' in the amount of ' +
                    this.web3.utils.fromWei(result.returnValues['amount'], "ether");
                break;
            default:
                text = result.event;
                break;
        }

        console.log(result);

        callback(text + '. Tx Hash: ' + result.transactionHash, statusCode);
    }
    
    fundAirline(callback) {
        let self = this;
        this.web3.eth.getAccounts((error, accts) => {
            if (error) {
                console.error(error);
                callback(error, null);
            } else {
                let value = this.web3.utils.toWei("10", "ether");
                self.flightSuretyApp.methods
                .fundAirline()
                .send({from: accts[0], value: value}, callback);
            }
        });
    }

    claimInsurance(callback) {
        let self = this;
        this.web3.eth.getAccounts((error, accts) => {
            if (error) {
                console.error(error);
                callback(error, null);
            } else {
                self.flightSuretyApp.methods
                .claimInsurance()
                .send({from: accts[0]}, callback);
            }
        });
    }

    registerAirline(airline, callback) {
        let self = this;
        this.web3.eth.getAccounts((error, accts) => {
            if (error) {
                console.error(error);
                callback(error, null);
            } else {
                self.flightSuretyApp.methods
                .registerAirline(airline)
                .send({from: accts[0]}, callback);
            }
        });
    }

    registerFlight(flightName, flightTime, callback) {
        let self = this;
        this.web3.eth.getAccounts((error, accts) => {
            if (error) {
                console.error(error);
                callback(error, null);
            } else {
                self.flightSuretyApp.methods
                .registerFlight(flightName, flightTime)
                .send({from: accts[0]}, callback);
            }
        });
    }

    buyInsurance(flightName, flightTime, airline, amount, callback) {
        let self = this;
        let amountWei = this.web3.utils.toWei(amount, "ether");
        this.web3.eth.getAccounts((error, accts) => {
            if (error) {
                console.error(error);
                callback(error, null);
            } else {
                self.flightSuretyApp.methods
                .buyInsurance(airline, flightName, flightTime)
                .send({from: accts[0], value: amountWei}, callback);
            }
        });
    }

    isAppOperational(callback) {
        this.flightSuretyApp.methods.isOperational().call(null, callback);
    }

    isDataOperational(callback) {
        this.flightSuretyData.methods.isOperational().call(null, callback);
    }

    setAppOperatingStatus(mode, callback) {
        let self = this;
        this.web3.eth.getAccounts((error, accts) => {
            if (error) {
                console.error(error);
                callback(error, null);
            } else {
                self.flightSuretyApp.methods
                .setOperatingStatus(mode)
                .send({ from: accts[0] }, callback);
            }
        });
    }

    setDataOperatingStatus(mode, callback) {
        let self = this;
        this.web3.eth.getAccounts((error, accts) => {
            if (error) {
                console.error(error);
                callback(error, null);
            } else {
                self.flightSuretyData.methods
                .setOperatingStatus(mode)
                .send({from: accts[0]}, callback);
            }
        });
    }

    fetchFlightStatus(airline, flightName, flightTime, callback) {
        let self = this;
        let payload = {
            airline: airline,
            flight: flightName,
            timestamp: flightTime
        }
        this.web3.eth.getAccounts((error, accts) => {
            if (error) {
                console.error(error);
                callback(error, null);
            } else {
                self.flightSuretyApp.methods
                .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
                .send({from: accts[0]}, (error, result) => {
                    callback(error, payload);
                });
            }
        });
    }
}