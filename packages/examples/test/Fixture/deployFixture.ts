import { BigNumber, BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import type {
  ERC721Bridge as IERC721Bridge,
  MessengerMock as IMessengerMock,
} from '../../typechain'
import { DEFAULT_CHAIN_ID, DEFAULT_MAX_TOKEN_INDEX } from '../constants'
import Fixture, { Defaults } from '.'

async function deployFixture(
  _chainIds: BigNumberish[],
  _name: string,
  _symbol: string,
  _defaults: Partial<Defaults> = {}
) {
  const chainIds = _chainIds.map(n => BigNumber.from(n))

  const messengerMocks: IMessengerMock[] = []
  const erc721Bridges: IERC721Bridge[] = []
  for (let i = 0; i < chainIds.length; i++) {
    // Set chainId on the mocks for testing purposes
    const chainId = chainIds[i]
    const chainIdsToSupport = chainIds.filter((element, index) => {
      if (index === i) return false
      return true
    })

    const maxTokenIndex = chainId.eq(DEFAULT_CHAIN_ID)
      ? DEFAULT_MAX_TOKEN_INDEX
      : 0
    const messengerMock = await deployMessengerMock(chainId)
    const erc721Bridge = await deployErc721Bridge(
      _name,
      _symbol,
      chainIdsToSupport,
      messengerMock.address,
      chainId,
      maxTokenIndex
    )

    messengerMocks.push(messengerMock)
    erc721Bridges.push(erc721Bridge)

    // Update state
    await messengerMock.setTarget(erc721Bridge.address)
  }

  await messengerMocks[0].setCounterpart(messengerMocks[1].address)
  await messengerMocks[1].setCounterpart(messengerMocks[0].address)

  const defaultDefaults: Defaults = {}
  const defaults = Object.assign(defaultDefaults, _defaults)

  const fixture = new Fixture(chainIds, erc721Bridges, messengerMocks, defaults)

  return { fixture, erc721Bridges, messengerMocks }
}

async function deployMessengerMock(
  chainId: BigNumber
): Promise<IMessengerMock> {
  const MessengerMock = await ethers.getContractFactory('MessengerMock')

  return MessengerMock.deploy(chainId) as Promise<IMessengerMock>
}

async function deployErc721Bridge(
  _name: string,
  _symbol: string,
  _chainIds: BigNumberish[],
  messengerAddress: string,
  chainId: BigNumber,
  maxTokenIndex: BigNumberish = DEFAULT_MAX_TOKEN_INDEX
): Promise<IERC721Bridge> {
  const Erc721Bridge = await ethers.getContractFactory('ERC721BridgeMock')

  return Erc721Bridge.deploy(
    _name,
    _symbol,
    _chainIds,
    messengerAddress,
    chainId,
    maxTokenIndex
  ) as Promise<IERC721Bridge>
}

export default deployFixture
