import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import type {
  ERC721CrossChain as IERC721CrossChain,
  MessengerMock as IMessengerMock,
} from '../../../typechain'
import { FixtureDefaults } from '../types'
import Fixture from '.'

async function deployFixture(
  _chainIds: BigNumber[],
  _name: string,
  _symbol: string,
  _defaults: FixtureDefaults
) {
  const messengerMocks: IMessengerMock[] = []
  const erc721CrossChains: IERC721CrossChain[] = []
  for (let i = 0; i < _chainIds.length; i++) {
    // Set chainId on the mocks for testing purposes
    const chainId = _chainIds[i]
    const chainIdsToSupport = _chainIds.filter((element, index) => {
      if (index === i) return false
      return true
    })

    const messengerMock = await deployMessengerMock(chainId)
    const erc721CrossChain = await deployErc721CrossChain(
      _name,
      _symbol,
      chainIdsToSupport,
      messengerMock.address,
      chainId
    )

    messengerMocks.push(messengerMock)
    erc721CrossChains.push(erc721CrossChain)

    // Update state
    await messengerMock.setTarget(erc721CrossChain.address)
  }

  await messengerMocks[0].setCounterpart(messengerMocks[1].address)
  await messengerMocks[1].setCounterpart(messengerMocks[0].address)

  await erc721CrossChains[0].setTargetAddressesByChainId(
    [_chainIds[1]],
    [erc721CrossChains[1].address]
  )
  await erc721CrossChains[1].setTargetAddressesByChainId(
    [_chainIds[0]],
    [erc721CrossChains[0].address]
  )

  const fixture = new Fixture(
    _chainIds,
    erc721CrossChains,
    messengerMocks,
    _defaults
  )

  return { fixture, erc721CrossChains, messengerMocks, defaults: _defaults }
}

async function deployMessengerMock(
  chainId: BigNumber
): Promise<IMessengerMock> {
  const MessengerMock = await ethers.getContractFactory('MessengerMock')

  return MessengerMock.deploy(chainId) as Promise<IMessengerMock>
}

async function deployErc721CrossChain(
  _name: string,
  _symbol: string,
  _chainIds: BigNumber[],
  messengerAddress: string,
  chainId: BigNumber
): Promise<IERC721CrossChain> {
  const Erc721CrossChain = await ethers.getContractFactory('ERC721CrossChainMock')

  return Erc721CrossChain.deploy(
    _name,
    _symbol,
    _chainIds,
    messengerAddress,
    chainId
  ) as Promise<IERC721CrossChain>
}

export default deployFixture
