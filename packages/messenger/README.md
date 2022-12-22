# Hop Core Messenger

The Hop Core Messenger is a simple, trustless messaging protocol that can be used to build powerful cross-chain applications.

### How it works
* The Core Messenger uses a hub-and-spoke model
* Messages are aggregated into bundles.
* The bundle is hashed and sent to the destination
* Native bridges with Ethereum are used to pass the bundle hash
* At the destination, messages in the bundle can be unpacked and executed

Because the native bridges can sometimes be slow, the Hop Core Messenger is best used for messages that need to be trustless and secure but are not time sensitive (e.g. DAO governance actions). Despite it's limitations in speed, the Hop Core Messenger can act as a powerful trustless settlement-layer for much faster types of messaging such as collateralized messaging and optimistic messaging (as seen in Hop V1).

## Deployments

### Testnet

 * Goerli - `HubMessageBridge` - [`0xE3F4c0B210E7008ff5DE92ead0c5F6A5311C4FDC`](https://goerli.etherscan.io/address/0xE3F4c0B210E7008ff5DE92ead0c5F6A5311C4FDC#code)
 * Optimism Goerli - `SpokeMessageBridge` - [`0xeA35E10f763ef2FD5634dF9Ce9ad00434813bddB`](https://goerli-optimism.etherscan.io/address/0xeA35E10f763ef2FD5634dF9Ce9ad00434813bddB#code)

## Getting Started

### Send a message

```solidity
ICrossChainSender(hopMessageBridge).sendMessage(toChainId, to, data);
```

### Receive a message

```solidity
function myFunction() external {
    // validation
    require(msg.sender == hopMessageBridge, "Invalid sender");
    address from = ICrossChainReceiver(hopMessageBridge).getCrossChainSender();
    uint256 fromChainId = ICrossChainReceiver(hopMessageBridge).getCrossChainChainId();
    require(from == expectedCrossChainSender, "Invalid cross-chain sender");
    require(fromChainId == expectedCrossChainId, "Invalid cross-chain chainId");

    // Business logic
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
