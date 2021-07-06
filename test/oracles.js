
const assert = require('assert');
var Test = require('../config/testConfig.js');
var BN = require('bn.js');

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
  } else if (result.event === "FlightStatusInfo") {
    console.log(`\n\nFlight Status Available: flight: ${result.args.flight}, timestamp: ${result.args.timestamp.toNumber()}, status: ${result.args.status.toNumber() == STATUS_CODE_ON_TIME ? 'ON TIME' : 'DELAYED'}`);
  } else if (result.event === "OracleReport") {
    console.log(`\n\nUnverifired Flight Status Available: flight: ${result.args.flight}, timestamp: ${result.args.timestamp.toNumber()}, status: ${result.args.status.toNumber() == STATUS_CODE_ON_TIME ? 'ON TIME' : 'DELAYED'}, nbVotes: ${result.args.nbVotes.toNumber()}`);
  } else {
    console.log(result.event);
  }
}

contract('Oracles', async (accounts) => {

  var config;
  let passenger;
  before('setup contract', async () => {
    passenger = accounts[TEST_ORACLES_COUNT + 2];
    config = await Test.Config(accounts);

    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    await config.flightSuretyApp.fundAirline({ from: config.firstAirline, value: web3.utils.toWei("10", "ether") });

    //await config.flightSuretyApp.allEvents(null).on('data', (result) => {
    //  handleEvent(result);
    //});
  });

  it('can register oracles', async () => {

    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for (let a = 2; a < TEST_ORACLES_COUNT + 1; a++) {
      try {
        await config.flightSuretyApp.registerOracle({ from: accounts[a], value: fee });
      } catch (e) {
        console.log(e);
      }
      let result = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a] });
      console.log(`Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`);
    }
  });

  it('can register flight and buy insurance', async () => {
    // ARRANGE
    let flight = 'ND1309'; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    // Register flights
    await config.flightSuretyApp.registerFlight(flight, timestamp, { from: config.firstAirline });

    var eventTriggered = false;
    await config.flightSuretyApp.contract.getPastEvents('FlightRegistered', null, (err, result) => {
      if (result.length > 0) {
        eventTriggered = true;
      }
    });
    assert(eventTriggered, "Event FlightRegistered not emitted");

    // Fail to purcahase insurance if more than 1 ethere
    let failed = false;
    try {
      await config.flightSuretyApp.buyInsurance(config.firstAirline, flight, timestamp,
        { from: passenger, value: web3.utils.toWei("1.000001", "ether") });
    } catch (e) {
      failed = true;
    }
    assert(failed, "Cannot purchase an insurance worth more than 1 ether");

    // Purchase insurance
    await config.flightSuretyApp.buyInsurance(config.firstAirline, flight, timestamp,
      { from: passenger, value: web3.utils.toWei("0.5", "ether") });

    eventTriggered = false;
    await config.flightSuretyApp.contract.getPastEvents('InsuranceBought', null, (err, result) => {
      if (result.length > 0) {
        eventTriggered = true;
      }
    });
    assert(eventTriggered, "Event InsuranceBought not emitted");
  });

  it('can request flight status and claim insurance', async () => {

    // ARRANGE
    let flight = 'ND1309'; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp, { from: config.owner });
    // ACT

    var eventTriggered = false;
    await config.flightSuretyApp.contract.getPastEvents('OracleRequest', null, (err, result) => {
      if (result.length > 0) {
        eventTriggered = true;
      }
    });
    assert(eventTriggered, "Event OracleRequest not emitted");

    // Get initial balance to see if we have a claim, the balance increases
    const initial = new BN(await web3.eth.getBalance(passenger));
    let insuranceClaimed = false;

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for (let a = 2; a < TEST_ORACLES_COUNT + 1; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a] });
      for (let idx = 0; idx < 3; idx++) {

        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_LATE_AIRLINE, { from: accounts[a] });
          console.log("Worked: ", idx, ": ", oracleIndexes[idx].toNumber());

          eventTriggered = false;
          await config.flightSuretyApp.contract.getPastEvents('OracleReport', null, (err, result) => {
            if (result.length > 0) {
              eventTriggered = true;
            }
          });
          assert(eventTriggered, "Event not emitted");

          await config.flightSuretyApp.contract.getPastEvents('FlightStatusInfo', null, async (err, result) => {
            if (result.length > 0) {
              if (!insuranceClaimed) {
                insuranceClaimed = true;
                let result = await config.flightSuretyApp.claimInsurance({ from: passenger });
                const gasUsed = new BN(result.receipt.gasUsed);
                const tx = await web3.eth.getTransaction(result.tx);
                const gasPrice = new BN(tx.gasPrice);
                const value = new BN(web3.utils.toWei("0.75", "ether"));  // 1.5 * 0.5
                const final = new BN(await web3.eth.getBalance(passenger));
                // If this piece of code is reached twice, it should not trigger the payout twice
                // the below assert should still be true on all passages
                assert.equal((final.add(gasPrice.mul(gasUsed)).sub(value)).toString(), initial.toString(), "Must be equal");
              } else {
                // Should fail
                let worked = false;
                try {
                  await config.flightSuretyApp.claimInsurance({ from: passenger });
                } catch (e) {
                  worked = true;
                }
                assert(worked, "Cannot call funds twice");
              }
            }
          });
        } catch (e) {
          //console.log(e.message);
          // Enable this when debugging
          //console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
        }
      }
    };
  });

  it('can request flight status and if not late, no insurance is claimed', async () => {

    // ARRANGE
    let flight = 'ND1310'; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    await config.flightSuretyApp.registerFlight(flight, timestamp, { from: config.firstAirline });
    await config.flightSuretyApp.buyInsurance(config.firstAirline, flight, timestamp,
      { from: passenger, value: web3.utils.toWei("0.5", "ether") });

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp, { from: config.owner });

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for (let a = 2; a < TEST_ORACLES_COUNT + 1; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a] });
      for (let idx = 0; idx < 3; idx++) {

        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_ON_TIME, { from: accounts[a] });
          console.log("Worked: ", idx, ": ", oracleIndexes[idx].toNumber());

          await config.flightSuretyApp.contract.getPastEvents('FlightStatusInfo', null, async (err, result) => {
            if (result.length > 0) {
              // Should fail
              let worked = false;
              try {
                await config.flightSuretyApp.claimInsurance({ from: passenger });
              } catch (e) {
                worked = true;
              }
              assert(worked, "Flight not delayed, so no claims");
            }
          });
        } catch (e) {
          //console.log(e.message);
          // Enable this when debugging
          //console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
        }
      }
    }
  });
});
