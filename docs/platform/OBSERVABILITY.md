# Observability

Platform observability combines audit logs, RTC usage rollup, and trace correlation — without leaking secrets.

## Trace context

`createTraceContext(partial)` in platform-core:

```javascript
{
  traceId,           // auto-minted if omitted
  canonicalUserId, sessionId, roomId, callId,
  pkId, giftEventId, deploymentId
}
```

Used by SDK `events.createTrace` and `observe.createTrace`.

## Audit log

Control plane records:

- Project/member/provider/deployment/api key lifecycle
- Query: `controlPlane.listAudit({ limit })`
- API: `GET /v1/logs?limit=50`
- MCP: `get_logs`
- CLI: `unilive logs`

## Metrics

| Source | Content |
|---|---|
| `createRtcUsageMeter().rollup()` | Room/participant/track sessions |
| `controlPlane.listUsage()` | Platform usage rows |
| API | `GET /v1/metrics` |
| MCP | `get_metrics` |

## Provider health

`GET /v1/providers` and MCP `inspect_provider_health` — adapter status without credentials.

## Product observability (existing)

Reference app retains LiveKit telemetry (`hostLiveKitTelemetry.ts`) during migration. Target: provider `getStats()` + platform trace ids.

## Logging rules

1. Never log raw tokens or API keys
2. Prefer event ids over full payloads in audit
3. Correlate RTC webhooks via `{provider}:{providerEventId}`

## Future

- OpenTelemetry export from api-server
- Dashboard binding in App Builder graph
- QoE time-series from governor samples

## Stage A evidence

Production web build PASS; smoke suites produce pass/fail artifacts in `docs/production-hardening/`.
