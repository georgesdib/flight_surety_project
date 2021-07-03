
const assert = require('assert');
var Test = require('../config/testConfig.js');
//var BigNumber = require('bignumber.js');

const TEST_ORACLES_COUNT = 20;

// Watch contract events
const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;

handleEvent = (result) => {
  if (result.event === 'OracleRequest') {
    console.log(`\n\nOracle Requested: index: ${result.args.index.toNumber()}, flight:  ${result.args.flight}, timestamp: ${result.args.timestamp.toNumber()}`);
  } else if (result.event === "FlightStatusInfo" ) {
    console.log(`\n\nFlight Status Available: flight: ${result.args.flight}, timestamp: ${result.args.timestamp.toNumber()}, status: ${result.args.status.toNumber() == STATUS_CODE_ON_TIME ? 'ON TIME' : 'DELAYED'}`);
  } else if (result.event === "OracleReport") {
    console.log(`\n\nUnverifired Flight Status Available: flight: ${result.args.flight}, timestamp: ${result.args.timestamp.toNumber()}, status: ${result.args.status.toNumber() == STATUS_CODE_ON_TIME ? 'ON TIME' : 'DELAYED'}, nbVotes: ${result.args.nbVotes.toNumber()}`);
  } else {
    console.log(result.event);
  }
}

contract('Oracles', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);

    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei("10", "ether")});

    await config.flightSuretyApp.allEvents(null).on('data', (result) => {
        handleEvent(result);
      });
  });

  it('can register oracles', async () => {
    
    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for(let a=1; a<TEST_ORACLES_COUNT; a++) {    
      try {  
        await config.flightSuretyApp.registerOracle({ from: accounts[a], value: fee });
      } catch (e) {
        console.log(e);
        throw e;
      }
      let result = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a]});
      console.log(`Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`);
    }
  });

  it('can request flight status', async () => {
    
    // ARRANGE
    let flight = 'ND1309'; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp, {from: config.owner});
    // ACT

    var eventTriggered = false;
    await config.flightSuretyApp.contract.getPastEvents('OracleRequest', null, (err, result) => {
      if (result.length > 0) {
        eventTriggered = true;
      }
    });
    assert(eventTriggered, "Event OracleRequest not emitted");

    // Register flights
    await config.flightSuretyApp.registerFlight(flight, timestamp, {from: config.firstAirline});

    eventTriggered = false;
    await config.flightSuretyApp.contract.getPastEvents('FlightRegistered', null, (err, result) => {
      if (result.length > 0) {
        eventTriggered = true;
      }
    });
    assert(eventTriggered, "Event FlightRegistered not emitted");

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for(let a=1; a<TEST_ORACLES_COUNT; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a]});
      for(let idx=0;idx<3;idx++) {

        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_ON_TIME, { from: accounts[a] });
          console.log("Worked: ", idx, ": ", oracleIndexes[idx].toNumber());

          eventTriggered = false;
          await config.flightSuretyApp.contract.getPastEvents('OracleReport', null, (err, result) => {
            if (result.length > 0) {
              eventTriggered = true;
            }
          });
          assert(eventTriggered, "Event not emitted");
        }
        catch(e) {
          //console.log(e.message);
          // Enable this when debugging
          //console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
        }

      }
    }

    //TODO: add test for insurance


  });


 
});
