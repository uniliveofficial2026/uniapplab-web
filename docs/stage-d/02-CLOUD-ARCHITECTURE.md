# UniLive Cloud Architecture (Stage D MVP)

## Package

`@unilives/cloud` — `lib/unilives-cloud/`

## Design

Stage D delivers an **in-process managed cloud control plane MVP** suitable for tests, examples, and future API hardening. It bridges to Stage B `@unilives/platform-core` control plane stores when creating projects.

```
Developer / CLI / Studio
        │
        ▼
  createUniLiveCloud()
        │
        ├── Organizations + RBAC members
        ├── Projects (soft-delete)
        ├── Environments (development | preview | production)
        ├── Secret refs (hash-only, never plaintext)
        ├── Provider connections + health metadata
        ├── Deployments (lifecycle + rollback target)
        ├── Custom domains (verification/tls metadata)
        ├── Usage events (idempotent by eventId)
        ├── Quotas + rate limits
        └── Audit log
```

## Storage model

In-memory `Map` structures — **not** a production Postgres deployment. Suitable for qualification and SDK contracts; a future slice would persist to `@unilives/database`.

## Security properties

- RBAC roles: `organization_owner`, `organization_admin`, `developer`, `operator`, `viewer`
- Cross-tenant access throws `PermissionError`
- Secret APIs store opaque `secret://…` refs only
- Provider health returns status metadata, never secret material

## Production RTC path (unchanged)

Managed cloud records provider connections but does **not** alter the production media path:

`UniLive App → UniLiveRTC → LiveKit`

## Classification

`managedCloudMvp`: **PRODUCTION_READY MVP** (library + tests). Live multi-tenant cloud hosting: **NOT_DEPLOYED**.
