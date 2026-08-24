# 07 — Control Plane (`@unilives/platform-core`)

Implemented as `createControlPlaneStore()` — in-memory foundation with audit trail.

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

`authorize({ credentialPublicId, projectId, requiredScope })` — used by SDK, MCP, and target API middleware.

Credential kinds: `public | server | developer | mcp`

## Bootstrap (dev)

`uniliveV1.ts` creates default org `unilives-reference` and project `uniapplab-web` at process start.

## Usage recording

`recordUsage({ kind, ... })` complements RTC-specific `createRtcUsageMeter()`.

## Stage C work

| Item | Status |
|---|---|
| In-memory store | **IMPLEMENTED** (Stage B) |
| Postgres adapter | **NOT STARTED** — Stage C priority |
| API middleware on all mutating routes | **NOT STARTED** |
| Multi-process consistency | Requires Postgres |

## Evidence

`scripts/test-stage-b.mjs` → `control_plane_and_sdk`, `deploy_git_registry`
