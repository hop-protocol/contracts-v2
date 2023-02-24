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
  encodeTokenId,
  decodeTokenId,
  encodeTokenIndex,
  expectCallRevert,
} from './utils'
import Fixture from './Fixture'
import { FixtureDefaults } from './types'

let sender: Signer
let fixture: Fixture
let defaults: FixtureDefaults

beforeEach(async function () {
  const signers = await ethers.getSigners()
  sender = signers[0]

  const chainIds = [DEFAULT_CHAIN_ID, DEFAULT_CHAIN_ID.add(1)]
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

describe('Token ID', function () {
  it('Should decode a token ID', async function () {
    const decodedTokenId = await fixture.decodeTokenId()
    const expectedValues = decodeTokenId(defaults.tokenId)
    expect(decodedTokenId.address).to.equal(expectedValues.address)
    expect(decodedTokenId.tokenIndex).to.equal(expectedValues.tokenIndex)
  })

  it('Should encode a token ID', async function () {
    const encodedTokenId = await fixture.encodeTokenId()
    const expectedValues = encodeTokenId(
      await sender.getAddress(),
      defaults.tokenId
    )
    expect(encodedTokenId).to.equal(expectedValues)
  })

  it('Should encode a token index', async function () {
    const encodedTokenIndex = await fixture.encodeTokenIndex()
    const expectedValues = encodeTokenIndex(
      await sender.getAddress(),
      DEFAULT_TOKEN_INDEX
    )
    expect(encodedTokenIndex).to.equal(expectedValues)
  })

  it('Should generate a new token ID for a new recipient and subsequently return to the old token ID', async function () {
    const newRecipient = '0x0000000000000000000000000000000000000123'
    let newTokenId = await fixture.encodeTokenId({
      to: newRecipient,
    })

    const derivedTokenId = encodeTokenId(newRecipient, defaults.tokenId)
    expect(newTokenId).to.equal(derivedTokenId)

    // Re-calculate the old ID based on the new data
    newTokenId = await fixture.encodeTokenId({
      tokenId: derivedTokenId,
  })
    expect(newTokenId).to.equal(defaults.tokenId)
  })

  it('Should encodeTokenIndex with the min and max values for tokenIndex', async function () {
    const minTokenIndex = BigNumber.from(0)
    let encodedTokenIndex = await fixture.encodeTokenIndex({
      tokenIndex: minTokenIndex,
    })
    let expectedValues = encodeTokenIndex(
      await sender.getAddress(),
      minTokenIndex
    )
    expect(encodedTokenIndex).to.equal(expectedValues)

    const maxTokenIndex = BigNumber.from(2).pow(96).sub(1)
    encodedTokenIndex = await fixture.encodeTokenIndex({
      tokenIndex: maxTokenIndex,
    })
    expectedValues = encodeTokenIndex(await sender.getAddress(), maxTokenIndex)
    expect(encodedTokenIndex).to.equal(expectedValues)
  })

  it('Should return true when checking mintability', async function () {
    const canMint = await fixture.canMint()
    expect(canMint).to.be.true
  })

  it('Should return false when checking mintability', async function () {
    const canMint = await fixture.canMint({
      to: constants.AddressZero,
    })
    expect(canMint).to.be.false
  })

  it('Should revert when encoding a token index due to an invalid tokenIndex', async function () {
    const maxTokenIndex = BigNumber.from(2).pow(96).sub(1)
    await expectCallRevert(
      fixture.encodeTokenIndex({
        tokenIndex: maxTokenIndex.add(1),
      }),
      'TokenIndexTooLarge(uint256)',
      [maxTokenIndex.add(1)]
    )
  })
})
