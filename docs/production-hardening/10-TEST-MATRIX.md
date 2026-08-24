# 10 — Test Matrix

Invariant: **uiUxChanged: false**

| Suite / check | Package | Command / method | Result | Status |
|---|---|---|---|---|
| Typecheck api-server | artifacts/api-server | package typecheck | PASS — DevAgentChatResult grounded fields | IN_PROGRESS |
| Typecheck instacollab | artifacts/instacollab | — | — | NOT STARTED |
| Typecheck chat-ws | artifacts/chat-ws | — | — | NOT STARTED |
| Typecheck admin-panel | artifacts/admin-panel | — | — | NOT STARTED |
| Unit / integration (API) | api-server | — | — | NOT STARTED |
| LiveKit token / room smoke | lib/livekit + api | CLI not found — alternate verify | — | NOT STARTED |
| Realtime subscribe smoke | instacollab / SB | — | — | NOT STARTED |
| Gift settle idempotency | api + DB | — | — | NOT STARTED |
| Identity projection checks | auth ↔ LK | — | — | NOT STARTED |
| Worker media smoke | workers/uniapplab-media | wrangler not in PATH | — | NOT STARTED |
| UI visual regression | instacollab | `pnpm test:visual-pixel` + structural `test:visual-lock` | PASS — 4 route pixel baselines + 22 structural locks (2026-08-23T09:32Z) | DONE |

## Notes

- Dirty tree (~602 porcelain) is pre-existing; do not attribute failures to Stage A docs work.
- Prior coverage notes: `docs/rtc-audit/RTC-TEST-COVERAGE.md` (evidence).

| test:gifts | PASS | 2026-08-23T07:16:38Z |
| test:wallet | PASS | 2026-08-23T07:16:38Z |
| livekit-auth | PASS | 2026-08-23T07:16:38Z |
