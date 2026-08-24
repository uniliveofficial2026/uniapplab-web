# 09 — Security Matrix

Invariant: **uiUxChanged: false**

Prior: `docs/rtc-audit/RTC-SECURITY-RISKS.md`, `RTC-AUTHORIZATION-MAPPING.md`, `SEGMENTATION-VS-SECURITY.md` (evidence).

| Control | Surface | Expected | Status |
|---|---|---|---|
| Auth on mutating APIs | api-server | session / JWT required | UNKNOWN |
| LiveKit token grants | api-server + lib/livekit | least privilege publish/subscribe | UNKNOWN |
| Room authorization | host/guest/seat rules | server-enforced | UNKNOWN |
| Webhook signature verify | LiveKit (and others) | reject unsigned | UNKNOWN |
| RLS | Supabase tables | deny-by-default + policies | UNKNOWN |
| Admin ACL | admin-panel + lib/admin-access | role-gated | UNKNOWN |
| chat-ws auth | chat-ws | authenticated fanout only | UNKNOWN |
| Media signed URLs | uniapplab-media / R2 | short-lived, scoped | UNKNOWN |
| Secrets in repo / CI | env | no leaked keys | UNKNOWN |
| CORS / origin | API + WS | locked to app origins | UNKNOWN |
| Dual-lane identity / wallet | Firebase vs Supabase | no privilege escalation via mismatch | UNKNOWN |

## Stage A policy

- Document findings; prefer non-prod verification.
- **No production deploy** during Stage A.
- uiUxChanged: **false**
