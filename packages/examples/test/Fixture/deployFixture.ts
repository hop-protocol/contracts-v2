import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import type {
  ERC721Bridge as IERC721Bridge,
  MessengerMock as IMessengerMock,
} from '../../typechain'
import { DEFAULT_CHAIN_ID } from '../constants'
import { FixtureDefaults } from '../types'
import Fixture from '.'

async function deployFixture(
  _chainIds: BigNumber[],
  _name: string,
  _symbol: string,
  _defaults: FixtureDefaults
) {
  const messengerMocks: IMessengerMock[] = []
  const erc721Bridges: IERC721Bridge[] = []
  for (let i = 0; i < _chainIds.length; i++) {
    // Set chainId on the mocks for testing purposes
    const chainId = _chainIds[i]
    const chainIdsToSupport = _chainIds.filter((element, index) => {
      if (index === i) return false
      return true
    })

    const messengerMock = await deployMessengerMock(chainId)
    const erc721Bridge = await deployErc721Bridge(
      _name,
      _symbol,
      chainIdsToSupport,
      messengerMock.address,
      chainId
    )

    messengerMocks.push(messengerMock)
    erc721Bridges.push(erc721Bridge)

    // Update state
    await messengerMock.setTarget(erc721Bridge.address)
  }

  await messengerMocks[0].setCounterpart(messengerMocks[1].address)
  await messengerMocks[1].setCounterpart(messengerMocks[0].address)

  await erc721Bridges[0].setTargetAddressByChainId(
    _chainIds[1],
    erc721Bridges[1].address
  )
  await erc721Bridges[1].setTargetAddressByChainId(
    _chainIds[0],
    erc721Bridges[0].address
  )

  const fixture = new Fixture(
    _chainIds,
    erc721Bridges,
    messengerMocks,
    _defaults
  )

  return { fixture, erc721Bridges, messengerMocks, defaults: _defaults }
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
  _chainIds: BigNumber[],
  messengerAddress: string,
  chainId: BigNumber
): Promise<IERC721Bridge> {
  const Erc721Bridge = await ethers.getContractFactory('ERC721BridgeMock')

  return Erc721Bridge.deploy(
    _name,
    _symbol,
    _chainIds,
    messengerAddress,
    chainId
  ) as Promise<IERC721Bridge>
}

export default deployFixture
