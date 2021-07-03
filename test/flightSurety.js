
var Test = require('../config/testConfig.js');
const assert = require('assert');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: web3.utils.toWei("10", "ether")});
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert(status, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert(accessDenied, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert(!accessDenied, "Access not restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSuretyData.testOperational();
      }
      catch(e) {
          reverted = true;
      }
      assert(reverted, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
    let result = await config.flightSuretyData.isAirline.call(newAirline);

    // ASSERT
    assert(!result, "Airline should not be able to register another airline if it hasn't provided funding");

  });

  it('(airline) can register a flight using registerFlight() and passenger buys insurance', async () => {
    
    // ARRANGE
    let passenger = accounts[3];
    let flight = 'ND1309'; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    // ACT
    await config.flightSuretyApp.registerFlight(flight, timestamp, {from: config.firstAirline});
    await config.flightSuretyApp.buyInsurance(config.firstAirline, flight, timestamp,
      {from: passenger, value: web3.utils.toWei("0.5", "ether")});

  });
 

});
