import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import {
  HUB_CHAIN_ID,
  SPOKE_CHAIN_ID_0,
  SPOKE_CHAIN_ID_1,
  DEFAULT_COMMITMENT,
  TRANSPORT_FEE
} from './utils/constants'
const { provider } = ethers
import Fixture from './fixtures/Transporter/index'

describe('Transporter', function () {
  describe('dispatchCommitment', function () {
    it('Should complete a Spoke to Hub commitment', async function () {
      const fromChainId = SPOKE_CHAIN_ID_0
      const toChainId = HUB_CHAIN_ID
      const [deployer, sender] = await ethers.getSigners()

      const { fixture, hubTransporter } = await Fixture.deploy(
        HUB_CHAIN_ID,
        [SPOKE_CHAIN_ID_0,SPOKE_CHAIN_ID_1]
      )

      await fixture.setDispatchers(
        sender.address,
        [sender.address, sender.address],
      )

      const {
        commitmentTransported,
        commitmentRelayed,
        commitmentProven
      } = await fixture.dispatchCommitment(sender)

      // CommitmentDispatched event
      expect(commitmentTransported.toChainId).to.eq(BigNumber.from(toChainId))
      expect(commitmentTransported.commitment).to.eq(DEFAULT_COMMITMENT)

      // CommitmentRelayed event
      if (!commitmentRelayed) throw new Error('Commitment not relayed')
      expect(commitmentRelayed.fromChainId).to.eq(fromChainId)
      expect(commitmentRelayed.toChainId).to.eq(toChainId)
      expect(commitmentRelayed.commitment).to.eq(DEFAULT_COMMITMENT)
      expect(commitmentRelayed.transportFee).to.eq(TRANSPORT_FEE)
      const exitTime = await hubTransporter.getSpokeExitTime(fromChainId)
      expect(commitmentRelayed.relayWindowStart).to.eq(commitmentTransported.timestamp.add(exitTime))
      expect(commitmentRelayed.relayer).to.eq(deployer.address)

      if (!commitmentProven) throw new Error('Commitment not proven')
      expect(commitmentProven.fromChainId).to.eq(fromChainId)
      expect(commitmentProven.commitment).to.eq(DEFAULT_COMMITMENT)

      const hubTransporterBalance = await provider.getBalance(
        hubTransporter.address
      )
      expect(TRANSPORT_FEE).to.eq(hubTransporterBalance)
    })

    it('Should complete a Spoke to Spoke commitment', async function () {
      const fromChainId = SPOKE_CHAIN_ID_0
      const toChainId = SPOKE_CHAIN_ID_1
      const [deployer, sender, relayer] = await ethers.getSigners()

      const { fixture, hubTransporter } = await Fixture.deploy(
        HUB_CHAIN_ID,
        [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
        { toChainId }
      )
        
      await fixture.setDispatchers(
        sender.address,
        [sender.address, sender.address],
      )

      const {
        commitmentTransported,
        commitmentRelayed,
        commitForwarded,
        commitmentProven
      } = await fixture.dispatchCommitment(sender)

      // CommitmentDispatched event
      expect(commitmentTransported.toChainId).to.eq(toChainId)
      expect(commitmentTransported.commitment).to.eq(DEFAULT_COMMITMENT)

      // CommitmentRelayed event
      if (!commitmentRelayed) throw new Error('Commitment not relayed')
      expect(commitmentRelayed.fromChainId).to.eq(fromChainId)
      expect(commitmentRelayed.toChainId).to.eq(toChainId)
      expect(commitmentRelayed.commitment).to.eq(DEFAULT_COMMITMENT)
      expect(commitmentRelayed.transportFee).to.eq(TRANSPORT_FEE)
      const exitTime = await hubTransporter.getSpokeExitTime(fromChainId)
      expect(commitmentRelayed.relayWindowStart).to.eq(commitmentTransported.timestamp.add(exitTime))
      expect(commitmentRelayed.relayer).to.eq(deployer.address)

      if (!commitForwarded) throw new Error('Commitment not forwarded')
      expect(commitForwarded.fromChainId).to.eq(fromChainId)
      expect(commitForwarded.toChainId).to.eq(toChainId)
      expect(commitForwarded.commitment).to.eq(DEFAULT_COMMITMENT)

      if (!commitmentProven) throw new Error('Commitment not proven')
      expect(commitmentProven.fromChainId).to.eq(fromChainId)
      expect(commitmentProven.commitment).to.eq(DEFAULT_COMMITMENT)

      const hubTransporterBalance = await provider.getBalance(
        hubTransporter.address
      )
      expect(TRANSPORT_FEE).to.eq(hubTransporterBalance)
    })

    it('Should complete a Hub to Spoke commitment', async function () {
      const fromChainId = HUB_CHAIN_ID
      const toChainId = SPOKE_CHAIN_ID_0
      const [sender] = await ethers.getSigners()

      const { fixture, hubTransporter } = await Fixture.deploy(
        HUB_CHAIN_ID, 
        [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
        { fromChainId, toChainId }
      )

      await fixture.setDispatchers(
        sender.address,
        [sender.address, sender.address],
      )

      const {
        commitmentTransported,
        commitmentProven
      } = await fixture.dispatchCommitment(sender)

      // CommitmentDispatched event
      expect(commitmentTransported.toChainId).to.eq(toChainId)
      expect(commitmentTransported.commitment).to.eq(DEFAULT_COMMITMENT)

      if (!commitmentProven) throw new Error('Commitment not proven')
      expect(commitmentProven.fromChainId).to.eq(fromChainId)
      expect(commitmentProven.commitment).to.eq(DEFAULT_COMMITMENT)
    })

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

        const { fixture } = await Fixture.deploy(
          HUB_CHAIN_ID,
          [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1]
        )

        await fixture.setDispatchers(
          sender.address,
          [sender.address, sender.address],
        )

        expect(
          fixture.dispatchCommitment(sender, {
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
      const [sender] = await ethers.getSigners()

      const { hubTransporter } = await Fixture.deploy(
        HUB_CHAIN_ID,
        [SPOKE_CHAIN_ID_0, SPOKE_CHAIN_ID_1],
        { fromChainId, toChainId }
      )

      const chainId = await hubTransporter.getChainId()
      expect(chainId).to.eq(HUB_CHAIN_ID)
    })
  })
})
