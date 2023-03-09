import { expect } from 'chai'
import { BigNumber, Signer, constants } from 'ethers'
import { ethers } from 'hardhat'
import {
  DEFAULT_CHAIN_ID,
  DEFAULT_PREVIOUS_TOKEN_ID,
  DEFAULT_SERIAL_NUMBER,
  DEFAULT_TOKEN_NAME,
  DEFAULT_TOKEN_SYMBOL,
} from './constants'
import {
  getTokenId,
  expectCallRevert,
} from './utils'
import { FixtureDefaults, TokenForwardData } from './types'
import Fixture from './Fixture'
const { AddressZero } = constants

let sender: Signer
let fixture: Fixture
let defaults: FixtureDefaults

beforeEach(async function () {
  const signers = await ethers.getSigners()
  sender = signers[0]

  // Sanity check
  if ((await sender.getChainId()) !== DEFAULT_CHAIN_ID.toNumber()) {
    throw new Error('Sender is not on the default chain ID')
  }

  const defaultChainId = DEFAULT_CHAIN_ID
  const defaultChainIds = [defaultChainId, defaultChainId.add(1)]
  const defaultPreviousTokenId = DEFAULT_PREVIOUS_TOKEN_ID
  const defaultSerialNumber = DEFAULT_SERIAL_NUMBER
  const defaultTokenId = getTokenId(
    defaultChainId,
    await sender.getAddress(),
    defaultPreviousTokenId,
    defaultSerialNumber
  )
  const _defaults = {
    signer: sender,
    chainId: defaultChainId,
    toChainId: defaultChainId.add(1),
    to: await sender.getAddress(),
    tokenId: defaultTokenId,
    previousTokenId: defaultPreviousTokenId,
    serialNumber: defaultSerialNumber,
    autoExecute: true,
  }

  const deployment = await Fixture.deploy(
    defaultChainIds,
    DEFAULT_TOKEN_NAME,
    DEFAULT_TOKEN_SYMBOL,
    _defaults
  )
  fixture = deployment.fixture
  defaults = deployment.defaults
})

