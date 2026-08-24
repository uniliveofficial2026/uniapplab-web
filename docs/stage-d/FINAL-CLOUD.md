# FINAL — UniLive Cloud

## Package

`@unilives/cloud` v0.1.0

## Capabilities

- Organizations + RBAC (5 roles)
- Projects with soft-delete
- Environments: development, preview, production
- Secret refs (hash-only)
- Provider connections + health metadata
- Deployment lifecycle + rollback
- Custom domain resource records
- Usage metering (idempotent)
- Quotas + rate limiting
- Audit log with platform version

## Deployment status

**Library MVP: PASS.** Live managed cloud SaaS: **NOT_DEPLOYED**.

## Entry point

```js
import { createUniLiveCloud } from '@unilives/cloud';
const cloud = createUniLiveCloud();
```

## Tests

`lib/unilives-cloud/test/cloud.test.mjs` + security matrix + load harness.
