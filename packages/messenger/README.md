# Hop Core Messenger

The Hop Messenger is a modular, trustless messaging protocol that can be used to build powerful cross-chain applications.

## Contracts

The Hop Messenger is primarily made up of 3 types of contracts:
 * `Dispatcher`s - dispatch and bundle messages
 * `Transporter`s - transport bundles cross-chain
 * `Executor`s - validate and execute messages

### Dispatchers

There is a single `Dispatcher` on each chain. Dispatchers are responsible for aggregating messages into bundles sending the bundle to the destination through the transport layer. A small fee is required for each message that is dispatched which goes toward the cost of transporting the bundle. A `Dispatcher` may use a single `Transporter` as the transport layer or it may use multiple for better security, speed, or trust tradeoffs.

### Transporters

`Transporter`s are used for tranporting data such as bundles cross-chain. The data being transported is always represented by a single hash called a `commitment`. In this case, the `commitment` is the hash of the bundle data -- the `bundleHash`.

The default `Transporter` uses the native bridges to transport the `bundleHash` using Ethereum as a hub. This is a simple transport method optimized for trustlessness and security but it can be quite slow in some cases such as sending a message from an optimistic rollup.

Applications that require different speed/trust/security tradeoffs can specify a different `Transporter` than the default or combine multiple together (see "Implementing custom validation" below).

### Executors

`Executor`s are responsible for validating and executing messages. Each `Executor` is actually two contracts, the `ExecutorManager` where most of the business logic lives and the `ExecutorHead` which calls the message receivers on behalf of the `ExecutorManager`. There is one `ExecutorManager`/`ExecutorHead` deployed on every supported chain.

_Note: The separation of the business logic contract, the `ExecutorManager`, from the contract capable of arbitrary execution, the `ExecutorHead`, allows us to mitigate the security risks that come with arbitary execution without needing to rely on fallible patterns like contract blacklists._

Before a message can be executed, the `ExecutionManager` must prove the bundle by verifying it with a `Transporter`. If a `MessageReceiver` has not specified a `Transporter`, a message that calls the `MessageReceiver` can be executed after the bundle has been proven with the default `Transporter`. If a `Transporter` is specified by the `MessageReceiver` the bundle must be proven with that `Transporter` before it can be executed (see "Implementing custom validation" below). 


## Getting Started

### Send a message

You can send a message by calling the EIP-5164 method, `dispatchMessage`.

```solidity
IMessageDispatcher(dispatcher).dispatchMessage(toChainId, to, data);
```

### Receive a message

When receiving a message, inherit from [`MessageReceiver`](https://github.com/hop-protocol/contracts-v2/blob/master/packages/messenger/contracts/erc5164/MessageReceiver.sol) to access the `EIP-5164` validation data -- `messageId`, `from` address, and `fromChainId`.

```solidity
contract MyContract is MessageReceiver {
    event MyMessageHandleEvent {
        bytes32 indexed messageId /*,
        ... your event params*/
    }

    function myFunction() external {
        // Parse the cross-chain context from the call
        (bytes32 messageId, address from, uint256 fromChainId) = _crossChainContext();

        // Validate the cross-chain caller
        require(msg.sender == hopMessageBridge, "Invalid sender");
        require(from == expectedCrossChainSender, "Invalid cross-chain sender");
        require(fromChainId == expectedCrossChainId, "Invalid cross-chain chainId");

        // Execute your business logic
        emit MyMessageHandleEvent(messageId, /* your event params */);
    }
}
```

### Implementing custom validation

Any contract that receives messages from an Executor can determine it's own message validation logic by registering an alternative `Transporter` that the `ExecutorManager` will validate with. This flexibility enables the Hop Messenger to support any method of message validation including methods based on optimistic mechanisms, zk cross-rollup storage proofs, zk cross-chain light clients, collateral-based mechanisms, or authority-based mechanisms. Cross-chain applications can choose to aggregate multiple validation methods to diversify security or trust-based risks. Bundles are agnostic to the validation method and any given bundle of messages may contain messages that utilize many different validation methods.

To register a non-default validation method, the contract receiving the message must implement one or both of the following methods:
```
function hop_transporter() external view returns (address);
function hop_messageVerifier() external view returns (address);
```
Any address may call `registerMessageReceiver(address receiver)` on the `ExecutorManager` contract which will call these functions and register the contracts selected `Transporter` and `MessageVerifier` contracts. The `Transporter` validates entire bundles and is called only once per bundle. The `MessageVerifier` can be used to verify individual messages and is called once every time a message is executed if a `MessageVerifier` is registered.

## Deployments

### Testnet

__Goerli__
 * `Dispatcher` - [``](https://goerli.etherscan.io/address/#code)
 * `ExecutorHead` - [``](https://goerli.etherscan.io/address/#code)
 * `ExecutorManager` - [``](https://goerli.etherscan.io/address/#code)
 * `HubTransporter` - [``](https://goerli.etherscan.io/address/#code)

__Optimism Goerli__
 * `Dispatcher` - [``](https://goerli-optimism.etherscan.io/address/#code)
 * `ExecutorHead` - [``](https://goerli-optimism.etherscan.io/address/#code)
 * `ExecutorManager` - [``](https://goerli-optimism.etherscan.io/address/#code)
 * `SpokeTransporter` - [``](https://goerli-optimism.etherscan.io/address/#code)

## Usage

### Compile Contracts
```shell
npm run compile
```

### Test
```shell
npm run test
```

### Deploy
Deploy to testnet chains (Goerli, Optimism Goerli, etc.)
```shell
npm run testnet:deploy
```

Deploy to mainnet chains (Ethereum, Arbitrum, etc.)
```shell
npm run mainnet
```

### Lint

```shell
npm run lint
```
