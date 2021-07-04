//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";

contract FlightSuretyData is Ownable {

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    struct InsuranceAgreement {
        address insuredPassenger;
        uint256 insuredAmount;
    }
    
    bool private operational = true;                       // Blocks all state changes throughout the contract if false
    mapping(address => bool) private authorizedContracts;
    mapping(address => uint8) private registeredAirlines;  // 0: not registered, 1: registered but have not paid
                                                           // 2: registered and paid
    mapping(bytes32 => InsuranceAgreement[]) insurances;
    mapping(address => uint256) insurancePayouts;

    uint256 private constant airlineFee = 10 ether;
    uint256 private constant maxInsuranceFee = 1 ether;

    event AirlineRegistered(address airline);
    event AirlineFunded(address airline);

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(address firstAirline) {
        _registerAirline(firstAirline);
    }

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
     * @dev Modifiers that requires the caller to be authorised
     */
    modifier requireAuthorised() {
        require(authorizedContracts[msg.sender], "Not authorised to call the contract");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() public view returns(bool) {
        return operational;
    }

    /**
     * @dev Authorise the calling address
     */
    function authorizeCaller(address _address) public onlyOwner {
        authorizedContracts[_address] = true;
    }

    /**
     * @dev Removes the authorisation for the address
     */
    function revokeAuthorisation(address _address) public onlyOwner {
        authorizedContracts[_address] = false;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus(bool mode) external onlyOwner {
        operational = mode;
    }

    /**
     * @dev Checks if the airline is registered and paid already
     */
    function isAirline(address _address) public view returns(bool) {
        return registeredAirlines[_address] == 2;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline(address _address) external requireAuthorised requireIsOperational {
        _registerAirline(_address);
        emit AirlineRegistered(_address);
    }

    function _registerAirline(address _address) private {
        registeredAirlines[_address] = 1;
    }

    /**
     * @dev purely for testing purposes
     */
    function testOperational() public requireIsOperational {}


    /**
     * @dev Buy insurance for a flight
     *
     * @param passenger address of the passenger buying the insurance
     * @param flight name of the flight to be insured
     *
     */   
    function buy(address passenger, bytes32 flight) external payable requireAuthorised requireIsOperational {
        require(msg.value <= maxInsuranceFee, "Maximum insurance fee of 1 ether");

        InsuranceAgreement memory agreement = InsuranceAgreement({
            insuredPassenger: passenger,
            insuredAmount: msg.value
        });
        
        insurances[flight].push(agreement);
    }

    /**
     *  @dev Credits payouts to insurees
     *
     * @param flight the flight key for which we are claiming insurance
    */
    function creditInsurees(bytes32 flight) external requireIsOperational requireAuthorised {
        uint arrayLength = insurances[flight].length;
        for (uint i = 0; i < arrayLength; i++) {
            insurancePayouts[insurances[flight][i].insuredPassenger] = 
                insurances[flight][i].insuredAmount * 3 / 2; //1.5 multiplier
        }

        // Clean up the insurance
        delete insurances[flight];
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     * @param insured the insured passenger to be paid
    */
    function pay(address payable insured) external requireIsOperational requireAuthorised {
        uint256 insuranceValue = insurancePayouts[insured];
        require(insuranceValue > 0, "No funds to pay");
        delete insurancePayouts[insured];
        insured.transfer(insuranceValue);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund(address airline) public payable requireIsOperational requireAuthorised {
        if (registeredAirlines[airline] == 0){
            revert("Airline not registered yet");
        }
        require(registeredAirlines[airline] == 1, "You have paid already");
        require(msg.value >= airlineFee, "Need to pay at least 10 ether");

        registeredAirlines[airline] = 2;
        emit AirlineFunded(airline);
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    * No need to add requireIsOperational given it calls fund which requires it
    */
    receive() external payable requireIsOperational {
        fund(msg.sender);
    }
}

