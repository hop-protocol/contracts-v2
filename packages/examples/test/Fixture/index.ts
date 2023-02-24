import { BigNumber, BigNumberish, Signer } from 'ethers'
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
    _chainIds: BigNumberish[],
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
      tokenId: BigNumberish
      chainId: BigNumberish
    }>
  ) {
    const { signer, chainId, to, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    await erc721Bridge.connect(signer).mint(to, tokenId)
  }

  async send(
    overrides?: Partial<{
      signer: Signer
      chainId: BigNumberish
      toChainId: BigNumberish
      to: string
      tokenId: BigNumberish
    }>
  ) {
    const { signer, chainId, toChainId, to, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    await erc721Bridge.connect(signer).send(toChainId, to, tokenId)
  }

  async canMint(
    overrides?: Partial<{
      chainId: BigNumberish
      to: string
      tokenId: BigNumberish
    }>
  ): Promise<boolean> {
    const { signer, chainId, to, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).canMint(to, tokenId)
  }

  async getTokenOwner(
    overrides?: Partial<{
      chainId: BigNumberish
      tokenId: BigNumberish
    }>
  ): Promise<string> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).ownerOf(tokenId)
  }

  async encodeTokenId(
    overrides?: Partial<{
      chainId: BigNumberish
      to: string
      tokenId: BigNumberish
    }>
  ): Promise<BigNumber> {
    const { signer, chainId, to, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).encodeTokenId(to, tokenId)
  }

  async encodeTokenIndex(
    overrides?: Partial<{
      chainId: BigNumberish
      to: string
      tokenIndex: BigNumberish
    }>
  ): Promise<BigNumber> {
    const { signer, chainId, to, tokenIndex } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).encodeTokenIndex(to, tokenIndex)
  }

  async decodeTokenId(
    overrides?: Partial<{
      chainId: BigNumberish
      tokenId: BigNumberish
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
      chainId: BigNumberish
      tokenId: BigNumberish
    }>
  ): Promise<TokenStatuses> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).tokenStatuses(tokenId)
  }

  async isInitialMintOnHubComplete(
    overrides?: Partial<{
      chainId: BigNumberish
      tokenId: BigNumberish
    }>
  ): Promise<TokenStatuses> {
    const { signer, chainId, tokenId } = this.getOverridesOrDefaults(overrides)
    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.connect(signer).isInitialMintOnHubComplete(tokenId)
  }

  // Other getters

  getErc721Bridges(chainId: BigNumberish) {
    return this.erc721Bridges[chainId.toString()]
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
    }
  }
}

export default Fixture
