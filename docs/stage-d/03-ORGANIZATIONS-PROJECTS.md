# Organizations, Projects, Environments

## API surface (`@unilives/cloud`)

### Organizations

- `createOrganization({ name, ownerActorId })` — creates org + owner member
- `addMember({ organizationId, actorId, role, byActorId })` — RBAC assignment (owner role not assignable via add)
- `listMembers(organizationId, actorId)`

### Projects

- `createProject({ organizationId, name, actorId })` — creates project + three environments
- `getProject` / `listProjects` / `softDeleteProject`
- Projects link to Stage B control plane via `controlPlaneProjectId`

### Environments

Auto-created per project:

| Kind | Purpose |
| --- | --- |
| `development` | Local / dev iteration |
| `preview` | Preview deployments |
| `production` | Production deployments |

- `listEnvironments(projectId, actorId)`
- `getEnvironment(environmentId, actorId)`

## RBAC permissions

Role → permission map enforced on every mutating call. Viewers can read projects but cannot create them. Deploy write requires developer+ roles.

## Tests

`lib/unilives-cloud/test/cloud.test.mjs` — org/project/env creation, cross-tenant denial, viewer restrictions.

## Example

`examples/cloud-project/index.mjs` — creates org, project, lists environments.
