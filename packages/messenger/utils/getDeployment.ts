import fs from 'fs'
import path from 'path'

const MESSENGER_CONFIG_DIR = '../deployments'

function getDeployment() {
  const deploymentDir = path.join(__dirname, MESSENGER_CONFIG_DIR)
  let files = fs.readdirSync(deploymentDir);
  if (files.length === 0) {
    throw new Error('No config file found')
  }
  files = files.sort((a, b) => parseInt(a) - parseInt(b))

  const configPath = path.join(deploymentDir, files[0])
  const jsonData = fs.readFileSync(configPath, 'utf8')
  return JSON.parse(jsonData)
}

export default getDeployment
