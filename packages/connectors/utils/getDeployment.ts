import _getDeployment from "@hop-protocol/scripts/utils/getDeployment"

export default function getDeployment(tag?: string) {
  return _getDeployment(__dirname, tag)
}
