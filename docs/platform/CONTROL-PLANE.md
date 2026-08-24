# Control Plane

Implemented in `@unilives/platform-core` as `createControlPlaneStore()` — in-memory foundation with audit trail.

## Entities

| Entity | Key fields |
|---|---|
| Organization | `organizationId`, `name` |
| Project | `projectId`, `organizationId`, `name` |
| Environment | `environmentId`, `projectId`, `kind` (development/preview/production) |
| Member | `memberId`, `organizationId`, `userId`, `role` |
| Provider connection | `connectionId`, `kind`, `provider`, `secretRef`, `config` |
| Deployment | `deploymentId`, `gitSha`, `status`, `providerDeploymentId` |
| API credential | `credentialId`, `publicId`, `secretRef`, `scopes`, `revoked` |

## Roles

`organization_owner | organization_admin | developer | operator | viewer`

## Audit events

All mutating operations emit audit rows: `project.created`, `member.added`, `provider.config.changed`, `deployment.started`, `api_key.created`, etc.

**Never logged**: raw secrets, tokens, api keys (stripped from properties).

## Authorization

`authorize({ credentialPublicId, projectId, requiredScope })` — used by SDK, MCP, and future API middleware.

Credential kinds: `public | server | developer | mcp`

## Bootstrap (dev)

`uniliveV1.ts` creates default org `unilives-reference` and project `uniapplab-web` at process start for local API testing.

## Persistence roadmap

Production control plane persists to Postgres. Current store is process-lifetime only — suitable for tests and API scaffolding.

## Usage recording

`recordUsage({ kind, ... })` complements RTC-specific `createRtcUsageMeter()` for platform-level billing events.
