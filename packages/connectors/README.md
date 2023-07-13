# Connectors

Connectors provide a simple way to connect contracts cross-chain without introducing any cross-chain logic. Connectors can be called as if they were the cross-chain contract itself.

### Example

In this example, `connector` represents an instance of `YourContract` that lives on a different chain.
```solidity
YourContract(connector).doSomething()
```

### How it works
Each Connector has a single counterpart, another connector on another chain. Each Connector pair connects two target contracts. When a target calls a connector, the counterpart can replay the call to the target to the contract on the destination chain and vis-a-versa.

```
YourTarget <> Connector <-|-> Connector <> YourTarget
                            |
            Optimism        |        Arbitrum
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
