# FlightSurety

FlightSurety is a sample application project for Udacity's Blockchain course.

## Install

This repository contains Smart Contract code in Solidity (using Truffle), tests (also using Truffle), dApp UI (using HTML, CSS and JS) and server app (using JS and expressjs).

I had the following versions installed:

* Truffle v5.3.13 (core: 5.3.13)
* Solidity - 0.8.6 (solc-js)
* Node v16.4.0
* Web3.js v1.3.6

After downloading the repo, and with the above libraries installed, type on a command line:

`npm install`

This will install all the needed dependencies in package.json

To install, download or clone the repo, then:

## Develop Client

Run a ganache chain, I used the UI one, but you can use the cli as well, just make sure to change the truffle.js config accordingly. To connect to ganache, you would type:

`truffle console --network ganache`

Then on the console, to compile, type:

`compile`

This will compile the solidity contracts, and then to deploy them on the chain, type:

`migrate`

To run truffle tests, type:

`test`

This will run all the tests, alternatively you can run them one by one using the following:

`truffle test ./test/flightSurety.js`
`truffle test ./test/oracles.js`

To use the dapp:

`npm run dapp`

To view dapp:

`http://localhost:8000`

## Develop Server

`npm run server`

To view and interact with the server:

`http://localhost:3000`

## Deploy

To build dapp for prod:
`npm run dapp:prod`

Deploy the contents of the ./dapp folder


# Project Commentary
I Cannot add airline at App constructor level, because to add an airline you need to be authorized to interact with the Data contract. However, it's impossible for the App contract to be authorized with Data contract before it's even constructed. So the airline is added at a migration stage instead, and then the user would fund the airline from the DApp.

I used openzeppelin contracts for the ownable interface, and replaced the existing scaffolding code for that, as it's more robust like this.

The scaffoling code had a bug in the nonce to generate random indexes, increasing the nonce may end up eventually with the nonce being larger than the block number, which would underflow it and cause bugs, I amended that, it does mean it's less "random" now but it's enough for testing purposes.

To be able to catch events, I need to enable websockets in the web3 provider, I did that in truffle.js

I also amended the ResponeInfo responses field to a mapping as opposed to an array to guarantee that an oracle votes once, and avoid sybil attacks where one oracle keeps on voting.
