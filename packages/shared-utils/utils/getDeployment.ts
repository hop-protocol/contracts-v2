import * as path from 'path';
import * as fs from 'fs';

const DEPLOYMENT_DIR = '../deployments';
const ARTIFACTS_DIR = '../deployment-artifacts';

function getDeployment(basePath: string, tag?: string) {
  const deploymentDir = path.join(basePath, DEPLOYMENT_DIR);
  const artifactsDir = path.join(basePath, ARTIFACTS_DIR);

  if (tag) {
    const deploymentPath = path.join(deploymentDir, tag);
    const artifactPath = path.join(artifactsDir, tag);

    if (fs.existsSync(deploymentPath)) {
      const jsonData = fs.readFileSync(deploymentPath, 'utf8');
      return JSON.parse(jsonData);
    }

    if (fs.existsSync(artifactPath)) {
      const jsonData = fs.readFileSync(artifactPath, 'utf8');
      return JSON.parse(jsonData);
    }

    throw new Error(`No deployment or artifact found with tag: ${tag}`);
  }

  let files = fs.readdirSync(deploymentDir);
  if (files.length === 0) {
    throw new Error('No config file found');
  }

  files = files.sort((a, b) => parseInt(a) - parseInt(b));

  const configPath = path.join(deploymentDir, files[0]);
  const jsonData = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(jsonData);
}

export default getDeployment
