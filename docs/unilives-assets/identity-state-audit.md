# Identity state audit (Phase 9)

Official brand: **UniLive’s**

Authoritative identity is separate from visual assets. See `phase-9-identity-adornments-report.md` §1 for the full table.

### Quick reference

| State | Authoritative API | Visual map entry |
|-------|-------------------|------------------|
| Verified | `user.isVerified` | `verification:true` → `badge.official.verified` |
| Premium/VIP | `getProfilePremiumAccessStatus` | `vip:active` → `badge.vip.default` |
| Level | `CreatorProgress.level` | `level:*` buckets → `badge.level.*` |
| Host/cohost | room seat ownership | role maps + CSS `frameStyle` |
| Status ring | live/story flags | CSS primary; `ring.standard.default` documented |

visualOnly: true on all Phase 9 identity assets and maps.
