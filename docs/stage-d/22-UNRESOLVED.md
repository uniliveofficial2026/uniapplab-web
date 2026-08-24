# Unresolved / External-Only Items

## External-only (cannot complete in engineering worktree alone)

| Item | Blocker | Target status |
| --- | --- | --- |
| Formal LICENSE file | Legal decision | Required before public OSS claim |
| npm registry publish | Registry auth + LICENSE | RELEASE_READY_EXTERNAL_STEP |
| Managed cloud production deploy | Infra + persistence layer | NOT_DEPLOYED |
| Hosted Vercel preview/production | Vercel account blocked | BLOCKED_EXTERNAL_VERCEL_ACCOUNT |
| ghcr.io image publish | Container build/push pipeline | Reference compose only |
| Production SFU cutover | Product decision + qualification | NOT_PERFORMED |

## Future engineering slices

- Persist `@unilives/cloud` to Postgres with RLS
- DNS/TLS automation for custom domains
- Public marketplace hosting (remote catalog)
- Hyperscale load qualification
- AI Builder paid provider integrations (beyond mock)

## No new architecture stage

Per handoff §22: Stage D completes the platform release slice. Do not start Stage E without explicit charter.
