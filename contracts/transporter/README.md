# Hop Transporter

`Transporter`s are used for tranporting data such as bundles cross-chain. The data being transported is always represented by a single hash called a `commitment`. In this case, the `commitment` is the hash of the bundle data -- the `bundleHash`.

The default `Transporter` uses the native bridges to transport the `bundleHash` using Ethereum as a hub. This is a simple transport method optimized for trustlessness and security but it can be quite slow in some cases such as sending a message from an optimistic rollup.

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
