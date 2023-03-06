import { expect } from 'chai'
import { BigNumber, Signer, constants } from 'ethers'
import { ethers } from 'hardhat'
import {
  DEFAULT_CHAIN_ID,
  DEFAULT_TOKEN_INDEX,
  DEFAULT_TOKEN_NAME,
  DEFAULT_TOKEN_SYMBOL,
} from './constants'
import {
  decodeTokenId,
  encodeTokenId,
  encodeTokenIndex,
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
    signer: sender,
    chainId: DEFAULT_CHAIN_ID,
    toChainId: DEFAULT_CHAIN_ID.add(1),
    to: await sender.getAddress(),
    tokenId: defaultTokenId,
    tokenIndex: defaultTokenIndex,
    autoExecute: true,
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
      await fixture.mint()

      const owner = await fixture.ownerOf()
      expect(owner).to.eq(await sender.getAddress())

      await expectTokenStatus(defaults.chainId, defaults.tokenId, true)
      await expectInitialMintOnHub(defaults.chainId, defaults.tokenId, true)
    })

    it('Should mint a token at the destination', async function () {
      const _chainId = defaults.chainId.add(1)
      await fixture.mint({
        chainId: _chainId,
      })

      const owner = await fixture.ownerOf({
        chainId: _chainId,
      })
      expect(owner).to.eq(await sender.getAddress())
      await expectTokenStatus(_chainId, defaults.tokenId, false)
      await expectInitialMintOnHub(_chainId, defaults.tokenId, false)
    })

    it('Should mint a token with the same ID on two different chains', async function () {
      const chainIds = [defaults.chainId, defaults.chainId.add(1)]
      for (const chainId of chainIds) {
        await fixture.mint({
          chainId,
        })

        const owner = await fixture.ownerOf({
          chainId,
        })
        expect(owner).to.eq(await sender.getAddress())

        const isConfirmed = chainId.eq(DEFAULT_CHAIN_ID) ? true : false
        await expectTokenStatus(chainId, defaults.tokenId, isConfirmed)
        await expectInitialMintOnHub(chainId, defaults.tokenId, isConfirmed)
      }
    })

    it('Should fail to mint a token because the tokenId is already minted', async function () {
      await fixture.mint()
      await expect(fixture.mint()).to.be.revertedWith('ERC721: token already minted')
    })

    it('Should allow two users to mint the same tokenIndex on a spoke', async function () {
      await fixture.mint({
        chainId: defaults.toChainId,
      })

      const otherUser = (await ethers.getSigners())[1]
      const otherUserTokenId = encodeTokenIndex(
        await otherUser.getAddress(),
        defaults.tokenIndex
      )
      await fixture.mint({
        signer: otherUser,
        to: await otherUser.getAddress(),
        tokenId: otherUserTokenId,
        chainId: defaults.toChainId,
      })

      const otherUserTokenIndex = decodeTokenId(otherUserTokenId).tokenIndex
      expect(otherUserTokenIndex).to.eq(defaults.tokenIndex)
      await expectTokenStatus(defaults.chainId, defaults.tokenId, false)
      await expectTokenStatus(defaults.chainId, otherUserTokenId, false)
    })

    it('Should allow two users to mint the same tokenIndex on a hub', async function () {
      await fixture.mint()

      const otherUser = (await ethers.getSigners())[1]
      const otherUserTokenId = encodeTokenIndex(
        await otherUser.getAddress(),
        defaults.tokenIndex
      )
      await fixture.mint({
        signer: otherUser,
        to: await otherUser.getAddress(),
        tokenId: otherUserTokenId,
      })

      const otherUserTokenIndex = decodeTokenId(otherUserTokenId).tokenIndex
      expect(otherUserTokenIndex).to.eq(defaults.tokenIndex)
      await expectTokenStatus(defaults.chainId, defaults.tokenId, true)
      await expectTokenStatus(defaults.chainId, otherUserTokenId, false)
    })
  })

  describe('burn', function () {
    it('Should burn an unconfirmed token', async function () {
      // Tokens on the spoke are not confirmed upon mint
      await fixture.mint({
        chainId: defaults.toChainId,
      })
      await fixture.burn({
        chainId: defaults.toChainId,
      })
    })

    it('Should not burn a confirmed token', async function () {
      await fixture.mint()
      await expect(fixture.burn()).to.be.revertedWith(`CannotBurn(${defaults.tokenId})`)
    })

    it('Should not allow a user to burn a token owned by someone else', async function () {
      await fixture.mint()
      const otherUser = (await ethers.getSigners())[1]
      await expect(
        fixture.burn({
          signer: otherUser,
        })
      ).to.be.revertedWith(`CannotBurn(${defaults.tokenId})`)
    })

    it.skip('Should allow a contract to burn a token owned by someone else', async function () {
      // TODO
    })
  })

  describe('send', function () {
    beforeEach(async function () {
      await fixture.mint()
      await expectTokenStatus(DEFAULT_CHAIN_ID, defaults.tokenId, true)
    })

    it('Should send a token to the destination and confirm', async function () {
      const toChainId = defaults.chainId.add(1)
      await fixture.send({
        toChainId,
      })

      await expectTokenStatus(toChainId, defaults.tokenId, true)
      await expectInitialMintOnHub(toChainId, defaults.tokenId, false)
    })

    it('Should mint a token on both chains then send it to the destination and confirm', async function () {
      const toChainId = defaults.chainId.add(1)
      await fixture.mint({
        chainId: toChainId,
      })

      await expectTokenStatus(toChainId, defaults.tokenId, false)
      await expectInitialMintOnHub(toChainId, defaults.tokenId, false)

      await fixture.send({
        toChainId,
      })

      await expectTokenStatus(toChainId, defaults.tokenId, true)
      await expectInitialMintOnHub(toChainId, defaults.tokenId, false)
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

    it('Should mint a token at the destination and send it, appending to the tokenForwardDatas', async function () {
      const toChainId = defaults.chainId.add(1)
      await fixture.mint({
        chainId: toChainId,
      })
      const owner = await fixture.ownerOf({ chainId: toChainId })
      expect(owner).to.eq(await sender.getAddress())
      await expectTokenStatus(toChainId, defaults.tokenId, false)

      await fixture.send({
        chainId: toChainId,
        toChainId: defaults.chainId,
      })

      const tokenForwardData: TokenForwardData = {
        toChainId: defaults.chainId,
        tokenId: defaults.tokenId,
      }
      await expectTokenStatus(
        toChainId,
        defaults.tokenId,
        false,
        BigNumber.from(0),
        [tokenForwardData]
      )
    })
  })

  describe('mintAndSend', function () {
    it('Should mintAndSend in a single transaction', async function () {
      await fixture.mintAndSend()

      const exists = await fixture.exists()
      expect(exists).to.be.false
      await expectTokenStatus(defaults.chainId, defaults.tokenId, false)
    })
  })

  describe('confirm', function () {
    it('Should confirm the token at the destination', async function () {
      await fixture.mintAndSend()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, false)
      await expectTokenStatus(defaults.chainId.add(1), defaults.tokenId, true)
    })

    it('Should forward a confirmation onto a future chain', async function () {
      // Mint at the default chain
      await fixture.mint()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, true)

      // Mint at the destination chain
      const _chainId = defaults.chainId.add(1)
      await fixture.mint({
        chainId: _chainId,
      })
      await expectTokenStatus(defaults.chainId.add(1), defaults.tokenId, false)
      const owner = await fixture.ownerOf({
        chainId: _chainId,
      })
      expect(owner).to.eq(await sender.getAddress())

      // Send the wrapper from the destination to the default
      await fixture.send({
        chainId: _chainId,
        toChainId: defaults.chainId,
      })
      const expectedTokenForwardData = [
        { toChainId: defaults.chainId, tokenId: defaults.tokenId },
      ]
      await expectTokenStatus(
        _chainId,
        defaults.tokenId,
        false,
        BigNumber.from(0),
        expectedTokenForwardData
      )

      await fixture.send({
        autoExecute: false,
      })
      await expectTokenStatus(defaults.chainId, defaults.tokenId, false)
      // There will not be a confirmation since the message was not auto-forwarded
      await expectTokenStatus(
        _chainId,
        defaults.tokenId,
        false,
        BigNumber.from(0),
        expectedTokenForwardData
      )

      // Manually execute the expected chain of confirmations
      const chainIdsToForward = [defaults.chainId, _chainId]
      await fixture.executeMultiplePendingMessages(chainIdsToForward)
      await expectTokenStatus(
        _chainId,
        defaults.tokenId,
        false,
        BigNumber.from(1),
        expectedTokenForwardData
      )
      await expectTokenStatus(defaults.chainId, defaults.tokenId, true)
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

  describe('canMint', function () {
    it('Should return false on a canMint call because the caller is not the owner', async function () {
      const randomAddress = '0x0000000000000000000000000000000000000123'
      const randomTokenId = encodeTokenId(randomAddress, defaults.tokenId)
      const canMint = await fixture.canMint({
        tokenId: randomTokenId,
      })
      expect(canMint).to.be.false
    })
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
  tokenForwardCount: BigNumber = BigNumber.from(0),
  tokenForwardDatas: TokenForwardData[] = []
): Promise<void> {
  const tokenStatus = await fixture.getTokenStatus({
    chainId,
    tokenId,
  })

  expect(tokenStatus.confirmed).to.eq(isConfirmed)
  expect(tokenStatus.tokenForwardCount).to.eq(tokenForwardCount)
  for (let i = 0; i < tokenForwardDatas.length; i++) {
    expect(tokenStatus.tokenForwardDatas[i].toChainId).to.eq(
      tokenForwardDatas[i].toChainId
    )
    expect(tokenStatus.tokenForwardDatas[i].tokenId).to.eq(
      tokenForwardDatas[i].tokenId
    )
  }
}

async function expectInitialMintOnHub(
  chainId: BigNumber,
  tokenId: BigNumber,
  isSet = true
): Promise<void> {
  const isInitialMintOnHubComplete = await fixture.getInitialMintOnHubComplete({
    chainId,
    tokenId,
  })

  expect(isInitialMintOnHubComplete).to.eq(isSet)
}
