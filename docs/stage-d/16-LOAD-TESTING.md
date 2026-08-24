# Load / Performance Qualification

## Harness

`scripts/stage-d-load-harness.mjs` — lightweight local concurrency test (no paid external load service).

### Scenario

- 25 concurrent `createProject` calls under one organization
- Usage events with duplicate `eventId` (idempotency check)
- Asserts unique project IDs and full project count

### Metrics recorded

```json
{ "projects": 25, "elapsedMs": <wall>, "p95HintMs": <wall> }
```

## Scope honesty

This is **qualification-level** load testing for MVP control plane logic — not hyperscale global cloud capacity proof.

## Classification

`loadQualification`: **PASS** (harness green). Advanced hyperscale global cloud: **FUTURE**.
