import _getDeployment from "./getDeployment"

export default function getDeployment(tag?: string) {
  return _getDeployment(__dirname, tag)
}
