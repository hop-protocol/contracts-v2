import { expect } from 'chai'
import { BigNumber, BigNumberish, Signer, constants } from 'ethers'
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
  expectCall,
} from './utils'
import Fixture from './Fixture'
import type { ERC721Bridge as IERC721Bridge } from '../typechain'

let erc721Bridge: IERC721Bridge
let sender: Signer
let chainIds: BigNumberish[]

let defaultTokenId: BigNumber

beforeEach(async function () {
  const signers = await ethers.getSigners()
  sender = signers[0]

  chainIds = [DEFAULT_CHAIN_ID, await sender.getChainId()]
  const deployment = await Fixture.deploy(
    chainIds,
    DEFAULT_TOKEN_NAME,
    DEFAULT_TOKEN_SYMBOL,
    {}
  )

  // TODO: This should not be here
  erc721Bridge = deployment.erc721Bridges[0]

  defaultTokenId = encodeTokenIndex(
    await sender.getAddress(),
    DEFAULT_TOKEN_INDEX
  )
})

describe('Token ID', function () {
  it('Should decode a token ID', async function () {
    const decodedTokenId = await erc721Bridge.decodeTokenId(defaultTokenId)
    const expectedValues = decodeTokenId(defaultTokenId)
    expect(decodedTokenId[0]).to.equal(expectedValues.address)
    expect(decodedTokenId[1]).to.equal(expectedValues.tokenIndex)
  })

  it('Should encode a token ID', async function () {
    const encodedTokenId = await erc721Bridge.encodeTokenId(
      await sender.getAddress(),
      defaultTokenId
    )
    const expectedValues = encodeTokenId(
      await sender.getAddress(),
      defaultTokenId
    )
    expect(encodedTokenId).to.equal(expectedValues)
  })

  it('Should encode a token index', async function () {
    const encodedTokenIndex = await erc721Bridge.encodeTokenIndex(
      await sender.getAddress(),
      DEFAULT_TOKEN_INDEX
    )
    const expectedValues = encodeTokenIndex(
      await sender.getAddress(),
      DEFAULT_TOKEN_INDEX
    )
    expect(encodedTokenIndex).to.equal(expectedValues)
  })

  it('Should generate a new token ID for a new recipient and subsequently return to the old token ID', async function () {
    const newRecipient = '0x0000000000000000000000000000000000000123'
    let newTokenId = await erc721Bridge.encodeTokenId(
      newRecipient,
      defaultTokenId
    )

    const derivedTokenId = encodeTokenId(newRecipient, defaultTokenId)
    expect(newTokenId).to.equal(derivedTokenId)

    // Re-calculate the old ID based on the new data
    newTokenId = await erc721Bridge.encodeTokenId(
      await sender.getAddress(),
      defaultTokenId
    )
    expect(newTokenId).to.equal(defaultTokenId)
  })

  it('Should return true when checking mintability', async function () {
    const canMint = await erc721Bridge.canMint(
      await sender.getAddress(),
      defaultTokenId
    )
    expect(canMint).to.be.true
  })

  it('Should return false when checking mintability', async function () {
    const canMint = await erc721Bridge.canMint(
      constants.AddressZero,
      defaultTokenId
    )
    expect(canMint).to.be.false
  })

  it('Should revert when encoding a token index due to an invalid tokenIndex', async function () {
    const maxTokenIndex = BigNumber.from(2).pow(96).sub(1)
    await expectCall(
      await erc721Bridge.populateTransaction.encodeTokenIndex(
        await sender.getAddress(),
        maxTokenIndex.add(1)
      ),
      sender
    ).to.be.revertedWith(`TokenIndexTooLarge(${maxTokenIndex.add(1)})`)
  })
})
