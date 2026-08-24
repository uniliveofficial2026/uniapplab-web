# 17 — Observability (`@unilives/observe`)

Platform observability: audit logs, RTC usage rollup, trace correlation — without leaking secrets.

## Package

- Path: `lib/unilives-observe`
- Name: `@unilives/observe` v0.1.0

Also implemented in `@unilives/platform-core`: `createTraceContext()`.

## Trace context

```javascript
{
  traceId,           // auto-minted if omitted
  canonicalUserId, sessionId, roomId, callId,
  pkId, giftEventId, deploymentId
}
```

Used by SDK `events.createTrace` and `observe.createTrace`.

## Audit log

Control plane records project/member/provider/deployment/api key lifecycle.

| Consumer | Access |
|---|---|
| API | `GET /v1/logs?limit=50` |
| MCP | `get_logs` |
| CLI | `unilive logs` |

## Metrics

| Source | Content |
|---|---|
| `createRtcUsageMeter().rollup()` | Room/participant/track sessions |
| `controlPlane.listUsage()` | Platform usage rows |
| API | `GET /v1/metrics` |
| MCP | `get_metrics` |

## Provider health

`GET /v1/providers` and MCP `inspect_provider_health` — adapter status without credentials.

## Product observability (migration)

Reference app retains LiveKit telemetry (`hostLiveKitTelemetry.ts`) during migration. Target: provider `getStats()` + platform trace ids.

## Logging rules

1. Never log raw tokens or API keys
2. Prefer event ids over full payloads in audit
3. Correlate RTC webhooks via `{provider}:{providerEventId}`

## Stage C work

- [ ] OpenTelemetry export from api-server
- [ ] QoE time-series from governor samples
- [ ] Persist audit/metrics to Postgres

## Classification

**IMPLEMENTED** + **NEEDS_PRODUCTIZATION**

## Evidence

Platform-core trace + usage meter in Stage B suite; observe package implemented.
