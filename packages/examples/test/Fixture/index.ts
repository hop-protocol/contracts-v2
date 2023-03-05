import { BigNumber, Signer } from 'ethers'
import { DecodedTokenIdParams, FixtureDefaults, TokenStatuses } from '../types'
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

  async mint(
    overrides?: Partial<{
      signer: Signer
      to: string
      tokenId: BigNumber
      chainId: BigNumber
    }>
  ) {
    const { signer, chainId, to, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    await erc721Bridge.connect(signer).mint(to, tokenId)
  }

  async burn(
    overrides?: Partial<{
      signer: Signer
      tokenId: BigNumber
      chainId: BigNumber
    }>
  ) {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    await erc721Bridge.connect(signer).burn(tokenId)
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

  async mintAndSend(
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
    await erc721Bridge.connect(signer).mintAndSend(toChainId, to, tokenId)
    if (autoExecute) {
      await this.executePendingMessage(chainId)
    }
  }

  async canMint(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      to: string
      tokenId: BigNumber
    }>
  ): Promise<boolean> {
    const { signer, chainId, to, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).canMint(to, tokenId)
  }

  async encodeTokenId(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      to: string
      tokenId: BigNumber
    }>
  ): Promise<BigNumber> {
    const { signer, chainId, to, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).encodeTokenId(to, tokenId)
  }

  async encodeTokenIndex(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      to: string
      tokenIndex: BigNumber
    }>
  ): Promise<BigNumber> {
    const { signer, chainId, to, tokenIndex } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).encodeTokenIndex(to, tokenIndex)
  }

  async decodeTokenId(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      tokenId: BigNumber
    }>
  ): Promise<DecodedTokenIdParams> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    const decodedTokenId = await erc721Bridge.connect(signer).decodeTokenId(tokenId)
    return {
      address: decodedTokenId[0],
      tokenIndex: decodedTokenId[1],
    }
  }

  async getTokenStatus(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      tokenId: BigNumber
    }>
  ): Promise<TokenStatuses> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    const tokenStatus = await erc721Bridge.connect(signer).getTokenStatus(tokenId)
    return {
      confirmed: tokenStatus.confirmed,
      tokenForwardCount: tokenStatus.tokenForwardCount,
      tokenForwardDatas: tokenStatus.tokenForwardDatas,
    }
  }

  async getInitialMintOnHubComplete(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      tokenId: BigNumber
    }>
  ): Promise<boolean> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).getInitialMintOnHubComplete(tokenId)
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
      tokenIndex: overrides?.tokenIndex ?? this.defaults.tokenIndex,
      autoExecute: overrides?.autoExecute ?? this.defaults.autoExecute,
    }
  }
}

export default Fixture
