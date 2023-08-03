import deployTransporter from '@hop-protocol/transporter/scripts/deploy'
import deployMessenger from '@hop-protocol/messenger/scripts/deploy'
import deployConnectors from '@hop-protocol/connectors/scripts/deploy'
import deployAliases from '@hop-protocol/aliases/scripts/deploy'

async function main() {
  const unixTimestamp = Math.floor(Date.now() / 1000)
  const fileName = `${unixTimestamp}.json`
  console.log('Deploying with fileName', fileName)

  await deployTransporter(fileName)
  await deployMessenger(fileName)
  await deployConnectors(fileName)
  await deployAliases(fileName)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})

export default main
