import * as fs from 'fs'

function logDeployment(object: any) {
  let data = JSON.stringify(object, null, 2)

  const unixTimestamp = Math.floor(Date.now() / 1000);
  const path = `deployment-artifacts/${unixTimestamp}.json`

  fs.writeFile(path, data, (err) => {
    if (err) throw err;
    console.log('Deployment logged to', path)
  })
}

export default logDeployment
