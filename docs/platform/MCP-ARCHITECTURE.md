# MCP Architecture

`@unilives/mcp` provides `createUniLiveMcpServer()` — agent-facing tools with mandatory authorization.

## Server factory

```javascript
createUniLiveMcpServer({
  controlPlane,         // optional shared store
  credentialPublicId,  // required when requireAuth=true
  requireAuth: true,    // default
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
| `run_tests` | ci:run | Delegates to stage-b script |
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

## Entry binary

`lib/unilives-mcp/bin.mjs` — stdio MCP server wrapper (foundation).

## CLI bridge

`unilive mcp list` → `createUniLiveMcpServer({ requireAuth: false }).listTools()`

## Shared state

Inject shared `controlPlane` across API, MCP, and CLI for consistent project/credential state in dev.
