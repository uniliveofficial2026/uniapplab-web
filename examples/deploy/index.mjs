import { createControlPlaneStore } from '@unilives/platform-core';
import { createUniLiveDeploy } from '@unilives/deploy';

const controlPlane = createControlPlaneStore();
const org = controlPlane.createOrganization({ name: 'Deploy Example', actor: 'actor_demo' });
const project = controlPlane.createProject({ organizationId: org.organizationId, name: 'demo-app', actor: 'actor_demo' });
const [env] = controlPlane.listEnvironments(project.projectId);
const deploy = createUniLiveDeploy({ controlPlane });
const started = await deploy.start({
  projectId: project.projectId,
  environmentId: env.environmentId,
  gitSha: 'abc1234',
  actor: 'actor_demo',
});
console.log('PASS', JSON.stringify({ ok: true, deploymentId: started.deploymentId, provider: deploy.provider }));
