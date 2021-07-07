import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

let oracles = new Map();
let status = 0; // start with unknown
let random_status = true; // Randomly select the status


flightSuretyApp.events.OracleRequest(null, (error, event) => {
  if (error) {
    console.error(error);
  } else {
    console.log('Oracle Request emitted');
    submitOracleResponseForIndex(event.returnValues.index,
      event.returnValues.airline,
      event.returnValues.flight,
      event.returnValues.timestamp);
  }
});

function registerOracles() {
  web3.eth.getAccounts((error, accts) => {
    if (error) {
      console.error('Error getting accounts: ', error);
    } else {
      // Register from index 10 to index 30
      for (let i = 10; i < 30; i++) {
        // Estimate gas and use 25% more to have a margin
        flightSuretyApp.methods.registerOracle().estimateGas({ from: accts[i], value: web3.utils.toWei('1', 'ether')})
        .then((gas) => {
          let gasLimit = Math.floor(gas * 1.25);
          flightSuretyApp.methods.registerOracle().send({ from: accts[i], value: web3.utils.toWei('1', 'ether'), gas: gasLimit })
            .then(() => {
              flightSuretyApp.methods.getMyIndexes().call({ from: accts[i] })
                .then((indexes) => {
                  oracles.set(accts[i], indexes);
                  console.log('Oracle: ', accts[i], 'registered with indexes: ', indexes);
                })
                .catch((err) => console.error('Failed to get indexes of: ', accts[i], ' with error: ', err));
            })
            .catch((err) => console.error('Failed to register oracle: ', accts[i], ' with error: ', err));
        }).catch((err) => console.error('Failed to estimate gas: ', err));
      }
    }
  });
}

function submitOracleResponseForIndex(index, airline, flightName, flightTime) {
  console.log('Submitting request for airline: ', airline, ' flightName: ', flightName,
    ' flightTime: ', flightTime, ' index: ', index);
  for (let [address, indexes] of oracles) {
    if (indexes.includes(index)) {
      // Estimating the gas here does not work, presumably because the code path depends on the status
      // being returned. The error is very mysterious and hard to debug ...
      let statusCode = generateIndex();
      console.log('Oracle: ', address, ' is submitting status: ', statusCode);
      flightSuretyApp.methods.submitOracleResponse(index, airline, flightName, flightTime, statusCode)
        .send({ from: address, gas: 500000 })  // Went a bit overboard with gas to be safe
        .catch((err) => {
          console.error('Failed to submit for index: ', index, ' oracle: ',
            address, ' with indexes: ', indexes);
          console.error(err);
        })
    }
  }
};

function generateIndex() {
  // random returns a number between 0 and 1, multiply by 6, gets it to between 0 and 6
  // floor it to return integers only, and max it with 5 to avoid having 6, then
  // multiply by 10
  if (random_status) {
    return Math.max(Math.floor(Math.random() * 6), 5) * 10;
  }
  return status
}


const app = express();
// use /?status=10 to change status code to 10
app.get('/', (req, res) => {
  let statusCode = req.query['status'];
  if (statusCode) {
    console.log('setting status to: ', statusCode);
    status = parseInt(statusCode);
    res.send('Status code set to: ' + status.toString());
  }
  let random = req.query['randomStatus'];
  if (random) {
    console.log('Setting random status to: ', random);
    random_status = (random === 'true');
    res.send('Random Status set to: ' + random_status);
  }
})

app.get('/status', (req, res) => {
  res.send('Status code is: ' + status.toString());
})

app.get('/random', (req, res) => {
  res.send('The random flag is: ' + random_status.toString());
})

registerOracles()

export default app;


