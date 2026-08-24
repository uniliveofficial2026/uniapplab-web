# Deployment Control Plane

## Packages

- `@unilives/cloud` — deployment lifecycle in managed cloud MVP
- `@unilives/deploy` — Stage B deploy boundary (used by `examples/deploy`)

## Cloud deployment lifecycle

States: `QUEUED` → `BUILDING` → `DEPLOYING` → `VERIFYING` → `READY` | `FAILED` | `ROLLED_BACK` | `CANCELLED`

### API

- `startDeployment({ projectId, environmentId, gitSha, actorId, provider })`
- `advanceDeployment(deploymentId, status, actorId)`
- `rollbackDeployment({ deploymentId, actorId })` — restores prior `READY` deployment
- `listDeployments(projectId, actorId)`

### Rollback

When starting a new deployment, the previous `READY` deployment becomes `rollbackTarget`. Rollback restores that target to `READY`.

## Rate limiting

Deploy starts are rate-limited per project (`deploy:${projectId}`, 20/window).

## Example

`examples/deploy/index.mjs` exercises `@unilives/deploy` with `@unilives/platform-core` control plane.

## Production status

Deployment **orchestration logic** is implemented and tested. **No live Vercel/Fly production deploy** was executed as part of Stage D documentation seal in this worktree.
