
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let result = null;

    let contract = new Contract('localhost', () => {
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

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            // Write transaction
            contract.fetchFlightStatus(flight, (error, result) => {
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp} ]);
            });
        })
    
    });
    

})();

function handleAppOperational(contract) {
    contract.isAppOperational((error, result) => {
       if (result.toString() === 'true') {
            DOM.elid('app-operational').checked = true;
        } else {
            DOM.elid('app-not-operational').checked = true;
        }
    })
}

function handleDataOperational(contract) {
    contract.isDataOperational((error, result) => {
        if (result.toString() === 'true') {
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
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        //row.appendChild(DOM.div({className: 'col-sm-0 field'}, DOM.button({className: 'btn btn-primary', id: 'toggle-operational'}, 'Toggle Operational')));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value', id: 'is-operational'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}