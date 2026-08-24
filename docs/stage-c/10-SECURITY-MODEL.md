# 10 — Security Model

## Identity and authorization

- **Canonical user id** is authorization subject in grants and orchestrators
- **RtcGrant** minted server-side only; TTL 60s–6h
- **Role → permissions** via `permissionsForRole()` — viewers cannot publish A/V
- MCP tools require `credentialPublicId` with scoped access

## Credential kinds

| Kind | Use |
|---|---|
| `public` | Client-safe project id (`pk_*`) |
| `server` | Backend (`sk_*`) |
| `developer` | Local dev full scope |
| `mcp` | Agent automation |

Secrets stored as `secretRef` — never returned in API/MCP responses or audit payloads.

## Audit

Control plane audit strips `secret`, `token`, `apiKey` from properties before persist.

## Provider secrets

LiveKit JWT minting stays in `@unilives/rtc-server` → `@workspace/livekit`. Firebase/Supabase service credentials remain in api-server env during migration.

## Webhook trust

Normalized webhooks require `providerEventId` for dedupe. Production should verify provider signature before normalize (legacy livekit route may differ).

## RTC-specific

- Stale accept rejected in call orchestrator
- PK scores only from authoritative gift events with idempotency
- Seat accept requires host actor (foundation; enforce in API layer pending)

## Stage A accepted externals

- Native CallKit/PushKit device QA blocked on VoIP cert
- APNs provider key absent — FCM topic healthcheck PASS

## Observability security

Trace contexts include ids only — no PII payloads in platform audit tail.

## Stage C hardening roadmap

- [ ] Enforce credential middleware on all `/v1/*` mutating routes
- [ ] Rate limit token mint
- [ ] Webhook signature verification unified in rtc-server
- [ ] Security review before public npm publish

## Evidence

`scripts/test-stage-b.mjs` → `rtc_grant_permissions`, `mcp_requires_auth`
