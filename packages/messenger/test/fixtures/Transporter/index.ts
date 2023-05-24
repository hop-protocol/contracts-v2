import {
  BigNumber,
  BigNumberish,
  Signer,
  BytesLike,
  ContractTransaction,
  utils
} from 'ethers'
import { ethers } from 'hardhat'
const { keccak256 } = ethers.utils
import type {
  SpokeTransporter as ISpokeTransporter,
  HubTransporter as IHubTransporter,
  Transporter as ITransporter,
  MockConnector as IMockConnector,
} from '../../../typechain'
type Interface = utils.Interface

import { SPOKE_CHAIN_ID_0, TRANSPORT_FEE } from '../../utils/constants'
import deployFixture from './deployFixture'

export type Defaults = {
  fromChainId: BigNumber
  toChainId: BigNumber
  commitment: string
}

class Fixture {
  // static state
  hubChainId: BigNumber
  hubTransporter: IHubTransporter
  spokeChainIds: BigNumber[]
  spokeTransporters: ISpokeTransporter[]
  transporters: { [key: string]: ITransporter }
  hubConnectors: { [key: string]: IMockConnector }
  spokeConnectors: { [key: string]: IMockConnector }
  defaults: Defaults

  // dynamic state
  commitments: string[]

  constructor(
    _hubChainId: BigNumber,
    _hubTransporter: IHubTransporter,
    _spokeChainIds: BigNumber[],
    _spokeTransporters: ISpokeTransporter[],
    _hubConnectors: IMockConnector[],
    _spokeConnectors: IMockConnector[],
    _defaults: Defaults
  ) {
    if (_spokeChainIds.length !== _spokeTransporters.length) {
      throw new Error('spokeChainIds and spokeTransporters must be same length')
    }

    this.hubChainId = _hubChainId
    this.hubTransporter = _hubTransporter
    this.spokeChainIds = _spokeChainIds
    this.spokeTransporters = _spokeTransporters

    const transporters: { [key: string]: ITransporter } = {
      [_hubChainId.toString()]: _hubTransporter,
    }
    const hubConnectors: { [key: string]: IMockConnector } = {}
    const spokeConnectors: { [key: string]: IMockConnector } = {}

    for (let i = 0; i < _spokeChainIds.length; i++) {
      const spokeChainId = _spokeChainIds[i].toString()
      transporters[spokeChainId] = _spokeTransporters[i]
      hubConnectors[spokeChainId] = _hubConnectors[i]
      spokeConnectors[spokeChainId] = _spokeConnectors[i]
    }
    this.transporters = transporters
    this.hubConnectors = hubConnectors
    this.spokeConnectors = spokeConnectors

    this.defaults = _defaults

    this.commitments = []
  }

  static async deploy(
    hubChainId: BigNumberish,
    spokeChainIds: BigNumberish[],
    defaults: Partial<Defaults> = {}
  ) {
    return deployFixture(hubChainId, spokeChainIds, defaults)
  }

  async setDispatchers(hubDispatcher: string, spokeDisptachers: string[]) {
    await this.hubTransporter.setDispatcher(hubDispatcher)
    for (let i = 0; i < this.spokeChainIds.length; i++) {
      const spokeTransporter = this.spokeTransporters[i]
      await spokeTransporter.setDispatcher(spokeDisptachers[i])
    }
  }

  async transportCommitment(
    fromSigner: Signer,
    overrides?: Partial<{
      fromChainId: BigNumberish
      toChainId: BigNumberish
      commitment: string
    }>
  ) {
    const fromChainId = overrides?.fromChainId ?? this.defaults.fromChainId
    const from = await fromSigner.getAddress()
    const toChainId = overrides?.toChainId ?? this.defaults.toChainId
    const commitment = overrides?.commitment ?? this.defaults.commitment

    const transporter = this.transporters[fromChainId.toString()]

    const tx = await transporter
      .connect(fromSigner)
      .transportCommitment(toChainId, commitment, {
        value: TRANSPORT_FEE,
      })
    const commitmentTransported = await this.getCommitmentTransportedEvent(tx)

    this.commitments.push(commitment)
  
    // Relay the commitment
    // secondConnectionTx will only be defined for only spoke-to-spoke relays
    const { firstConnectionTx, secondConnectionTx } = await this.relayCommitment(
      fromChainId,
      toChainId
    )

    if (!firstConnectionTx) throw new Error('No commitment relayed')

    const firstRelayEvents = await this.getRelayEvents(firstConnectionTx)
    let secondRelayEvents
    if (secondConnectionTx) {
      secondRelayEvents = await this.getRelayEvents(
        secondConnectionTx
      )
    }

    const commitmentRelayed = firstRelayEvents.commitmentRelayed
    const commitForwarded = firstRelayEvents.commitmentForwarded
    const commitmentProven = firstRelayEvents.commitmentProven ?? secondRelayEvents?.commitmentProven

    return {
      tx,
      firstConnectionTx,
      secondConnectionTx,
      commitmentTransported,
      commitmentRelayed,
      commitForwarded,
      commitmentProven
    }
  }

