# Aliases

Deploy an Alias contract to represent your source contract on a different chain. Source contracts have complete control of their Aliases and can transact on foreign chains through the Alias contract. Aliases can own tokens, NFTs, etc. and interact with other contracts just like regular addresses.

## Use Cases

* Governance - Deploy Aliases on L2s to represent your L1 governance contract. This allows your L1 governance contract to control your L2 deployments without modifying established access-control paradigms like `Ownable`.
* Multichain Payments - Deploy Aliases across many chains to allow users to pay on any chain. All aliases can be controlled by a single source contract on L1 or L2 which can collect the accrued payments periodically.
* Multichain multisig - A single multisig contract can control aliases on many chains. This allows the multisig to have multichain reach without needing to maintain separate lists of signers and signature thresholds.

### Example

In this example, a contract dispatches a message to be executed by its `Alias` on the destination chain by calling `dispatchMessage` or `dispatchMessageWithValue` on its `AliasDispatcher`
```solidity
AliasDeployer(aliasDispatcher).dispatchMessage(toChainId, to, data);
```

### How it works

Each `Alias` deployment is controlled by the source address. The source address is the contract that controls the cross-chain `Alias` contracts through the `AliasDispatcher`. Each deployment consists of one `AliasDispatcher` on the source chain and an `Alias` contract on one or more foreign chains. The source address calls `dispatchMessage` or `dispatchMessageWithValue` on its `AliasDispatcher` to initiate a message from one of its deployed `Alias` contracts. All Alias interactions are one-way -- starting with the source address and ending with an interaction from an `Alias` contract.

```
SourceAddress > AliasDispatcher --|-> Alias > Target
                                  |
            Optimism              |        Arbitrum
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

### Lint

```shell
npm run lint
```
