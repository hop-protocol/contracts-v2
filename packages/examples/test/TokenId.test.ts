import { expect } from 'chai'
import { BigNumber, Signer, constants } from 'ethers'
import { ethers } from 'hardhat'
import {
  DEFAULT_CHAIN_ID,
  DEFAULT_SERIAL_NUMBER,
  DEFAULT_TOKEN_NAME,
  DEFAULT_TOKEN_SYMBOL,
  DEFAULT_PREVIOUS_TOKEN_ID,
} from './constants'
import {
  getTokenId,
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

describe('Token ID', function () {
  it('Should generate a token ID', async function () {
    const tokenId = await fixture.getTokenId()
    expect(tokenId).to.equal(defaults.tokenId)
  })
})
