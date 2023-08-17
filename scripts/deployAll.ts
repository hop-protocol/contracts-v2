import deployTransporter from './transporter/deploy'
import deployMessenger from './messenger/deploy'
import deployConnectors from './connectors/deploy'
import deployAliases from './aliases/deploy'

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
