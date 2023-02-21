import { expect } from 'chai'
import { BigNumber, BigNumberish, Signer, constants } from 'ethers'
import { ethers } from 'hardhat'
import {
  DEFAULT_CHAIN_ID,
  DEFAULT_TOKEN_INDEX,
  DEFAULT_TOKEN_NAME,
  DEFAULT_TOKEN_SYMBOL,
} from './constants'
import { encodeTokenId, decodeTokenId, generateTokenId } from './utils'
import { TokenIdEncodingParams } from './types'
import Fixture from './Fixture'
import type { ERC721Bridge as IERC721Bridge } from '../typechain'

let erc721Bridge: IERC721Bridge
let sender: Signer
let chainIds: BigNumberish[]

let defaultTokenId: BigNumber
let tokenIdEncodingValues: TokenIdEncodingParams

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

  defaultTokenId = generateTokenId(
    await sender.getAddress(),
    DEFAULT_TOKEN_INDEX
  )
  const decodedTokenId = decodeTokenId(defaultTokenId)
  tokenIdEncodingValues = {
    address: decodedTokenId.address,
    tokenIndex: decodedTokenId.tokenIndex,
  }
})

describe('Token ID', function () {
  it('Should decode a token ID', async function () {
    const decodedTokenId = await erc721Bridge.decodeTokenId(defaultTokenId)
    expect(decodedTokenId[0]).to.equal(tokenIdEncodingValues.address)
    expect(decodedTokenId[1]).to.equal(tokenIdEncodingValues.tokenIndex)
  })

  it('Should generate a new token ID for a new recipient and subsequently return to the old token ID', async function () {
    const newRecipient = '0x0000000000000000000000000000000000000123'
    let newTokenId = await erc721Bridge.encodeTokenId(
      newRecipient,
      defaultTokenId
    )

    const derivedTokenId = encodeTokenId(
      newRecipient,
      tokenIdEncodingValues.tokenIndex
    )
    expect(newTokenId).to.equal(derivedTokenId)

    // Re-calculate the old ID based on the new data
    newTokenId = await erc721Bridge.encodeTokenId(
      tokenIdEncodingValues.address,
      defaultTokenId
    )
    expect(newTokenId).to.equal(defaultTokenId)
  })

  it('Should return true when checking mintability', async function () {
    const canMint = await erc721Bridge.canMint(
      tokenIdEncodingValues.address,
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
})
