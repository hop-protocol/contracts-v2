# ERC721CrossChain

Cross-chain ERC721 contracts.

### How it works

These contracts provide a simple and convenient way to send and track cross-chain NFT transfers by creating a receipt for each cross-chain transfer. A trail of transfer receipts allows off-chain participants to verify the legitimacy of a bridged NFT before the receipt trail has fully propagated. Additionally, it allows on-chain participants to verify the NFT's legitimacy after the receipt trail has been propagated to the destination chain(s).

Initial design inspiration comes from Vitalik's "Cross-rollup NFT wrapper and migration ideas" [ETH Research post](https://ethresear.ch/t/cross-rollup-nft-wrapper-and-migration-ideas/10507).

Some key concepts:

* NFTs can be sent to/from any supported chain
* Off-chain participants can instantly verify the legitimacy of these NFTs after they are sent to a new chain
* On-chain participants can verify the legitimacy slowly after the receipt trail has been propagated to the destination chain(s)
* Anyone can mint an NFT for any serial number on any chain at any time, but the NFT can only be in a confirmed state on one chain
* Modules with case-specific logic can be built on top of the core bridge
* A token ID may exist simultaneously on multiple chains, but it can only be confirmed on one chain at any given time

## Getting Started

You can create an NFT by minting it:

```solidity
function mintWrapper(uint256 serialNumber, uint256 previousTokenId)
```

You can send an NFT to any supported chain:

```solidity
function send(uint256 tokenId, uint256 toChainId, address to)
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
