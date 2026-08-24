# Stage D Change Log

Baseline: Stage C seal `6e178efda203a31d947d6afd99a59784936f5598`

## New packages

| Package | Purpose |
| --- | --- |
| `@unilives/release` | Platform version + release manifest helpers |
| `@unilives/cloud` | Managed cloud control plane MVP |
| `@unilives/marketplace` | Local marketplace registry |
| `@unilives/ai-builder` | AI ProjectGraph planner |
| `@unilives/selfhost` | Self-host compose + backup/restore |

## New scripts

- `scripts/test-stage-d.mjs`
- `scripts/stage-d-*.mjs` (7 qualification scripts)

## New examples

- `examples/cloud-project`
- `examples/deploy`
- `examples/provider-plugin`
- `examples/ai-builder`
- `examples/self-host`

## Modified

- `package.json` — `test:stage-d` script
- `pnpm-workspace.yaml` — new lib packages
- `.github/workflows/ci.yml` — Stage D CI step
- `@unilives/observe` — redaction hardening
- `@unilives/cli`, `@unilives/mcp` — version alignment

## Unchanged invariants

- Production RTC: UniLiveRTC → LiveKit
- No SFU cutover
- No UI/UX visual changes

## 2026-08-24 — CI seal

- Committed `artifacts/api-server/test/live-pk-challenge.test.mjs` (16/16)
- CI step runs via `tsx` (`test:live-pk-challenge`)
- Remote GitHub Actions `verify` PASS: https://github.com/uniliveofficial2026/uniapplab-web/actions/runs/32782293889
- Hosted Vercel preview/production remains blocked (account blocked)
