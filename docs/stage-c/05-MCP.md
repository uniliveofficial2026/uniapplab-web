# 05 — MCP (`@unilives/mcp`)

Agent-facing tool surface: `createUniLiveMcpServer()`.

## Package

- Path: `lib/unilives-mcp`
- Name: `@unilives/mcp` v0.1.0
- Entry: `bin.mjs` — stdio MCP server wrapper (foundation)

## Server factory

```javascript
createUniLiveMcpServer({
  controlPlane,          // optional shared store
  credentialPublicId,    // required when requireAuth=true
  requireAuth: true,     // default
})
```

## Tool catalog

| Tool | Scope | Description |
|---|---|---|
| `create_project` | project:write | Create org + project |
| `get_project` | project:read | Fetch project |
| `list_projects` | project:read | List projects |
| `create_rtc_room` | rtc:write | Fake provider room (tests) |
| `end_rtc_room` | rtc:write | Tear down room |
| `get_rtc_stats` | rtc:read | Stats + usage metrics |
| `inspect_database` | database:read | Provider info only |
| `create_storage_bucket` | storage:write | Bucket stub |
| `run_tests` | ci:run | Delegates to `test-stage-b.mjs` |
| `run_build` | ci:run | Delegates to build |
| `create_deployment` | deploy:write | Start deployment record |
| `get_deployment` | deploy:read | Audit hints |
| `get_logs` | observe:read | Audit tail |
| `get_metrics` | observe:read | RTC rollup |
| `inspect_provider_health` | observe:read | Registry list |
| `simulate_call` | rtc:write | Call orchestrator |
| `simulate_pk` | rtc:write | PK orchestrator |

## Security

- Unauthorized calls return `{ ok: false, error: 'mcp_auth_required' }`
- Never returns secret values or provider API keys
- RTC rooms use `@unilives/rtc-fake` — no LiveKit Cloud spend from MCP

## CLI bridge

`unilive mcp list` → `createUniLiveMcpServer({ requireAuth: false }).listTools()`

## Shared state

Inject shared `controlPlane` across API, MCP, and CLI for consistent project/credential state in dev.

## Stage C productization

- [ ] Publish-ready bin packaging
- [ ] Tool schema export for MCP registry
- [ ] Document credential setup for agents
- [ ] Stage C test suite additions via `run_tests`

## Evidence

`scripts/test-stage-b.mjs` → `mcp_requires_auth`
