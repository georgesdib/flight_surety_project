
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let contract = new Contract('localhost', () => {
        // Add events listener
        contract.addEventsListener(displayEvents);

        // Check opetrational flag
        handleAppOperational(contract);
        handleDataOperational(contract);

        // App Operational change
        handleAppOperationalChange(contract, 'app-operational', true);
        handleAppOperationalChange(contract, 'app-not-operational', false);

        // Data Operational change
        handleDataOperationalChange(contract, 'data-operational', true);
        handleDataOperationalChange(contract, 'data-not-operational', false);

        // Fund Airline button, current account should be the airline funding itself
        DOM.elid('fund-airline').addEventListener('click', () => {
            // Write transaction
            contract.fundAirline((error, result) => {
                if (error) {
                    console.error(error);
                } else {
                    console.log('Airline funded');
                    console.log(result);
                }
            });
        })

        // Claim Insurance button, current account should be the passenger claiming
        DOM.elid('claim-insurace').addEventListener('click', () => {
            // Write transaction
            contract.claimInsurance((error, result) => {
                if (error) {
                    console.error(error);
                } else {
                    console.log('Insurance Claimed');
                    console.log(result);
                }
            });
        })

        // Register a new airline, the caller has to be an existing funded airline
        DOM.elid('register-airline').addEventListener('click', () => {
            let airline = DOM.elid('airline-address').value;
            // Write transaction
            contract.registerAirline(airline, (error, result) => {
                if (error) {
                    console.error(error);
                } else {
                    console.log('Airline Registered');
                    console.log(result);
                }
            });
        })

        // Register a flight, must be submitted by an airline
        DOM.elid('register-flight').addEventListener('click', () => {
            let flightName = DOM.elid('flight-name').value;
            let flightTime = DOM.elid('flight-time').value;
            // Write transaction
            contract.registerFlight(flightName, flightTime, (error, result) => {
                if (error) {
                    console.error(error);
                } else {
                    console.log('Flight Registered');
                    console.log(result);
                }
            });
        })

        // Buys insurance, must be sent by a passenger
        DOM.elid('buy-insurance').addEventListener('click', () => {
            let amount = prompt("What is the premium you want to pay in ether? (Maximum 1 ether", "1");
            if (amount !== null && amount !== "") {
                let flightName = DOM.elid('flight-name').value;
                let flightTime = DOM.elid('flight-time').value;
                let airline = DOM.elid('airline-address').value;
                // Write transaction
                contract.buyInsurance(flightName, flightTime, airline, amount, (error, result) => {
                    if (error) {
                        console.error(error);
                    } else {
                        console.log('Insurance bought');
                        console.log(result);
                    }
                });
            }
        })

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flightName = DOM.elid('flight-name').value;
            let flightTime = DOM.elid('flight-time').value;
            let airline = DOM.elid('airline-address').value;
            // Write transaction
            contract.fetchFlightStatus(airline, flightName, flightTime, (error, result) => {
                display('Oracles', 'Trigger oracles',
                    [ { label: 'Fetch Flight Status', error: error,
                         value: result.airline + ' ' + result.flight + ' ' + result.timestamp} ]);
            });
        })
    
    });
    

})();

function handleAppOperational(contract) {
    contract.isAppOperational((error, result) => {
        if (error) {
            console.error(error);
        } else if (result.toString() === 'true') {
            DOM.elid('app-operational').checked = true;
        } else {
            DOM.elid('app-not-operational').checked = true;
        }
    })
}

function handleDataOperational(contract) {
    contract.isDataOperational((error, result) => {
        if (error) {
            console.error(error);
        } else if (result.toString() === 'true') {
            DOM.elid('data-operational').checked = true;
        } else {
            DOM.elid('data-not-operational').checked = true;
        }
    })
}

function handleAppOperationalChange(contract, id, mode) {
    DOM.elid(id).addEventListener('change', () => {
        contract.setAppOperatingStatus(mode, (error, result) => {
            if (error) {
                console.error(error);
            }
        });
    });
}

function handleDataOperationalChange(contract, id, mode) {
    DOM.elid(id).addEventListener('change', () => {
        contract.setDataOperatingStatus(mode, (error, result) => {
            if (error) {
                console.error(error);
            }
        });
    });
}

function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = displayDiv.getElementsByTagName('section');
    if (section) {
        for (let sect of section) {
            sect.remove();
        }
    }
    section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);
}

function displayEvents(data, statusCode) {
    let eventsDiv = DOM.elid('txt-events');
    let line = DOM.li({}, String(data));
    eventsDiv.append(line);
    if (statusCode) {
        let row = DOM.elid("display-wrapper").getElementsByClassName('row')[0];
        let field = row.getElementsByClassName('col-sm-12- field-value');
        if (field.length === 0) {
            row.appendChild(DOM.div({className: 'col-sm-12- field-value'}, 'Flight Status verified: ' + statusCode));
        } else {
            field.innerHTML = 'Flight Status verified: ' + statusCode;
        }
    }
}