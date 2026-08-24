# 08 — Performance Matrix

Invariant: **uiUxChanged: false**

Prior: `docs/rtc-audit/PERFORMANCE-RISKS.md`, `NETWORK-QOE-CURRENT.md`, `THERMAL-BATTERY-CURRENT.md` (evidence).

| Area | Metric / concern | Baseline | Target | Status |
|---|---|---|---|---|
| LiveKit join time | TTFB / connected | — | — | UNKNOWN |
| Subscribe latency | first remote frame | — | — | UNKNOWN |
| Token mint | api-server latency | — | — | UNKNOWN |
| Gift settle | RPC p95 | — | — | UNKNOWN |
| Realtime fanout | message lag | — | — | UNKNOWN |
| Viewer count accuracy | multi-source drift | — | — | UNKNOWN |
| Media CDN | R2 / Worker TTFB | — | — | UNKNOWN |
| Bundle / SPA | load / hydration | — | — | UNKNOWN |
| Mobile thermal / battery | sustained live | — | — | UNKNOWN |
| Beauty pipeline cost | CPU/GPU | — | — | UNKNOWN |

## Stage A scope

- Inventory and evidence-backed risk notes only.
- No UI redesign or speculative optimization that changes UX.
- uiUxChanged: **false**
