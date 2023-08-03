import _getDeployment from "@hop-protocol/shared-utils/utils/getDeployment"

export default function getDeployment(fileName?: string) {
  return _getDeployment(__dirname, fileName)
}
