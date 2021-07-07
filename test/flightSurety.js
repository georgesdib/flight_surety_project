
var Test = require('../config/testConfig.js');
const assert = require('assert');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
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
      } catch(e) {
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
    let reverted = false;
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
    } catch (e)  {
        reverted = true;
    }
    assert(reverted, "Cannot register an airline from a non funded airline");

    // Now fund the airline
    await config.flightSuretyApp.fundAirline({ from: config.firstAirline, value: web3.utils.toWei("10", "ether") });
    // This should succeed
    await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
    let result = await config.flightSuretyData.isAirline.call(newAirline);

    // ASSERT
    assert(!result, "Only becomes a fully fledged airline after funding itself");

  });
  
  it('(airline) can register up to 3 other airlines', async () => {
    let newAirline = accounts[2];
    let newAirline2 = accounts[3];
    let newAirline3 = accounts[4];

    await config.flightSuretyApp.fundAirline({ from: newAirline, value: web3.utils.toWei("10", "ether") });
    await config.flightSuretyApp.registerAirline(newAirline2, {from: newAirline});
    await config.flightSuretyApp.fundAirline({ from: newAirline2, value: web3.utils.toWei("10", "ether") });
    result = await config.flightSuretyData.isAirline.call(newAirline2);

    assert(result, "Airline should be able to register another airline");

    await config.flightSuretyApp.registerAirline(newAirline3, {from: newAirline2});
    await config.flightSuretyApp.fundAirline({ from: newAirline3, value: web3.utils.toWei("10", "ether") });
    result = await config.flightSuretyData.isAirline.call(newAirline3);

    assert(result, "Airline should be able to register another airline");
  });

  it('(airline) can register the 5th and subsequent airlines with multi party concensus', async () => {
    let newAirline = accounts[2];
    let newAirline2 = accounts[3];
    let newAirline3 = accounts[4];
    let newAirline4 = accounts[5];

    // 1st vote, need 3
    await config.flightSuretyApp.registerAirline(newAirline4, {from: newAirline3});
    let reverted = false;
    try {
        await config.flightSuretyApp.fundAirline({ from: newAirline4, value: web3.utils.toWei("10", "ether") });
    } catch (e) {
        reverted = true;
    }

    assert(reverted, "Airline needs multi party concensus to register 5th airplane");

    // 2nd vote
    await config.flightSuretyApp.registerAirline(newAirline4, {from: newAirline});
    reverted = false;
    try {
        await config.flightSuretyApp.fundAirline({ from: newAirline4, value: web3.utils.toWei("10", "ether") });
    } catch (e) {
        reverted = true;
    }

    // Same airplane voting again should not count as an extra vote
    await config.flightSuretyApp.registerAirline(newAirline4, {from: newAirline});
    reverted = false;
    try {
        await config.flightSuretyApp.fundAirline({ from: newAirline4, value: web3.utils.toWei("10", "ether") });
    } catch (e) {
        reverted = true;
    }

    assert(reverted, "Airline needs multi party concensus to register 5th airplane");

    // 3rd and final vote
    await config.flightSuretyApp.registerAirline(newAirline4, {from: newAirline2});
    await config.flightSuretyApp.fundAirline({ from: newAirline4, value: web3.utils.toWei("10", "ether") });
    let result = await config.flightSuretyData.isAirline.call(newAirline4);

    assert(result, "Airline should be able to register 5th airplane through multi party concensus");
  });
});
