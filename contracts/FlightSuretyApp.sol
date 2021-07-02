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
        uint8 statusCode;
        uint256 updatedTimestamp;        
        address airline;
    }
    mapping(bytes32 => Flight) private flights;

    mapping(address => uint8) private airlines;
    uint256 private totalNumberAirlines;

 
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
        require(dataContract.isAirline(msg.sender) || totalNumberAirlines == 0, "Not an airline");
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

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

  
   /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus(bool mode) external onlyOwner {
        operational = mode;
    }
   
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
        airlines[airline]++; // One more vote
        if (airlines[airline] > totalNumberAirlines / 2) {
            _registerAirline(airline);
            return (true, airlines[airline]);
        }

        return (false, airlines[airline]);
    }

    function _registerAirline(address airline) internal {
        dataContract.registerAirline(airline);
        totalNumberAirlines++;
    }


   /**
    * @dev Register a future flight for insuring.
    *
    * @param flightTime time of the flight
    * @param flightName codenumber of the flight
    */  
    function registerFlight(uint256 flightTime, bytes32 flightName) external requireIsOperational {
        Flight storage flight = flights[flightName];

        flight.statusCode = STATUS_CODE_UNKNOWN;
        flight.updatedTimestamp = flightTime;
        flight.airline = msg.sender;

        emit FlightRegistered(flightName, flightTime, msg.sender);
    }

    /**
     * @dev Passenger buys an insurance for a flight
     *
     * @param flightName codename of the flight to be insured
     */
    function buyInsurance(bytes32 flightName) external payable requireIsOperational {
        require(flights[flightName].statusCode == STATUS_CODE_UNKNOWN,
            "Cannot buy insurance on a flight that has already departed");
        dataContract.buy{value: msg.value}(msg.sender, flightName);
    }
    
   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus(address airline,
                                 string memory flight,
                                 uint256 timestamp,
                                 uint8 statusCode) internal requireIsOperational {
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(address airline, string memory flight, uint256 timestamp) external requireIsOperational {
        uint8 index = getRandomIndex(msg.sender);

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
    uint8 private nonce = 0;    

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
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);

    event FlightRegistered(bytes32 flight, uint256 timestamp, address airline);


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

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

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

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns(uint8[3] memory) {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}   
