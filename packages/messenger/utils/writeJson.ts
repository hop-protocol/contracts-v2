import * as fs from 'fs'

function writeJson(object: any, path: string) {
  let data = JSON.stringify(object, null, 2)

  fs.writeFile(path, data, (err) => {
    if (err) throw err;
    console.log('Data written to file');
  })
}

export default writeJson
