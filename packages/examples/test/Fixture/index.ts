import { BigNumber, Signer } from 'ethers'
import { FixtureDefaults, TokenData } from '../types'
import type {
  ERC721Bridge as IERC721Bridge,
  MessengerMock as IMessengerMock,
} from '../../typechain'
import deployFixture from './deployFixture'

export type MessageSentEvent = {
  messageId: string
  from: string
  toChainId: BigNumber
  to: string
  data: string
}

class Fixture {
  // static state
  chainIds: BigNumber[]
  erc721Bridges: { [key: string]: IERC721Bridge }
  messengerMocks: { [key: string]: IMessengerMock }
  defaults: FixtureDefaults

  constructor(
    _chainIds: BigNumber[],
    _erc721Bridges: IERC721Bridge[],
    _messengerMocks: IMessengerMock[],
    _defaults: FixtureDefaults
  ) {
    if (_chainIds.length !== 2) {
      throw new Error('only 2 supported chains allowed for tests')
    }
    if (_erc721Bridges.length !== _messengerMocks.length) {
      throw new Error('bridges and messengers must be same length')
    }

    this.chainIds = _chainIds

    const erc721Bridges: { [key: string]: IERC721Bridge } = {}
    const messengerMocks: { [key: string]: IMessengerMock } = {}

    for (let i = 0; i < _chainIds.length; i++) {
      const chainId = _chainIds[i].toString()
      erc721Bridges[chainId] = _erc721Bridges[i]
      messengerMocks[chainId] = _messengerMocks[i]
    }

    this.erc721Bridges = erc721Bridges
    this.messengerMocks = messengerMocks

    this.defaults = _defaults
  }

  static async deploy(
    _chainIds: BigNumber[],
    _name: string,
    _symbol: string,
    _defaults: FixtureDefaults
  ) {
    return deployFixture(_chainIds, _name, _symbol, _defaults)
  }

  async mintWrapper(
    overrides?: Partial<{
      signer: Signer
      previousTokenId: BigNumber
      serialNumber: BigNumber
      chainId: BigNumber
    }>
  ) {
    const { signer, chainId, previousTokenId, serialNumber } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    await erc721Bridge.connect(signer).mintWrapper(previousTokenId, serialNumber)
  }

  async send(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      toChainId: BigNumber
      to: string
      tokenId: BigNumber
      autoExecute: boolean
    }>
  ) {
    const { signer, chainId, toChainId, to, tokenId, autoExecute } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    await erc721Bridge.connect(signer).send(toChainId, to, tokenId)
    if (autoExecute) {
      await this.executePendingMessage(chainId)
    }
  }

  async confirm(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      tokenId: BigNumber
      autoExecute: boolean
    }>
  ) {
    // Note: this function should never be called externally, as it should only be reached by cross-chain
    // messages. This function is exposed here only for testing purposes.
    const { signer, chainId, tokenId, autoExecute } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    await erc721Bridge.connect(signer).confirm(tokenId)
    if (autoExecute) {
      await this.executePendingMessage(chainId)
    }
  }

  async getTokenId(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      to: string
      previousTokenId: BigNumber
      serialNumber: BigNumber
    }>
  ): Promise<BigNumber> {
    const { signer, chainId, to, previousTokenId, serialNumber } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).getTokenId(chainId, to, previousTokenId, serialNumber)
  }

  async getIsConfirmed(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      tokenId: BigNumber
    }>
  ): Promise<boolean> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).getIsConfirmed(tokenId)
  }

  async getIsSpent(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      tokenId: BigNumber
    }>
  ): Promise<boolean> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).getIsSpent(tokenId)
  }

  async getTokenData(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      tokenId: BigNumber
    }>
  ): Promise<TokenData> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).getTokenData(tokenId)
  }

  // Mock functions

  async mintWrapperAndConfirm(
    overrides?: Partial<{
      signer: Signer
      serialNumber: BigNumber
      chainId: BigNumber
    }>
  ) {
    const { signer, chainId, serialNumber } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    await erc721Bridge.connect(signer).mintWrapperAndConfirm(serialNumber)
  }

  // ERC721 functions

  async ownerOf(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      tokenId: BigNumber
    }>
  ): Promise<string> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).ownerOf(tokenId)
  }

  async exists(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      tokenId: BigNumber
    }>
  ): Promise<boolean> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)

    try {
      // The OZ 721 contract reverts on this call if the owner is the zero address
      await erc721Bridge.connect(signer).ownerOf(tokenId)
      return true
    } catch {
      return false
    }
  }

  // Mock messenger functions

  async executePendingMessage(chainId: BigNumber): Promise<void> {
    await this.executeMultiplePendingMessages([chainId])
  }

  async executeMultiplePendingMessages(
    chainIdsToForward: BigNumber[]
  ): Promise<void> {
    for (const chainId of chainIdsToForward) {
      const messenger = this.getMockMessengers(chainId)
      await messenger.executePendingMessage()
    }
  }

  // Other getters

  getErc721Bridges(chainId: BigNumber) {
    return this.erc721Bridges[chainId.toString()]
  }

  getMockMessengers(chainId: BigNumber) {
    return this.messengerMocks[chainId.toString()]
  }

  // @notice any is used since the overrides passed in can be any of the FixtureDefaults
  // TODO: More native Typescript way to do this
  getOverridesOrDefaults(overrides: any): FixtureDefaults {
    return {
      signer: overrides?.signer ?? this.defaults.signer,
      chainId: overrides?.chainId ?? this.defaults.chainId,
      toChainId: overrides?.toChainId ?? this.defaults.toChainId,
      to: overrides?.to ?? this.defaults.to,
      tokenId: overrides?.tokenId ?? this.defaults.tokenId,
      previousTokenId: overrides?.previousTokenId ?? this.defaults.previousTokenId,
      serialNumber: overrides?.serialNumber ?? this.defaults.serialNumber,
      autoExecute: overrides?.autoExecute ?? this.defaults.autoExecute,
    }
  }
}

export default Fixture
