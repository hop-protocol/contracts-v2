import { expect } from 'chai'
import { BigNumber, Signer } from 'ethers'
import { ethers } from 'hardhat'
import {
  DEFAULT_CHAIN_ID,
  DEFAULT_TOKEN_INDEX,
  DEFAULT_TOKEN_NAME,
  DEFAULT_TOKEN_SYMBOL,
} from './constants'
import { generateTokenId } from './utils'
import { TokenState } from './types'
import Fixture from './Fixture'

type Defaults = {
  tokenId: BigNumber
  tokenIds: BigNumber[]
  tokenIndex: BigNumber
  tokenIndexes: BigNumber[]
  chainIds: BigNumber[]
}

let fixture: Fixture
let sender: Signer
let defaults: Defaults

beforeEach(async function () {
  const signers = await ethers.getSigners()
  sender = signers[0]
  const chainIds = [DEFAULT_CHAIN_ID, DEFAULT_CHAIN_ID.add(1)]

  // Sanity check
  if ((await sender.getChainId()) !== DEFAULT_CHAIN_ID.toNumber()) {
    throw new Error('Sender is not on the default chain ID')
  }

  const deployment = await Fixture.deploy(
    chainIds,
    DEFAULT_TOKEN_NAME,
    DEFAULT_TOKEN_SYMBOL,
    {}
  )
  fixture = deployment.fixture

  const defaultTokenIndex = DEFAULT_TOKEN_INDEX
  const defaultTokenIndexes = [defaultTokenIndex]
  const defaultTokenId = generateTokenId(
    await sender.getAddress(),
    defaultTokenIndex
  )
  const defaultTokenIds = [defaultTokenId]
  defaults = {
    tokenId: defaultTokenId,
    tokenIds: defaultTokenIds,
    chainIds,
    tokenIndex: defaultTokenIndex,
    tokenIndexes: defaultTokenIndexes,
  }
})

describe('ERC721Bridge', function () {
  describe('Mint', function () {
    it('Should mint a token at the source', async function () {
      const _chainId = defaults.chainIds[0]
      await fixture.mint(sender, {
        to: await sender.getAddress(),
        tokenIds: defaults.tokenIds,
      })

      const owner = await fixture.getTokenOwner({
        chainId: _chainId,
        tokenId: defaults.tokenId,
      })

      expect(owner).to.eq(await sender.getAddress())

      await expectTokenStatus(
        _chainId,
        defaults.tokenId,
        true,
        TokenState.Minted
      )
    })

    it('Should mint two tokens at the destination', async function () {
      const _tokenIds = [defaults.tokenId, defaults.tokenId.add(1)]
      const _chainId = defaults.chainIds[1]
      await fixture.mint(sender, {
        to: await sender.getAddress(),
        tokenIds: _tokenIds,
        chainId: _chainId,
      })

      for (const tokenId of _tokenIds) {
        const owner = await fixture.getTokenOwner({
          chainId: _chainId,
          tokenId,
        })
        expect(owner).to.eq(await sender.getAddress())
        await expectTokenStatus(_chainId, tokenId, false, TokenState.Minted)
      }
    })

    it('Should mint a token with the same ID on two different chains', async function () {
      const chainIds = defaults.chainIds
      for (const chainId of chainIds) {
        await fixture.mint(sender, {
          chainId,
          to: await sender.getAddress(),
          tokenIds: defaults.tokenIds,
        })

        const owner = await fixture.getTokenOwner({
          chainId,
          tokenId: defaults.tokenId,
        })
        expect(owner).to.eq(await sender.getAddress())

        const tokenStatus = await fixture.getTokenStatus({
          chainId,
          tokenId: defaults.tokenId,
        })

        expect(tokenStatus.tokenState).to.eq(TokenState.Minted)
        const isConfirmed = chainId.eq(DEFAULT_CHAIN_ID) ? true : false
        await expectTokenStatus(
          chainId,
          defaults.tokenId,
          isConfirmed,
          TokenState.Minted
        )
      }
    })
  })

  describe('Send', function () {
    beforeEach(async function () {
      await fixture.mint(sender, {
        to: await sender.getAddress(),
        tokenIds: defaults.tokenIds,
      })
    })

    it('Should send a token to the destination and confirm', async function () {
      const toChainId = defaults.chainIds[1]

      await fixture.send(sender, {
        toChainId,
        to: await sender.getAddress(),
        tokenIds: defaults.tokenIds,
      })

      await expectTokenStatus(
        toChainId,
        defaults.tokenId,
        true,
        TokenState.Unminted
      )
    })

    it('Should mint a token on both chains then send it to the destination and confirm', async function () {
      const toChainId = defaults.chainIds[1]
      await fixture.mint(sender, {
        to: await sender.getAddress(),
        tokenIds: defaults.tokenIds,
        chainId: toChainId,
      })

      await expectTokenStatus(
        toChainId,
        defaults.tokenId,
        false,
        TokenState.Minted
      )

      await fixture.send(sender, {
        toChainId,
        to: await sender.getAddress(),
        tokenIds: defaults.tokenIds,
      })

      await expectTokenStatus(
        toChainId,
        defaults.tokenId,
        true,
        TokenState.Minted
      )
    })

    it('Should not send a token to an unsupported chain', async function () {
      const unsupportedChainId = 123
      await expect(
        fixture.send(sender, {
          toChainId: unsupportedChainId,
          to: await sender.getAddress(),
          tokenIds: defaults.tokenIds,
        })
      ).to.be.revertedWith('ERC721B: Must send to a supported chain')
    })
  })
})

async function expectTokenStatus(
  chainId: BigNumber,
  tokenId: BigNumber,
  isConfirmed: boolean,
  tokenState: TokenState
): Promise<void> {
  const tokenStatus = await fixture.getTokenStatus({
    chainId,
    tokenId,
  })

  expect(tokenStatus.confirmed).to.eq(isConfirmed)
  expect(tokenStatus.tokenState).to.eq(tokenState)
}
