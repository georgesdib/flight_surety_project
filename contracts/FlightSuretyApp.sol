//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./FlightSuretyData.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp is Ownable {

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    bool private operational = true;
    FlightSuretyData private dataContract;

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
    }
    mapping(bytes32 => Flight) private flights;

    // Needs to be a mapping to make sure an airline cannot vote twice
    mapping(address => mapping(address => bool)) private airlines;
    mapping(address => uint8) private airlineVotes;
    uint256 private totalNumberAirlines = 1; // We always start with one airline registered

    event InsuranceClaimPaid(address);
    event FlightRegistered(string flight, uint256 timestamp, address airline);
    event AirlineRegistered(address airline);
    event AirlinePreRegistered(address airline, uint8 votes);
    event InsuranceBought(address airline, string flightName, uint256 flightTime, address customer, uint256 amount);
 
    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");  
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires that the caller is an airline
     */
    modifier requireAirline() {
        require(dataContract.isAirline(msg.sender), "Not an airline");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    * Takes the address of the dataContract and registers it
    */
    constructor (address payable _dataContract) {
        dataContract = FlightSuretyData(_dataContract);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public view returns(bool) {
        return operational;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus(bool mode) external onlyOwner {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/
   
   /**
    * @dev Add an airline to the registration queue
    *
    */   
    function registerAirline(address airline) external requireIsOperational requireAirline
        returns(bool success, uint256 votes) {

        // Up to the 4th registered airline can be registered by a sole airline
        if (totalNumberAirlines < 4) {
            _registerAirline(airline);
            return (true, 1);
        }

        // 5th and subsequent airline need 50% of the votes of all registered airlines
        if (!airlines[airline][msg.sender]) { // This airline has not voted yet
            airlines[airline][msg.sender] = true; // Voted
            airlineVotes[airline]++;

            if (airlineVotes[airline] > totalNumberAirlines / 2) {
                _registerAirline(airline);
                return (true, airlineVotes[airline]);
            }
        }

        emit AirlinePreRegistered(airline, airlineVotes[airline]);
        return (false, airlineVotes[airline]);
    }

    function _registerAirline(address airline) internal {
        dataContract.registerAirline(airline);
        totalNumberAirlines++;
        emit AirlineRegistered(airline);
    }


   /**
    * @dev Register a future flight for insuring.
    *
    * @param flightName codenumber of the flight
    * @param flightTime time of the flight
    *
    * The sender should be the airline registering the flight
    */  
    function registerFlight(string memory flightName, uint256 flightTime) external requireIsOperational {
        require(dataContract.isAirline(msg.sender), "Only an airline can register a flight");

        bytes32 key = getFlightKey(msg.sender, flightName, flightTime);
        Flight storage flight = flights[key];

        flight.isRegistered = true;
        flight.statusCode = STATUS_CODE_UNKNOWN;
        flight.updatedTimestamp = flightTime;
        flight.airline = msg.sender;

        emit FlightRegistered(flightName, flightTime, msg.sender);
    }

    /**
     * @dev Passenger buys an insurance for a flight
     * sender is the passenger
     *
     * @param flightName codename of the flight to be insured
     */
    function buyInsurance(address airline,
                          string memory flightName,
                          uint256 flightTime) external payable requireIsOperational {

        bytes32 key = getFlightKey(airline, flightName, flightTime);

        require(flights[key].isRegistered, "Flight not registered");
        require(flights[key].statusCode == STATUS_CODE_UNKNOWN,
            "Cannot buy insurance on a flight that has already departed");

        dataContract.buy{value: msg.value}(msg.sender, key);

        emit InsuranceBought(airline, flightName, flightTime, msg.sender, msg.value);
    }

    /**
     * @dev Passenger (who is the sender of the call) claims the insurance payout
     */
    function claimInsurance() external requireIsOperational {
        dataContract.pay(payable(msg.sender));

        emit InsuranceClaimPaid(msg.sender);
    }
    
   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus(address airline,
                                 string memory flight,
                                 uint256 timestamp,
                                 uint8 statusCode) internal requireIsOperational {

        bytes32 key = getFlightKey(airline, flight, timestamp);
        require(flights[key].isRegistered, "Flight not registered");

        flights[key].statusCode = statusCode;

        if (statusCode == STATUS_CODE_LATE_AIRLINE) {
            // Check if passenger has insurance and pay out if so
            dataContract.creditInsurees(key);
        }
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(address airline, string memory flight, uint256 timestamp) external requireIsOperational {
        uint8 index = getRandomIndex(msg.sender, 0);

        // Generate a unique key for storing the request
        bytes32 key = getFlightKey(index, airline, flight, timestamp);
        ResponseInfo storage newResponse = oracleResponses[key];
        newResponse.requester = msg.sender;
        newResponse.isOpen = true;

        emit OracleRequest(index, airline, flight, timestamp);
    }

    /**
     * @dev Funds the airline
     */
    function fundAirline() external payable requireIsOperational {
        dataContract.fund{value: msg.value}(msg.sender);
    }

// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    //uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 =>                                // Mapping key is the status code reported
            mapping(address => bool)) responses;        // This lets us group responses and identify
        mapping(uint8 => uint256) nbResponses;          // the response that majority of the oracles
        // I have changed that from array to mapping(address => bool) to guarantee that one oracle
        // votes only one. This meant that I needed to add the nbResponses mapping because we cannot
        // get the length of the responses[key] mapping unlike an array                                      
                                                        
    }

    // Track all oracle responses
    // Key = hash(index, airline, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status, uint256 nbVotes);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle() external payable requireIsOperational {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({isRegistered: true, indexes: indexes});
    }

    function getMyIndexes() view external returns(uint8[3] memory) {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(uint8 index,
                                  address airline,
                                  string memory flight,
                                  uint256 timestamp,
                                  uint8 statusCode) external requireIsOperational {
        require((oracles[msg.sender].indexes[0] == index) ||
                (oracles[msg.sender].indexes[1] == index) ||
                (oracles[msg.sender].indexes[2] == index),
                "Index does not match oracle request");


        bytes32 key = getFlightKey(index, airline, flight, timestamp);
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");
        
        require(!oracleResponses[key].responses[statusCode][msg.sender],
            "Oracle voted already");
        oracleResponses[key].responses[statusCode][msg.sender] = true;
        uint256 n = oracleResponses[key].nbResponses[statusCode];
        oracleResponses[key].nbResponses[statusCode] = n + 1;

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode, oracleResponses[key].nbResponses[statusCode]);
        if (oracleResponses[key].nbResponses[statusCode] >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey(uint8 index,
                          address airline,
                          string memory flight,
                          uint256 timestamp) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(index, airline, flight, timestamp));
    }

    function getFlightKey(address airline,
                          string memory flight,
                          uint256 timestamp) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal view returns(uint8[3] memory) {
        uint8[3] memory indexes;
        uint8 nonce = 0;
        indexes[0] = getRandomIndex(account, nonce++);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account, nonce++);
            if (nonce == 250) { // Break the cycle here and give up
                break;
            }

        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account, nonce++);
            if (nonce > 250) {
                break;
            }
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account, uint8 nonce) internal view returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        // This actually causes bugs because nonce can become bigger than block.number
        //uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce), account))) % maxValue);

        //if (nonce > 250) {
        //    nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        //}

        return random;
    }

// endregion

}   
