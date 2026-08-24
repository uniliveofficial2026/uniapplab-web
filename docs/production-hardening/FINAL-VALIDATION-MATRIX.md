# FINAL-VALIDATION-MATRIX

| Gate | Status | Evidence |
|---|---|---|
| TYPECHECK | PASS | `pnpm --filter @workspace/instacollab run typecheck`; api-server typecheck |
| UNIT (gifts/wallet/scheduler/posts-reels/push/pk/…) | PASS | Multiple suites green this session |
| PRODUCTION BUILD | PASS | `pnpm --filter @workspace/instacollab run build` (~1m5s) |
| VISUAL STRUCTURAL LOCK | PASS | 22/22 |
| VISUAL PIXEL | PASS | 2/2 after soft-tolerance for dynamic routes |
| BROWSER MOUNT SMOKES | PASS_PARTIAL | Live/Messages/Marketplace/Posts/Reels/Calls/Admin-embed |
| PK LIVE INVITE E2E | CONTRACT_ONLY | No authless route |
| NATIVE CALLKIT/FGS | BLOCKED | Certs + devices |
| STAGE A ACCEPTANCE | NOT_PASSED | See FINAL-STATUS.json |
| STAGE B | NOT_STARTED | Locked |
| PRODUCTION RTC CUTOVER | NOT_PERFORMED | Policy |
| UI_UX_CHANGED | FALSE | Hard lock held |
