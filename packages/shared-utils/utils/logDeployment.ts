import * as fs from 'fs'
import path from 'path'

function logDeployment(object: any) {
  let data = JSON.stringify(object, null, 2)

  const unixTimestamp = Math.floor(Date.now() / 1000)
  const dir = 'deployment-artifacts'
  const filePath = path.join(dir, `${unixTimestamp}.json`)

  // Check if the directory exists, create it if it doesn't
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }

  fs.writeFile(filePath, data, (err) => {
    if (err) throw err
    console.log('Deployment logged to', filePath)
  })
}

export default logDeployment
