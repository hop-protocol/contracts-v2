## Cross-Chain Example Contracts

Examples of cross-chain contracts that can be easily imported and deployed.

### Cross-chain NFTs

Any new or existing NFT collection can now be sent cross-chain trustlessly:

* Existing collections can be wrapped and bridged with [`ERC721CrossChainWrapperManager.sol`](./ERC721/ERC721CrossChainWrapperManager.sol)
* Omnichain collections can be created and minted with [`ERC721CrossChainToken.sol`](./ERC721/ERC721CrossChainToken.sol)
* New and existing collections can be made cross-chain and distributed with a token sale using [`ERC721CrossChainTokenSale.sol`](./ERC721/ERC721CrossChainTokenSale.sol) or a merkle drop with [`ERC721CrossChainMerkleDrop.sol`](./ERC721/ERC721CrossChainMerkleDrop.sol)

Any of these contracts can be further extended. More examples coming soon.

Please see the [ERC721CrossChain library directory](../libraries/token/ERC721CrossChain/) for information about how the underlying contracts work.

## Usage

### Compile Contracts
```shell
npm run compile
```

### Test
```shell
npm run test
```
