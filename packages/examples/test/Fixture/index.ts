import { BigNumber, BigNumberish, Signer, constants } from 'ethers'
import { TokenStatuses } from '../types'
import type {
  ERC721Bridge as IERC721Bridge,
  MessengerMock as IMessengerMock,
} from '../../typechain'

import deployFixture from './deployFixture'

export type Defaults = {
}

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
  defaults: Defaults

  constructor(
    _chainIds: BigNumber[],
    _erc721Bridges: IERC721Bridge[],
    _messengerMocks: IMessengerMock[],
    _defaults: Defaults
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
    _defaults: Partial<Defaults> = {}
  ) {
    return deployFixture(_chainIds, _name, _symbol, _defaults)
  }

  async mint(
    fromSigner: Signer,
    overrides?: Partial<{
      to: string
      tokenIds: BigNumberish[]
      chainId: BigNumberish
    }>
  ) {
    const chainId = overrides?.chainId ?? await fromSigner.getChainId()
    const from = await fromSigner.getAddress()
    const to = overrides?.to ?? from
    const tokenIds = overrides?.tokenIds ?? []

    const erc721Bridge = this.getErc721Bridges(chainId)
    await erc721Bridge.connect(fromSigner).mint(to, tokenIds)
  }

  async send(
    fromSigner: Signer,
    overrides?: Partial<{
      fromChainId: BigNumberish
      toChainId: BigNumberish
      to: string
      tokenIds: BigNumberish[]
    }>
  ) {
    const fromChainId = await fromSigner.getChainId()
    const from = await fromSigner.getAddress()
    const toChainId = overrides?.toChainId ?? this.chainIds[1]
    const to = overrides?.to ?? from
    const tokenIds = overrides?.tokenIds ?? []

    const erc721Bridge = this.getErc721Bridges(fromChainId)
    await erc721Bridge.connect(fromSigner).send(toChainId, to, tokenIds)
  }

  // Contract getters

  async getTokenOwner(
    overrides?: Partial<{
      chainId: BigNumberish
      tokenId: BigNumberish
    }>
  ): Promise<string> {
    const chainId = overrides?.chainId ?? this.chainIds[0]
    const tokenId = overrides?.tokenId ?? 0

    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.ownerOf(tokenId)
  }

  async getTokenId(
    overrides?: Partial<{
      chainId: BigNumberish
      owner: string
      tokenId: BigNumberish
    }>
  ): Promise<BigNumber> {
    const chainId = overrides?.chainId ?? this.chainIds[0]
    const owner = overrides?.owner ?? constants.AddressZero
    const tokenId = overrides?.tokenId ?? 0

    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.getUpdatedTokenId(owner, tokenId)
  }

  async getTokenStatus(
    overrides?: Partial<{
      chainId: BigNumberish
      owner: string
      tokenId: BigNumberish
    }>
  ): Promise<TokenStatuses> {
    const chainId = overrides?.chainId ?? this.chainIds[0]
    const tokenId = overrides?.tokenId ?? 0

    const erc721Bridge = this.getErc721Bridges(chainId)
    return erc721Bridge.tokenStatuses(tokenId)
  }

  // Other getters

  getErc721Bridges(chainId: BigNumberish) {
    return this.erc721Bridges[chainId.toString()]
  }
}

export default Fixture
