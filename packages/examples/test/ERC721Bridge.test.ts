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
import { FixtureDefaults } from './types'
import Fixture from './Fixture'

let fixture: Fixture
let sender: Signer
let defaults: FixtureDefaults

beforeEach(async function () {
  const signers = await ethers.getSigners()
  sender = signers[0]
  const chainIds = [DEFAULT_CHAIN_ID, DEFAULT_CHAIN_ID.add(1)]

  // Sanity check
  if ((await sender.getChainId()) !== DEFAULT_CHAIN_ID.toNumber()) {
    throw new Error('Sender is not on the default chain ID')
  }

  const defaultTokenIndex = DEFAULT_TOKEN_INDEX
  const defaultTokenId = encodeTokenIndex(
    await sender.getAddress(),
    defaultTokenIndex
  )
  const _defaults = {
    to: await sender.getAddress(),
    tokenId: defaultTokenId,
    chainId: DEFAULT_CHAIN_ID,
    tokenIndex: defaultTokenIndex,
  }

  const deployment = await Fixture.deploy(
    chainIds,
    DEFAULT_TOKEN_NAME,
    DEFAULT_TOKEN_SYMBOL,
    _defaults
  )
  fixture = deployment.fixture
  defaults = deployment.defaults
})

describe('ERC721Bridge', function () {
  describe('mint', function () {
    it('Should mint a token at the source', async function () {
      await fixture.mint(sender, {})

      const owner = await fixture.getTokenOwner()
      expect(owner).to.eq(await sender.getAddress())

      await expectTokenStatus(defaults.chainId, defaults.tokenId, true)
      await expectInitialMintOnHub(defaults.chainId, defaults.tokenId, true)
    })

    it('Should mint a token at the destination', async function () {
      const _chainId = defaults.chainId.add(1)
      await fixture.mint(sender, {
        chainId: _chainId,
      })

      const owner = await fixture.getTokenOwner({
        chainId: _chainId,
      })
      expect(owner).to.eq(await sender.getAddress())
      await expectTokenStatus(_chainId, defaults.tokenId, false)
      await expectInitialMintOnHub(_chainId, defaults.tokenId, false)
    })

    it('Should mint a token with the same ID on two different chains', async function () {
      const chainIds = [defaults.chainId, defaults.chainId.add(1)]
      for (const chainId of chainIds) {
        await fixture.mint(sender, {
          chainId,
        })

        const owner = await fixture.getTokenOwner({
          chainId,
        })
        expect(owner).to.eq(await sender.getAddress())

        const isConfirmed = chainId.eq(DEFAULT_CHAIN_ID) ? true : false
        await expectTokenStatus(chainId, defaults.tokenId, isConfirmed)
        await expectInitialMintOnHub(chainId, defaults.tokenId, isConfirmed)
      }
    })

    // Should fail because the token ID is already minted
    // Should allow another user to mint the same tokenIndex on a spoke
    // Should allow another user to mint the same tokenIndex on the hub
  })

  describe('burn', function () {
    // Should burn an unconfirmed token
  })

  describe('send', function () {
    beforeEach(async function () {
      await fixture.mint(sender)
      await expectTokenStatus(DEFAULT_CHAIN_ID, defaults.tokenId, true)
    })

    it('Should send a token to the destination and confirm', async function () {
      const toChainId = defaults.chainId.add(1)
      await fixture.send(sender, {
        toChainId,
      })

      await expectTokenStatus(toChainId, defaults.tokenId, true)
      await expectInitialMintOnHub(toChainId, defaults.tokenId, false)
    })

    it('Should mint a token on both chains then send it to the destination and confirm', async function () {
      const toChainId = defaults.chainId.add(1)
      await fixture.mint(sender, {
        chainId: toChainId,
      })

      await expectTokenStatus(toChainId, defaults.tokenId, false)
      await expectInitialMintOnHub(toChainId, defaults.tokenId, false)

      await fixture.send(sender, {
        toChainId,
      })

      await expectTokenStatus(toChainId, defaults.tokenId, true)
      await expectInitialMintOnHub(toChainId, defaults.tokenId, false)
    })

    it('Should not send a token to an unsupported chain', async function () {
      const unsupportedChainId = 123
      await expect(
        fixture.send(sender, {
          toChainId: unsupportedChainId,
        })
      ).to.be.revertedWith(`UnsupportedChainId(${unsupportedChainId})`)
    })

    // Should allow a user to send the same token to two different chains
  })

  describe('mintAndSend', function () {
    // Should mint and send in a single transaction
  })

  describe('confirm', function () {
    // Should forward a confirmation call to the next chain
    // Should confirm the token at the current chain
    // Should not allow a non-cross-chain call to call this function
    // Should not allow an invalid sender to call this function
    // Should not allow an invalid chainId to call this function
  })

  describe('canMint', function () {
    // Should fail at cannotMint because they are not the owner
  })

  describe('canBurn', function () {
    // Should revert because token is confirmed
    // Should revert because user is not approved
    // Should revert because user is not owner
  })

  describe('shouldConfirmMint', function () {
    // Should confirm because the chain is the hub and the tokenId is confirmable
    // Should not confirm because the chain is the spoke
    // Should not confirm because the tokenId is not confirmable
  })

  describe('isSpoke', function () {
    // Should return true for the spoke and false for the hub
  })

  describe('isTokenIdConfirmable', function () {
    // Should return true since mint is complete and additional checks are passed
    // Should return false since mint is not complete
  })

  describe('isInitialMintOnHubComplete', function () {
    // TODO
    // Should return false when the mint is not complete and true when it is
  })

  describe('isTokenIdConfirmableAdditionalChecks', function () {
    // Should return true since it is unimplemented on this contract
    // TODO
  })

  describe('sendBatch', function () {
    // Should send a batch of tokens
    // Should not allow the same tokenId to be used twice
    // Should allow one tokenId to work and the next to fail if the tokenId does not represent the sender
  })

  describe('mintBatch', function () {
    // Should mint a batch of tokens
    // Should not allow the same tokenId to be used twice
    // Should allow one tokenId to work and the next to fail if the tokenId does not represent the sender
  })

  describe('burnBatch', function () {
    // Should burn a batch of tokens
    // Should not allow the same tokenId to be used twice
  })

  describe('mintAndSendBatch', function () {
    // Should mint a batch of tokens
    // Should allow the same tokenId to be used twice
    // Should allow one tokenId to work and the next to fail if the tokenId does not represent the sender
  })

  describe('getChainId', function () {
    // Should return the chainId
  })

  describe('getTokenForwardData', function () {
    // Should return the tokenForwardData for an active token
    // Should return the empty tokenForwardData for a token that has never been minted
  })

  describe('getNextTokenForwardData', function () {
    // Should return the nextTokenForwardData for an active token
    // Should return the empty nextTokenForwardData for a token that has been minted but not forwarded
    // Should return the empty nextTokenForwardData for a token that has never been minted
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

async function expectInitialMintOnHub(
  chainId: BigNumber,
  tokenId: BigNumber,
  isSet = true
): Promise<void> {
  const isInitialMintOnHubComplete = await fixture.isInitialMintOnHubComplete({
    chainId,
    tokenId,
  })

  expect(isInitialMintOnHubComplete).to.eq(isSet)
}
