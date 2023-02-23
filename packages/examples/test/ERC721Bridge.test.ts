import { expect } from 'chai'
import { BigNumber, BigNumberish, Signer } from 'ethers'
import { ethers } from 'hardhat'
import {
  DEFAULT_CHAIN_ID,
  DEFAULT_TOKEN_INDEX,
  DEFAULT_TOKEN_NAME,
  DEFAULT_TOKEN_SYMBOL,
} from './constants'
import { encodeTokenIndex } from './utils'
import Fixture from './Fixture'

type Defaults = {
  tokenId: BigNumber
  tokenIndex: BigNumber
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
  const defaultTokenId = encodeTokenIndex(
    await sender.getAddress(),
    defaultTokenIndex
  )
  defaults = {
    tokenId: defaultTokenId,
    chainIds,
    tokenIndex: defaultTokenIndex,
  }
})

describe('ERC721Bridge', function () {
  describe('Mint', function () {
    it('Should mint a token at the source', async function () {
      const _chainId = defaults.chainIds[0]
      await fixture.mint(sender, {
        to: await sender.getAddress(),
        tokenId: defaults.tokenId,
      })

      const owner = await fixture.getTokenOwner({
        chainId: _chainId,
        tokenId: defaults.tokenId,
      })

      expect(owner).to.eq(await sender.getAddress())

      await expectTokenStatus(_chainId, defaults.tokenId, true)
    })

    it('Should mint a token at the destination', async function () {
      const _chainId = defaults.chainIds[1]
      await fixture.mint(sender, {
        to: await sender.getAddress(),
        tokenId: defaults.tokenId,
        chainId: _chainId,
      })

      const owner = await fixture.getTokenOwner({
        chainId: _chainId,
        tokenId: defaults.tokenId,
      })
      expect(owner).to.eq(await sender.getAddress())
      await expectTokenStatus(_chainId, defaults.tokenId, false)
    })

    it('Should mint a token with the same ID on two different chains', async function () {
      const chainIds = defaults.chainIds
      for (const chainId of chainIds) {
        await fixture.mint(sender, {
          chainId,
          to: await sender.getAddress(),
          tokenId: defaults.tokenId,
        })

        const owner = await fixture.getTokenOwner({
          chainId,
          tokenId: defaults.tokenId,
        })
        expect(owner).to.eq(await sender.getAddress())

        const isConfirmed = chainId.eq(DEFAULT_CHAIN_ID) ? true : false
        await expectTokenStatus(chainId, defaults.tokenId, isConfirmed)
      }
    })
  })

  describe('Send', function () {
    beforeEach(async function () {
      await fixture.mint(sender, {
        to: await sender.getAddress(),
        tokenId: defaults.tokenId,
      })
    })

    it('Should send a token to the destination and confirm', async function () {
      const toChainId = defaults.chainIds[1]

      await fixture.send(sender, {
        toChainId,
        to: await sender.getAddress(),
        tokenId: defaults.tokenId,
      })

      await expectTokenStatus(toChainId, defaults.tokenId, true)
    })

    it('Should mint a token on both chains then send it to the destination and confirm', async function () {
      const toChainId = defaults.chainIds[1]
      await fixture.mint(sender, {
        to: await sender.getAddress(),
        tokenId: defaults.tokenId,
        chainId: toChainId,
      })

      await expectTokenStatus(toChainId, defaults.tokenId, false)

      await fixture.send(sender, {
        toChainId,
        to: await sender.getAddress(),
        tokenId: defaults.tokenId,
      })

      await expectTokenStatus(toChainId, defaults.tokenId, true)
    })

    it('Should not send a token to an unsupported chain', async function () {
      const unsupportedChainId = 123
      await expect(
        fixture.send(sender, {
          toChainId: unsupportedChainId,
          to: await sender.getAddress(),
          tokenId: defaults.tokenId,
        })
      ).to.be.revertedWith(`UnsupportedChainId(${unsupportedChainId})`)
    })
  })
})

async function expectTokenStatus(
  chainId: BigNumber,
  tokenId: BigNumber,
  isConfirmed: boolean,
  tokenForwardCount: BigNumberish = 0
): Promise<void> {
  const tokenStatus = await fixture.getTokenStatus({
    chainId,
    tokenId,
  })

  expect(tokenStatus.confirmed).to.eq(isConfirmed)
  expect(tokenStatus.tokenForwardCount).to.eq(tokenForwardCount)
}
