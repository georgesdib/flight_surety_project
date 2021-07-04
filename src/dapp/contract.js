import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        this.config = Config[network];
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
    }

    initialize(callback) {
        // use MetaMask's provider
        this.web3 = new Web3(window.ethereum);
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, this.config.appAddress);
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, this.config.dataAddress);

        window.ethereum.request({ method: 'eth_requestAccounts' });

        this.web3.eth.getAccounts((error, accts) => {
            this.owner = accts[0];

            let counter = 1;

            while (this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while (this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            callback();
        });

        // Handle events
        this.flightSuretyApp.events.allEvents(null, (error, result) => {
            this.handleEvent(result);
        });
        this.flightSuretyData.events.allEvents(null, (error, result) => {
            this.handleEvent(result);
        });
    }

    handleEvent(result) {
        console.log('Event emitted');
        switch(result.event) {
            case 'OracleRequest':
                console.log(`\n\nOracle Requested: index: ${result.args.index.toNumber()}, flight:  ${result.args.flight}, timestamp: ${result.args.timestamp.toNumber()}`);
                break;
            case 'FlightStatusInfo':
                console.log(`\n\nFlight Status Available: flight: ${result.args.flight}, timestamp: ${result.args.timestamp.toNumber()}, status: ${result.args.status.toNumber() == STATUS_CODE_ON_TIME ? 'ON TIME' : 'DELAYED'}`);
                break;
            case 'OracleReport':
                console.log(`\n\nUnverifired Flight Status Available: flight: ${result.args.flight}, timestamp: ${result.args.timestamp.toNumber()}, status: ${result.args.status.toNumber() == STATUS_CODE_ON_TIME ? 'ON TIME' : 'DELAYED'}, nbVotes: ${result.args.nbVotes.toNumber()}`);
                break;
            case 'AirlinePreRegistered':
                alert('Pre registration: Received ' + result.returnValues['votes'] + ' votes so far');
                break;
            case 'AirlineFunded':
                alert('Airline Funded!');
                break;
            case 'AirlineRegistered':
                alert('Airline is registered');
                break;
        }

        console.log(result);
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

    registerAirline(airline, callback) {
        let self = this;
        this.web3.eth.getAccounts((error, accts) => {
            if (error) {
                console.error(error);
                callback(error, null);
            } else {
                self.flightSuretyApp.methods
                .registerAirline(airline)
                .send({from: accts[0]})
                .on('receipt', (receipt) => {
                    callback(null, receipt);
                }).on('error', (error, receipt) => {
                    callback(error, receipt);
                });
            }
        });
    }

    isAppOperational(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner }, callback);
    }

    isDataOperational(callback) {
        let self = this;
        self.flightSuretyData.methods
            .isOperational()
            .call({ from: self.owner }, callback);
    }

    setAppOperatingStatus(mode, callback) {
        let self = this;
        self.flightSuretyApp.methods
            .setOperatingStatus(mode)
            .send({ from: self.owner }, callback);
    }

    setDataOperatingStatus(mode, callback) {
        let self = this;
        self.flightSuretyData.methods
            .setOperatingStatus(mode)
            .send({ from: self.owner }, callback);
    }

    fetchFlightStatus(flight, callback) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: Math.floor(Date.now() / 1000)
        }
        console.log('airline: ', payload.airline);
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({ from: self.owner }, (error, result) => {
                callback(error, payload);
            });
    }
}