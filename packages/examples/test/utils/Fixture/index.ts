import { BigNumber, Signer } from 'ethers'
import { FixtureDefaults, TokenData } from '../../libraries/types'
import type {
  ERC721CrossChain as IERC721CrossChain,
  MessengerMock as IMessengerMock,
} from '../../../typechain'
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
  erc721CrossChains: { [key: string]: IERC721CrossChain }
  messengerMocks: { [key: string]: IMessengerMock }
  defaults: FixtureDefaults

  constructor(
    _chainIds: BigNumber[],
    _erc721CrossChains: IERC721CrossChain[],
    _messengerMocks: IMessengerMock[],
    _defaults: FixtureDefaults
  ) {
    if (_chainIds.length !== 2) {
      throw new Error('only 2 supported chains allowed for tests')
    }
    if (_erc721CrossChains.length !== _messengerMocks.length) {
      throw new Error('crossChain contracts and messengers must be same length')
    }

    this.chainIds = _chainIds

    const erc721CrossChains: { [key: string]: IERC721CrossChain } = {}
    const messengerMocks: { [key: string]: IMessengerMock } = {}

    for (let i = 0; i < _chainIds.length; i++) {
      const chainId = _chainIds[i].toString()
      erc721CrossChains[chainId] = _erc721CrossChains[i]
      messengerMocks[chainId] = _messengerMocks[i]
    }

    this.erc721CrossChains = erc721CrossChains
    this.messengerMocks = messengerMocks

    this.defaults = _defaults
  }

  static async deploy(
    _sender: Signer,
    _chainIds: BigNumber[],
    _name: string,
    _symbol: string,
    _defaults: FixtureDefaults | undefined = undefined
  ) {
    return deployFixture(_sender, _chainIds, _name, _symbol, _defaults)
  }

  async mintWrapper(
    overrides?: Partial<{
      signer: Signer
      serialNumber: BigNumber
      previousTokenId: BigNumber
      chainId: BigNumber
    }>
  ) {
    const { signer, chainId, serialNumber, previousTokenId } =
      this.getOverridesOrDefaults(overrides)
    const erc721CrossChain = this.getErc721CrossChain(chainId)
    await erc721CrossChain
      .connect(signer)
      .mintWrapper(serialNumber, previousTokenId)
  }

  async send(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      tokenId: BigNumber
      toChainId: BigNumber
      to: string
      autoExecute: boolean
    }>
  ) {
    const { signer, chainId, tokenId, toChainId, to, autoExecute } =
      this.getOverridesOrDefaults(overrides)
    const erc721CrossChain = this.getErc721CrossChain(chainId)
    await erc721CrossChain.connect(signer).send(tokenId, toChainId, to)
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
    const { signer, chainId, tokenId, autoExecute } =
      this.getOverridesOrDefaults(overrides)
    const erc721CrossChain = this.getErc721CrossChain(chainId)
    await erc721CrossChain.connect(signer).confirm(tokenId)
    if (autoExecute) {
      await this.executePendingMessage(chainId)
    }
  }

  async getTokenId(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      to: string
      serialNumber: BigNumber
      previousTokenId: BigNumber
    }>
  ): Promise<BigNumber> {
    const { signer, chainId, to, serialNumber, previousTokenId } =
      this.getOverridesOrDefaults(overrides)
    const erc721CrossChain = this.getErc721CrossChain(chainId)
    return erc721CrossChain
      .connect(signer)
      .getTokenId(chainId, to, serialNumber, previousTokenId)
  }

  async getTokenData(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      tokenId: BigNumber
    }>
  ): Promise<TokenData> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721CrossChain = this.getErc721CrossChain(chainId)
    return erc721CrossChain.connect(signer).getTokenData(tokenId)
  }

  async getChainId(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
    }>
  ): Promise<BigNumber> {
    const { signer, chainId } = this.getOverridesOrDefaults(overrides)
    const erc721CrossChain = this.getErc721CrossChain(chainId)
    return erc721CrossChain.connect(signer).getChainId()
  }

  async getIsChainIdSupported(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      maybeChainIdSupported: BigNumber
    }>
  ): Promise<boolean> {
    const { signer, chainId } = this.getOverridesOrDefaults(overrides)
    const erc721CrossChain = this.getErc721CrossChain(chainId)
    return erc721CrossChain
      .connect(signer)
      .getIsChainIdSupported(overrides!.maybeChainIdSupported!)
  }

  async getCrossChain721AddressByChainId(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      chainIdForTarget: BigNumber
    }>
  ): Promise<string> {
    const { signer, chainId } = this.getOverridesOrDefaults(overrides)
    const erc721CrossChain = this.getErc721CrossChain(chainId)
    return erc721CrossChain
      .connect(signer)
      .getCrossChain721AddressByChainId(overrides!.chainIdForTarget!)
  }

  // Mock functions

  async mintWrapperAndConfirm(
    overrides?: Partial<{
      signer: Signer
      serialNumber: BigNumber
      chainId: BigNumber
    }>
  ) {
    const { signer, chainId, serialNumber } =
      this.getOverridesOrDefaults(overrides)
    const erc721CrossChain = this.getErc721CrossChain(chainId)
    await erc721CrossChain.connect(signer).mintWrapperAndConfirm(serialNumber)
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
    const erc721CrossChain = this.getErc721CrossChain(chainId)
    return erc721CrossChain.connect(signer).ownerOf(tokenId)
  }

  async exists(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumber
      tokenId: BigNumber
    }>
  ): Promise<boolean> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721CrossChain = this.getErc721CrossChain(chainId)

    try {
      // The OZ 721 contract reverts on this call if the owner is the zero address
      await erc721CrossChain.connect(signer).ownerOf(tokenId)
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
      const messenger = this.getMockMessenger(chainId)
      await messenger.executePendingMessage()
    }
  }

  // Other getters

  getErc721CrossChain(chainId: BigNumber) {
    return this.erc721CrossChains[chainId.toString()]
  }

  getMockMessenger(chainId: BigNumber) {
    return this.messengerMocks[chainId.toString()]
  }

  // @notice any is used since the overrides passed in can be any of the FixtureDefaults
  // TODO: More native Typescript way to do this
  getOverridesOrDefaults(overrides: any): FixtureDefaults {
    return {
      signer: overrides?.signer ?? this.defaults.signer,
      chainId: overrides?.chainId ?? this.defaults.chainId,
      tokenId: overrides?.tokenId ?? this.defaults.tokenId,
      toChainId: overrides?.toChainId ?? this.defaults.toChainId,
      to: overrides?.to ?? this.defaults.to,
      serialNumber: overrides?.serialNumber ?? this.defaults.serialNumber,
      previousTokenId: overrides?.previousTokenId ?? this.defaults.previousTokenId,
      owner: overrides?.owner ?? this.defaults.owner,
      autoExecute: overrides?.autoExecute ?? this.defaults.autoExecute,
    }
  }
}

export default Fixture
