import _getDeployment from "../../shared/utils/getDeployment"

export default function getDeployment(tag?: string) {
  return _getDeployment(__dirname, tag)
}
