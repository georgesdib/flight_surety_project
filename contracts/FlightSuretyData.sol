//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

contract FlightSuretyData {

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                         // Account used to deploy contract
    bool private operational = true;                       // Blocks all state changes throughout the contract if false
    mapping(address => bool) private authorizedContracts;
    mapping(address => uint8) private registeredAirlines;  // 0: not registered, 1: registered but have not paid
                                                           // 2: registered and paid

    uint256 private constant airlineFee = 10 ether;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor() {
        contractOwner = msg.sender;
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
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
     * @dev Modifiers that requires the caller to be authorised
     */
    modifier requireAuthorised(address _address) {
        require(authorizedContracts[_address], "Not authorised to call the contract");
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
    function authorizeCaller(address _address) public requireContractOwner {
        authorizedContracts[_address] = true;
    }

    /**
     * @dev Removes the authorisation for the address
     */
    function revokeAuthorisation(address _address) public requireContractOwner {
        authorizedContracts[_address] = false;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus(bool mode) external requireContractOwner {
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
    function registerAirline(address _address) external requireAuthorised(msg.sender) requireIsOperational {
        registeredAirlines[_address] = 1;
    }

    /**
     * @dev purely for testing purposes
     */
    function testOperational() public requireIsOperational {}


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy() external payable requireIsOperational {

    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees() external requireIsOperational {
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay() external requireIsOperational {
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund() public payable requireIsOperational {
        require(registeredAirlines[msg.sender] == 1, "You are either not registered or have paid already");
        require(msg.value >= airlineFee, "Need to pay at least 10 ethere");

        registeredAirlines[msg.sender] = 2;
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    * No need to add requireIsOperational given it calls fund which requires it
    */
    receive() external payable {
        fund();
    }
}

