# Tenant Isolation

## Enforcement layer

`@unilives/cloud` RBAC + project ownership:

- Every project belongs to one organization
- `assertProjectAccess` verifies actor membership + permission
- Cross-tenant `getProject`, `listUsage`, `listDeployments` throw `PermissionError`

## Test evidence

| Test | Assertion |
| --- | --- |
| `cloud.test.mjs` | Org A owner cannot read Org B project |
| `stage-d-security-matrix.mjs` | Cross-org usage + deploy list denied |
| `stage-d-load-harness.mjs` | 25 projects isolated under single org (no cross-org bleed) |

## Marketplace isolation

Install paths scoped to registry data dir; manifests cannot embed secrets (validation rejects secret-like keys).

## Limits (MVP)

In-memory store — no network-level isolation. Production multi-tenant hosting would add API auth, row-level security, and network policies (**FUTURE** for managed cloud deploy).
