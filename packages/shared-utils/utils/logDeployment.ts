import * as fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const writeFileAsync = promisify(fs.writeFile)
const mkdirAsync = promisify(fs.mkdir)
const existsAsync = promisify(fs.exists)

async function logDeployment(baseDir: string, object: any, fileName?: string) {
  console.log('logDeployment')
  let data = JSON.stringify(object, null, 2)

  const unixTimestamp = Math.floor(Date.now() / 1000)
  const artifactsDir = 'deployment-artifacts'
  const _fileName = fileName ?? `${unixTimestamp}.json`
  const filePath = path.join(baseDir, artifactsDir, _fileName)

  console.log('filePath', filePath)

  const artifactsDirExists = await existsAsync(artifactsDir)
  if (!artifactsDirExists) {
    await mkdirAsync(artifactsDir)
  }

  await writeFileAsync(filePath, data)
  console.log('Deployment logged to', filePath)
}

export default logDeployment
