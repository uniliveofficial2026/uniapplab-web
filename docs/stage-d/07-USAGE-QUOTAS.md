# Usage, Quotas, Rate Limiting

## Usage metering

- `recordUsage({ projectId, environmentId, kind, amount, eventId, actorId })`
- `listUsage(projectId, actorId, { limit })`

**Idempotency:** duplicate `eventId` returns existing row without double-counting.

Default quota kinds tracked: `project.create`, `api.requests`, `rtc.rooms`.

## Quotas

- `setQuota(kind, max)` — admin override
- `checkQuota` throws `ValidationError('quota_exceeded')` when exceeded

Default limits (MVP):

| Kind | Default max |
| --- | --- |
| `project.create` | 100 |
| `api.requests` | 10000 |
| `rtc.rooms` | 50 |

## Rate limiting

Token-bucket per key (default 60/min). Used on org create, project create, deploy start. Throws `RateLimitError` when exceeded.

## Tests

Cloud tests cover usage recording and quota enforcement. Load harness (`scripts/stage-d-load-harness.mjs`) creates 25 concurrent projects with idempotent usage events.
