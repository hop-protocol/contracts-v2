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
import { getTokenId } from './utils'
import { FixtureDefaults, TokenData } from './types'
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
  const defaultToChainId = defaultChainId.add(1)
  const defaultChainIds = [defaultChainId, defaultToChainId]
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
    toChainId: defaultToChainId,
    to: await sender.getAddress(),
    tokenId: defaultTokenId,
    previousTokenId: defaultPreviousTokenId,
    serialNumber: defaultSerialNumber,
    owner: await sender.getAddress(),
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

describe('ERC721CrossChain', function () {
  describe('mintWrapper', function () {
    it('Should mint a wrapper at the source', async function () {
      await fixture.mintWrapper()
      await expectTokenStatus(defaults.chainId, defaults.tokenId)
      await expectOwner(defaults.chainId, defaults.tokenId, defaults.owner)
    })

    it('Should mint a wrapper at the destination', async function () {
      const _chainId = defaults.toChainId
      await fixture.mintWrapper({
        chainId: _chainId,
      })
      const _tokenId = await fixture.getTokenId({
        chainId: _chainId,
      })
      await expectTokenStatus(_chainId, _tokenId)
      await expectOwner(_chainId, _tokenId, defaults.owner)
    })

    it('Should mint a wrapper with the same serial number on two different chains', async function () {
      const chainIds = [defaults.chainId, defaults.toChainId]
      for (const chainId of chainIds) {
        await fixture.mintWrapper({
          chainId,
        })

        const _tokenId = await fixture.getTokenId({
          chainId,
        })

        await expectTokenStatus(chainId, _tokenId)
        await expectOwner(chainId, _tokenId, defaults.owner)
      }
    })

    it('Should fail to mint a wrapper because the tokenId is already minted', async function () {
      await fixture.mintWrapper()
      await expect(fixture.mintWrapper()).to.be.revertedWith(`TokenAlreadyMinted(${defaults.tokenId})`)
    })

    it('Should fail to mint a wrapper because the tokenId is already minted and sent', async function () {
      await fixture.mintWrapper()
      await fixture.send()
      await expect(fixture.mintWrapper()).to.be.revertedWith(`TokenAlreadyMinted(${defaults.tokenId})`)
    })

    it('Should allow two users to mint the same serial number on the same chain', async function () {
      await fixture.mintWrapper()

      const otherUser = (await ethers.getSigners())[1]
      const otherUserTokenId = await fixture.getTokenId({
        to: otherUser.address,
      })
      await fixture.mintWrapper({
        signer: otherUser,
      })

      await expectTokenStatus(defaults.chainId, defaults.tokenId)
      await expectOwner(defaults.chainId, defaults.tokenId, defaults.owner)
      await expectTokenStatus(defaults.chainId, otherUserTokenId)
      await expectOwner(defaults.chainId, otherUserTokenId, otherUser.address)
    })
  })

  describe('send', function () {
    beforeEach(async function () {
      await fixture.mintWrapperAndConfirm()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        confirmed: true,
      })
      await expectOwner(defaults.chainId, defaults.tokenId, defaults.owner)
    })

    it('Should send a wrapper to the destination and confirm', async function () {
      const _chainId = defaults.toChainId
      const _previousTokenId = defaults.tokenId
      const _to = defaults.to
      const _owner = defaults.owner
      const _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: _previousTokenId,
      })
      await fixture.send({
        toChainId: _chainId,
      })
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        toChainId: _chainId,
        to: _to,
        spent: true,
      })

      await expectTokenStatus(_chainId, _tokenId, {
        confirmed: true,
      })
    })

    it('Should send from the source chain to the destination chain, then back to the source chain', async function () {
      // Send the wrapper from the source to the destination
      await fixture.send()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        toChainId: defaults.toChainId,
        to: defaults.to,
        spent: true,
      })

      // Mint the wrapper at the destination chain and send it back to the source
      let _chainId = defaults.toChainId
      let _toChainId = defaults.chainId
      let _to = defaults.to
      let _previousTokenId = defaults.tokenId
      let _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: _previousTokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, {
        confirmed: true,
      })
      await fixture.mintWrapper({
        chainId: _chainId,
        previousTokenId: _previousTokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, {
        confirmed: true,
      })
      await expectOwner(_chainId, _tokenId, defaults.owner)
      await fixture.send({
        chainId: _chainId,
        tokenId: _tokenId,
        toChainId: defaults.chainId,
      })
      await expectTokenStatus(_chainId, _tokenId, {
        toChainId: _toChainId,
        to: _to,
        spent: true,
      })

      // Mint the new wrapper back at the source chain
      _chainId = defaults.chainId
      _previousTokenId = _tokenId
      _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: _previousTokenId,
      })
      await fixture.mintWrapper({
        previousTokenId: _previousTokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, {
        confirmed: true,
      })
      await expectOwner(_chainId, _tokenId, defaults.owner)
    })

    it('Should not send a wrapper to an unsupported chain', async function () {
      const unsupportedChainId = BigNumber.from(123)
      await expect(
        fixture.send({
          toChainId: unsupportedChainId,
        })
      ).to.be.revertedWith(`UnsupportedChainId(${unsupportedChainId})`)
    })

    it('Should not send a wrapper to the chain it is currently on', async function () {
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
      // Mint and send at the source chain
      await fixture.mintWrapperAndConfirm()
      await expectOwner(defaults.chainId, defaults.tokenId, defaults.owner)

      const _chainId = defaults.toChainId
      const _to = defaults.to
      await fixture.send({
        toChainId: _chainId,
      })
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        toChainId: _chainId,
        to: _to,
        spent: true,
      })
      const _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: defaults.tokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, {
        confirmed: true,
      })
    })

    it('Should forward a confirmation onto a future chain after a pre-mint at the destination', async function () {
      // Mint at the source chain
      await fixture.mintWrapperAndConfirm()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        confirmed: true,
      })
      await expectOwner(defaults.chainId, defaults.tokenId, defaults.owner)

      // Mint at the destination chain
      let _chainId = defaults.toChainId
      let _toChainId = defaults.chainId
      let _to = defaults.to
      let _previousTokenId = defaults.tokenId
      let _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: _previousTokenId,
      })
      await fixture.mintWrapper({
        chainId: _chainId,
        previousTokenId: _previousTokenId,
      })
      await expectTokenStatus(_chainId, _tokenId)
      await expectOwner(_chainId, _tokenId, defaults.owner)

      // Send the wrapper from the destination to the source
      await fixture.send({
        chainId: _chainId,
        tokenId: _tokenId,
        toChainId: _toChainId,
      })
      await expectTokenStatus(_chainId, _tokenId, {
        toChainId: _toChainId,
        to: _to,
        spent: true,
      })

      // Now send the wrapper from the source to the destination
      // Do not auto-forward so that the mock does not make the round trip atomically
      await fixture.send({
        autoExecute: false,
      })

      // On the destination
      await expectTokenStatus(_chainId, _tokenId, {
        toChainId: _toChainId,
        to: _to,
        spent: true,
      })

      // On the source
      _chainId = defaults.chainId
      _toChainId = defaults.toChainId
      _previousTokenId = _tokenId
      _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: _previousTokenId,
      })
      // There will not be a confirmation since the message was not autoExecuted
      await expectTokenStatus(_chainId, _tokenId)

      // Manually execute the expected chain of confirmations
      const chainIdsToForward = [defaults.chainId, defaults.toChainId]
      await fixture.executeMultiplePendingMessages(chainIdsToForward)
      await expectTokenStatus(_chainId, _tokenId, {
        confirmed: true,
      })
    })

    it('Should confirm a token that has not yet been minted', async function () {
      // Mint at the source chain
      await fixture.mintWrapperAndConfirm()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        confirmed: true,
      })
      await expectOwner(defaults.chainId, defaults.tokenId, defaults.owner)

      await fixture.send()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        serialNumber: defaults.serialNumber,
        toChainId: defaults.toChainId,
        to: defaults.to,
        spent: true,
      })

      // Get the status at the destination
      const _chainId = defaults.toChainId
      const _previousTokenId = defaults.tokenId
      const _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: _previousTokenId,
      })

      // Get the status of the unminted token at the destination
      await expectTokenStatus(_chainId, _tokenId, {
        confirmed: true,
      })
    })

    it('Should not allow an arbitrary address to call this function', async function () {
      await expect(
        fixture.confirm({
          tokenId: defaults.tokenId,
        })
      ).to.be.revertedWith(`InvalidSender("${await sender.getAddress()}")`)
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
    it('Should return the chainId', async function () {
      const chainId = await fixture.getChainId()
      expect(chainId).to.eq(defaults.chainId)
    })
  })

  describe('getTokenId', function () {
    it('Should return the tokenId', async function () {
      const tokenId = await fixture.getTokenId()
      expect(tokenId).to.eq(defaults.tokenId)
    })

    it('Should ensure the parameters are in the expected order', async function () {
      // Compare direct contract call with the fixture and with the utility function
      const erc721CrossChain = fixture.getErc721CrossChain(defaults.chainId)
      const tokenIdContract = await erc721CrossChain
        .connect(sender)
        .getTokenId(
          defaults.chainId,
          defaults.to,
          defaults.serialNumber,
          defaults.previousTokenId
        )

      const tokenIdUtility = getTokenId(
        defaults.chainId,
        defaults.to,
        defaults.serialNumber,
        defaults.previousTokenId
      )
      const tokenIdFixture = await fixture.getTokenId()

      expect(tokenIdContract).to.eq(tokenIdUtility)
      expect(tokenIdContract).to.eq(tokenIdFixture)
    })

    it('Should return different tokenIds when any parameter is different', async function () {
      const tokenId = await fixture.getTokenId()
      expect(tokenId).to.eq(defaults.tokenId)

      let _tokenId = await fixture.getTokenId({
        chainId: defaults.toChainId,
      })
      expect(tokenId).to.not.eq(_tokenId)

      _tokenId = await fixture.getTokenId({
        to: AddressZero,
      })
      expect(tokenId).to.not.eq(_tokenId)

      _tokenId = await fixture.getTokenId({
        previousTokenId: BigNumber.from(12345),
      })
      expect(tokenId).to.not.eq(_tokenId)

      _tokenId = await fixture.getTokenId({
        serialNumber: BigNumber.from(123),
      })
      expect(tokenId).to.not.eq(_tokenId)
    })
  })

  describe('getTokenData', function () {
    it('Should return the correct tokenData during various states of a confirmed wrapper lifecycle', async function () {
      // On source chain
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        serialNumber: BigNumber.from(0),
        toChainId: BigNumber.from(0),
      })

      await fixture.mintWrapperAndConfirm()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        toChainId: BigNumber.from(0),
        confirmed: true,
      })
      await expectOwner(defaults.chainId, defaults.tokenId, defaults.owner)

      await fixture.send()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        serialNumber: defaults.serialNumber,
        toChainId: defaults.toChainId,
        to: defaults.to,
        spent: true,
      })

      // On destination chain
      let _serialNumber = defaults.serialNumber
      let _chainId = defaults.toChainId
      let _toChainId = defaults.chainId
      let _to = defaults.to
      let _previousTokenId = defaults.tokenId
      let _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: _previousTokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, {
        toChainId: BigNumber.from(0),
        confirmed: true,
      })

      await fixture.mintWrapper({
        chainId: _chainId,
        previousTokenId: _previousTokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, {
        toChainId: BigNumber.from(0),
        confirmed: true,
      })
      await expectOwner(_chainId, _tokenId, defaults.owner)

      await fixture.send({
        tokenId: _tokenId,
        chainId: _chainId,
        toChainId: _toChainId,
      })

      await expectTokenStatus(_chainId, _tokenId, {
        serialNumber: _serialNumber,
        toChainId: _toChainId,
        to: _to,
        spent: true,
      })

      // Back on source chain with different tokenId
      _chainId = defaults.chainId
      _toChainId = defaults.toChainId
      _previousTokenId = _tokenId
      _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: _tokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, {
        toChainId: BigNumber.from(0),
        confirmed: true,
      })
    })

    it('Should return the correct tokenData during various states of an unconfirmed wrapper lifecycle', async function () {
      // On source chain
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        serialNumber: BigNumber.from(0),
        toChainId: BigNumber.from(0),
      })

      await fixture.mintWrapper()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        toChainId: BigNumber.from(0),
      })
      await expectOwner(defaults.chainId, defaults.tokenId, defaults.owner)

      await fixture.send()
      await expectTokenStatus(defaults.chainId, defaults.tokenId, {
        toChainId: defaults.toChainId,
        to: defaults.to,
        spent: true,
      })

      // On destination chain
      let _chainId = defaults.toChainId
      let _toChainId = defaults.chainId
      let _to = defaults.to
      let _previousTokenId = defaults.tokenId
      let _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: _previousTokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, {
        toChainId: BigNumber.from(0),
      })

      await fixture.mintWrapper({
        chainId: _chainId,
        previousTokenId: _previousTokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, {
        toChainId: BigNumber.from(0),
      })
      await expectOwner(_chainId, _tokenId, defaults.owner)

      await fixture.send({
        tokenId: _tokenId,
        chainId: _chainId,
        toChainId: defaults.chainId,
      })

      await expectTokenStatus(_chainId, _tokenId, {
        toChainId: _toChainId,
        to: _to,
        spent: true,
      })

      // Back on source chain with different tokenId
      _chainId = defaults.chainId
      _toChainId = defaults.toChainId
      _previousTokenId = _tokenId
      _tokenId = await fixture.getTokenId({
        chainId: _chainId,
        previousTokenId: _tokenId,
      })
      await expectTokenStatus(_chainId, _tokenId, {
        toChainId: BigNumber.from(0),
      })
    })
  })

  describe('getIsChainIdSupported', function () {
    it('Should return true for a supported chain and false for an unsupported one', async function () {
      let chainId = defaults.toChainId
      let isChainIdSupported = await fixture.getIsChainIdSupported({
        maybeChainIdSupported: chainId,
      })
      expect(isChainIdSupported).to.be.true
      chainId = BigNumber.from(123)
      isChainIdSupported = await fixture.getIsChainIdSupported({
        maybeChainIdSupported: chainId,
      })
      expect(isChainIdSupported).to.be.false
    })
  })

  describe('getCrossChain721AddressByChainId', function () {
    it('Should return a target address for a supported chain and the zero address for an unsupported one', async function () {
      let chainId = defaults.toChainId
      let targetAddress = await fixture.getCrossChain721AddressByChainId({
        chainIdForTarget: chainId,
      })
      const expectedTargetAddress = (fixture.getErc721CrossChain(defaults.toChainId)).address
      expect(targetAddress).to.equal(expectedTargetAddress)
      chainId = BigNumber.from(123)
      targetAddress = await fixture.getCrossChain721AddressByChainId({
        chainIdForTarget: chainId,
      })
      expect(targetAddress).to.equal(AddressZero)
    })
  })
})


async function expectTokenStatus(
  chainId: BigNumber,
  tokenId: BigNumber,
  tokenData: Partial<TokenData> | undefined = undefined
): Promise<void> {
  const { serialNumber, toChainId, to, confirmed, spent } =
    await fixture.getTokenData({
      chainId,
      tokenId,
    })

  expect(serialNumber).to.eq(tokenData?.serialNumber ?? BigNumber.from(0))
  expect(toChainId).to.eq(tokenData?.toChainId ?? BigNumber.from(0))
  expect(to).to.eq(tokenData?.to ?? AddressZero)
  expect(confirmed).to.eq(tokenData?.confirmed ?? false)
  expect(spent).to.eq(tokenData?.spent ?? false)
}

async function expectOwner(
  chainId: BigNumber,
  tokenId: BigNumber,
  wrapperOwner: string
): Promise<void> {
  const owner = await fixture.ownerOf({
    chainId,
    tokenId,
  })
  expect(owner).to.eq(wrapperOwner)
}

