import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import {
  HUB_CHAIN_ID,
  SPOKE_CHAIN_ID_0,
  SPOKE_CHAIN_ID_1,
} from '@hop-protocol/shared-utils/constants'
import Fixture from './fixture'

describe('Dispatcher', function () {
  describe('dispatchMessage', function () {
    describe('should revert if toChainId is not supported', async function () {
      let fromChainId: BigNumber
      it('from hub', async function () {
        fromChainId = SPOKE_CHAIN_ID_0
      })

      it('from spoke', async function () {
        fromChainId = HUB_CHAIN_ID
      })

      afterEach(async function () {
        const toChainId = 7653
        const [sender] = await ethers.getSigners()

        const { fixture } = await Fixture.deploy(HUB_CHAIN_ID, [
          SPOKE_CHAIN_ID_0,
          SPOKE_CHAIN_ID_1,
        ])

        expect(
          fixture.dispatchMessage(sender, {
            fromChainId,
            toChainId,
          })
        ).to.be.revertedWith(`InvalidRoute(${toChainId})`)
      })
    })
  })

  describe('getChainId', function () {
    it('should return the chainId', async function () {
      const fromChainId = SPOKE_CHAIN_ID_0
      const toChainId = HUB_CHAIN_ID

      const { fixture } = await Fixture.deploy(
        HUB_CHAIN_ID,
        [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
        { fromChainId, toChainId }
      )

      const executor = fixture.executors[HUB_CHAIN_ID.toString()]
      const chainId = await executor.getChainId()
      expect(chainId).to.eq(HUB_CHAIN_ID)
    })
  })
})