describe('ERC721Bridge', function () {
  describe('mintWrapper', function () {
    it('Should mint a token at the source', async function () {
      await fixture.mintWrapper()

      const owner = await fixture.ownerOf()
      expect(owner).to.eq(await sender.getAddress())

      await expectTokenStatus(defaults.chainId, defaults.tokenId, false, false)
    })

    it('Should mint a token at the destination', async function () {
      const _chainId = defaults.chainId.add(1)
      await fixture.mintWrapper({
        chainId: _chainId,
      })

      const _tokenId = await fixture.getTokenId({
        chainId: _chainId,
      })
      const owner = await fixture.ownerOf({
        chainId: _chainId,
        tokenId: _tokenId,
      })
      expect(owner).to.eq(await sender.getAddress())
      await expectTokenStatus(_chainId, defaults.tokenId, false, false)
    })

    it('Should mint a token with the same serial number on two different chains', async function () {
      const chainIds = [defaults.chainId, defaults.chainId.add(1)]
      for (const chainId of chainIds) {
        await fixture.mintWrapper({
          chainId,
        })

        const _tokenId = await fixture.getTokenId({
          chainId,
        })
        const owner = await fixture.ownerOf({
          chainId,
          tokenId: _tokenId,
        })
        expect(owner).to.eq(await sender.getAddress())

        await expectTokenStatus(chainId, _tokenId, false, false)
      }
    })

    it('Should fail to mint a token because the tokenId is already minted', async function () {
      await fixture.mintWrapper()
      await expect(fixture.mintWrapper()).to.be.revertedWith('ERC721: token already minted')
    })

    it('Should allow two users to mint the same serial number', async function () {
      await fixture.mintWrapper({
        chainId: defaults.toChainId,
      })

      const otherUser = (await ethers.getSigners())[1]
      const otherUserTokenId = await fixture.getTokenId({
        to: otherUser.address,
      })
      await fixture.mintWrapper({
        signer: otherUser,
        chainId: defaults.toChainId,
      })

      await expectTokenStatus(defaults.chainId, defaults.tokenId, false, false)
      await expectTokenStatus(defaults.chainId, otherUserTokenId, false, false)
    })
  })

  describe('send', function () {
    beforeEach(async function () {
      await fixture.mintWrapperAndConfirm()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, true, false)
    })

    it('Should send a token to the destination and confirm', async function () {
      const _chainId = defaults.chainId.add(1)

      await fixture.send({
        toChainId: _chainId,
      })
      await expectTokenStatus(defaults.chainId, defaults.tokenId, false, true)

      const _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: defaults.tokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, true, false)
    })

    it('Should send from the source chain to the destination chain, then back to the source chain', async function () {
      // Send the wrapper from the default to the destination
      await fixture.send()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, false, true)

      // Check that the token is confirmed on the destination chain
      const _chainId = defaults.chainId.add(1)
      let _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: defaults.tokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, true, false)

      // Mint the wrapper at the destination chain and send it back to the source
      await fixture.mintWrapper({
        chainId: _chainId,
        previousTokenId: defaults.tokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, true, false)
      await fixture.send({
        chainId: _chainId,
        toChainId: defaults.chainId,
        tokenId: _tokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, false, true)

      // Mint the new wrapper back at the source chain
      _tokenId = await fixture.getTokenId({
        previousTokenId: _tokenId,
      })
      await fixture.mintWrapper({
        previousTokenId: _tokenId,
      })
      await expectTokenStatus(defaults.chainId, _tokenId, true, false)
    })

    it('Should not send a token to an unsupported chain', async function () {
      const unsupportedChainId = 123
      await expect(
        fixture.send({
          toChainId: unsupportedChainId,
        })
      ).to.be.revertedWith(`UnsupportedChainId(${unsupportedChainId})`)
    })

    it('Should not send a token to the chain it is currently on', async function () {
      const unsupportedChainId = DEFAULT_CHAIN_ID
      await expect(
        fixture.send({
          toChainId: unsupportedChainId,
        })
      ).to.be.revertedWith(`UnsupportedChainId(${unsupportedChainId})`)
    })

    it.skip('Should allow a user to send the same token to two different chains', async function () {
      // TODO: Add a third chain to the test suite
    })
  })

  describe('confirm', function () {
    it('Should confirm the token at the destination', async function () {
      const _chainId = defaults.chainId.add(1)
      await fixture.mintWrapperAndConfirm()
      await fixture.send({
        toChainId: _chainId,
      })
      await expectTokenStatus(defaults.chainId, defaults.tokenId, false, true)
      const _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: defaults.tokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, true, false)
    })

    it('Should forward a confirmation onto a future chain', async function () {
      // Mint at the default chain
      await fixture.mintWrapperAndConfirm()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, true, false)

      // Mint at the destination chain
      const _chainId = defaults.chainId.add(1)
      await fixture.mintWrapper({
        chainId: _chainId,
        previousTokenId: defaults.tokenId,
      })
      const _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: defaults.tokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, false, false)
      const owner = await fixture.ownerOf({
        chainId: _chainId,
        tokenId: _tokenId,
      })
      expect(owner).to.eq(await sender.getAddress())

      // Send the wrapper from the destination to the default
      await fixture.send({
        chainId: _chainId,
        toChainId: defaults.chainId,
        tokenId: _tokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, false, true)

      // Send the wrapper from the default to the destination
      // Do not auto-forward so that the mock does not make the round trip atomically
      await fixture.send({
        autoExecute: false,
      })
      await expectTokenStatus(defaults.chainId, defaults.tokenId, false, true)
      // There will not be a confirmation since the message was not auto-forwarded
      await expectTokenStatus(_chainId, _tokenId, false, true)

      // Manually execute the expected chain of confirmations
      const chainIdsToForward = [defaults.chainId, _chainId]
      await fixture.executeMultiplePendingMessages(chainIdsToForward)
      await expectTokenStatus(_chainId, _tokenId, false, true)
      await expectTokenStatus(defaults.chainId, defaults.tokenId, false, true)
      const _tokenId2 = await fixture.getTokenId({
        previousTokenId: _tokenId,
      })
      await expectTokenStatus(defaults.chainId, _tokenId2, true, false)
    })

    it('Should confirm a token that has not yet been minted', async function () {
      // Mint at the default chain
      await fixture.mintWrapperAndConfirm()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, true, false)

      // Get the status at the destination
      const _chainId = defaults.chainId.add(1)
      const _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: defaults.tokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, false, false)

      // Send the wrapper from the destination to the default
      await fixture.send({
        toChainId: _chainId,
      })
      await expectTokenStatus(defaults.chainId, defaults.tokenId, false, true)

      // Get the status of the unminted token at the destination
      await expectTokenStatus(_chainId, _tokenId, true, false)
      // Should not be minted
      const tokenData = await fixture.getTokenData({
        tokenId: _tokenId,
      })
      expect(tokenData.serialNumber).to.eq(BigNumber.from(0))
      expect(tokenData.toChainId).to.eq(BigNumber.from(0))
    })

    it('Should not allow an arbitrary address to call this function', async function () {
      await expect(fixture.confirm(defaults.tokenId)).to.be.revertedWith(
        `InvalidSender("${await sender.getAddress()}")`
      )
    })

    it.skip('Should not allow a non-cross-chain call to call this function', async function () {
      // TODO: validation required
    })

    it.skip('Should not allow an invalid sender to call this function', async function () {
      // TODO: validation required
    })

    it.skip('Should not allow an invalid chainId to call this function', async function () {
      // TODO: validation required
    })

    // TODO: Test validation
  })

  describe('getChainId', function () {
    // Should return the chainId
  })

  // TODO: Get token datas tests
})

async function expectTokenStatus(
  chainId: BigNumber,
  tokenId: BigNumber,
  isConfirmed: boolean,
  isSpent: boolean
): Promise<void> {
  const confirmed = await fixture.getIsConfirmed({
    chainId,
    tokenId,
  })
  const spent = await fixture.getIsSpent({
    chainId,
    tokenId,
  })

  expect(isConfirmed).to.eq(confirmed)
  expect(isSpent).to.eq(spent)
}
