/**
 * Deployment boundary — Git SHA → build → preview → production → rollback.
 */

export function createUniLiveDeploy({ controlPlane, provider = 'vercel' } = {}) {
  if (!controlPlane) throw new Error('controlPlane_required');
  return {
    provider,
    async start({ projectId, environmentId, gitSha, actor }) {
      return controlPlane.startDeployment({ projectId, environmentId, gitSha, provider, actor });
    },
    async complete(deploymentId, opts) {
      return controlPlane.completeDeployment(deploymentId, opts);
    },
  };
}
