# Platform Overview

UniLive Platform is a provider-neutral control plane for building live social apps. Stage B packages live under `lib/unilives-*` with a unified `/v1/*` API and reference app facade.

## Architecture at a glance

```
Developers / Agents
    ├── @unilives/cli (local dev)
    ├── @unilives/mcp (agent tools)
    └── @unilives/sdk (app integration)
              │
    ┌─────────▼─────────┐
    │  platform-core     │  orgs, projects, envs, providers, audit
    └─────────┬─────────┘
              │
    ┌─────────▼──────────────────────────────────┐
    │  Capability adapters                      │
    │  rtc · auth · database · storage · realtime │
    │  deploy · git · functions                   │
    └────────────────────────────────────────────┘
```

## Core packages

| Package | Purpose |
|---|---|
| `@unilives/platform-core` | Control plane store, provider registry, usage meter, project graph |
| `@unilives/sdk` | `createUniLive()` unified entry |
| `@unilives/mcp` | Authorized MCP tool surface |
| `@unilives/cli` | `unilive init`, `doctor`, `rtc status` |
| `@unilives/rtc-*` | RTC domain (see `docs/rtc-platform/`) |

## API

Express router: `artifacts/api-server/src/routes/uniliveV1.ts`

Base path: `/v1/*` — health, projects, RTC, storage, deployments, logs, metrics, providers.

## Reference application

`artifacts/instacollab` — production UI unchanged in Stage B. RTC entry migrates through `src/lib/unilive-rtc/`.

## Design principles

1. **Canonical identity** — UniLive ids are product truth; provider ids are mappings.
2. **Secret references** — control plane stores `secretRef`, never raw keys in audit.
3. **Provider swappability** — registry resolves active adapter per capability kind.
4. **Same contracts everywhere** — API, SDK, MCP, CLI share orchestrators and types.
5. **No UI redesign in Stage B** — platform work is backend/facade only.

## Status

Foundation **IMPLEMENTED**; persistence adapters and full reference app RTC migration **IN PROGRESS**.
