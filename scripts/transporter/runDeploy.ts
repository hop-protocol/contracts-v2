import deploy from './deploy'

deploy().catch(error => {
  console.error(error)
  process.exitCode = 1
})