  async relayCommitment(
    fromChainId: BigNumberish,
    toChainId: BigNumberish
  ) {
    fromChainId = fromChainId.toString()
    toChainId = toChainId.toString()
    let firstConnector: IMockConnector | undefined
    let secondConnector: IMockConnector | undefined
    if (this.hubChainId.eq(fromChainId)) {
      firstConnector = this.hubConnectors[toChainId]
    } else {
      firstConnector = this.spokeConnectors[fromChainId]
      if (!this.hubChainId.eq(toChainId)) {
        secondConnector = this.hubConnectors[toChainId]
      }
    }

    const firstConnectionTx = await this._relay(firstConnector)
    let secondConnectionTx
    if (secondConnector) {
      secondConnectionTx = await this._relay(secondConnector)
    }
    return { firstConnectionTx, secondConnectionTx }
  }

  async _relay(connector: IMockConnector) {
    if (!connector) throw new Error('No connector found')
    const tx = await connector.relay()
    return tx
  }

  // Get events

  async getCommitmentTransportedEvent(tx: ContractTransaction) {
    const receipt = await tx.wait()

    const commitmentTransportedEvent = receipt.events?.find(
      e => e.event === 'CommitmentTransported'
    )
    if (!commitmentTransportedEvent?.args) throw new Error('No CommitmentTransported event found')
    const commitmentTransported = {
      toChainId: commitmentTransportedEvent.args.toChainId as BigNumber,
      commitment: commitmentTransportedEvent.args.commitment as string,
      timestamp: commitmentTransportedEvent.args.timestamp as BigNumber,
    }

    return commitmentTransported
  }

  async getRelayEvents(tx: ContractTransaction) {
    const commitmentRelayedEvent = await this._getRawEvent(
      tx,
      this.hubTransporter.interface,
      'CommitmentRelayed(uint256,uint256,bytes32,uint256,uint256,address)'
    )
    const commitmentRelayed = commitmentRelayedEvent
      ? {
          fromChainId: commitmentRelayedEvent.args.fromChainId as BigNumber,
          toChainId: commitmentRelayedEvent.args.toChainId as BigNumber,
          commitment: commitmentRelayedEvent.args.commitment as string,
          transportFee: commitmentRelayedEvent.args.transportFee as BigNumber,
          relayWindowStart: commitmentRelayedEvent.args.relayWindowStart as BigNumber,
          relayer: commitmentRelayedEvent.args.relayer as string
        }
      : undefined

    const commitmentProvenEvent = await this._getRawEvent(
      tx,
      this.hubTransporter.interface,
      'CommitmentProven(uint256,bytes32)'
    )
    const commitmentProven = commitmentProvenEvent
      ? {
          fromChainId: commitmentProvenEvent.args.fromChainId as BigNumber,
          commitment: commitmentProvenEvent.args.commitment as string,
        }
      : undefined

    const commitmentForwardedEvent = await this._getRawEvent(
      tx,
      this.hubTransporter.interface,
      'CommitmentForwarded(uint256,uint256,bytes32)'
    )
    const commitmentForwarded = commitmentForwardedEvent
      ? {
          fromChainId: commitmentForwardedEvent.args.fromChainId as BigNumber,
          toChainId: commitmentForwardedEvent.args.toChainId as BigNumber,
          commitment: commitmentForwardedEvent.args.commitment as string
        }
      : undefined

    return { commitmentRelayed, commitmentForwarded, commitmentProven }
  }

  async _getRawEvent(
    tx: ContractTransaction,
    iface: Interface,
    eventSig: string
  ) {
    const receipt = await tx.wait()
    const topic = ethers.utils.id(eventSig)
    const rawEvent = receipt.events?.find(e => e.topics[0] === topic)
    if (!rawEvent) return
    return iface.parseLog(rawEvent)
  }
}

export default Fixture
