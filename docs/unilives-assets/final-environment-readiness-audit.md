<!-- RECOVERY 2026-07-30: File physically present in repository. Prior PASS/fail claims are historical and must not be treated as re-verified unless the recovery verification commands succeed independently. -->

# Final environment readiness audit (Phase 12)

**Secrets redacted — names only.**

| Variable / boundary | Role | Notes |
|---------------------|------|-------|
| VITE_SUPABASE_URL / ANON_KEY | auth + data + realtime | required for cloud |
| LiveKit URL / keys (server) | A/V | livekit:check verifies client URL |
| Firebase config | optional party/auth fallback | |
| Platform API /api/* | presence, streams, tokens | same-origin |
| R2 / media hosts | media | no Phase 12 upload |
| Demo/local auth bypass | dev | must not enable in prod |

No env files written. No production values changed.
