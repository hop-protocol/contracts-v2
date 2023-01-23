# Hop Core Messenger

The Hop Core Messenger is a simple, trustless messaging protocol that can be used to build powerful cross-chain applications.

### How it works
* The Core Messenger uses a hub-and-spoke model
* Messages are aggregated into bundles
* The bundle is hashed and sent to the destination
* Native bridges with Ethereum are used to pass the bundle hash
* At the destination, messages in the bundle can be unpacked and executed

Because the native bridges can sometimes be slow, the Hop Core Messenger is best used for messages that require trustlessness and high-security but are not time sensitive (e.g. value settlement, dispute resolution, DAO governance, etc.).

Faster messaging models such as collateralized messaging and optimistic messaging (as seen in Hop V1) can be easily implemented on top of the Core Messenger for application-specific or generalized use cases.

## Deployments

### Testnet

 * Goerli - `HubMessageBridge` - [`0xE3F4c0B210E7008ff5DE92ead0c5F6A5311C4FDC`](https://goerli.etherscan.io/address/0xE3F4c0B210E7008ff5DE92ead0c5F6A5311C4FDC#code)
 * Optimism Goerli - `SpokeMessageBridge` - [`0xeA35E10f763ef2FD5634dF9Ce9ad00434813bddB`](https://goerli-optimism.etherscan.io/address/0xeA35E10f763ef2FD5634dF9Ce9ad00434813bddB#code)

## Getting Started

### Send a message

You can send a message by calling the EIP-5164 method, `dispatchMessage`.

```solidity
ISingleMessageDispatcher(hopMessageBridge).dispatchMessage(toChainId, to, data);
```

### Receive a message

When receiving a message, inherit from [`CrossChainEnabled`](https://github.com/hop-protocol/contracts-v2/blob/master/packages/messenger/contracts/erc5164/CrossChainEnabled.sol) to access the `messageId`, `from` address, and `fromChainId`.

```solidity
contract MyContract is CrossChainEnabled {
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
