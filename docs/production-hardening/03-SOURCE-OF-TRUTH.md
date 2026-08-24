# 03 — Source of Truth

Invariant: **uiUxChanged: false**

Prior matrix: `docs/rtc-audit/SOURCE-OF-TRUTH-MATRIX.md` (evidence; re-verify).

| Domain | Candidate primary SoT | Alternatives / mirrors | Stage A verdict | Status |
|---|---|---|---|---|
| User identity | Supabase Auth `user.id` | LiveKit identity, profiles, Firebase lane | PENDING | UNKNOWN |
| Profile | `profiles` | client cache | PENDING | UNKNOWN |
| Live room | DB stream/party rows | client memory | PENDING | UNKNOWN |
| Media participants | LiveKit roster | seat table, presence | PENDING | UNKNOWN |
| Mute / publications | LiveKit + client | UI flags | PENDING | UNKNOWN |
| Seats | DB seats + sync | LiveKit publish grants | PENDING | UNKNOWN |
| PK | DB pk sessions + lifecycle APIs | LK bus envelopes | PENDING | UNKNOWN |
| Gift money | `settle_gift_send` + wallet | Firebase giftWallet mirror | PENDING | UNKNOWN |
| Gift FX | client overlay + bus | replay | PENDING | UNKNOWN |
| Wallet | DB wallet via RPC | optimistic client | PENDING | UNKNOWN |
| Likes | none durable (LK data) | — | PENDING | UNKNOWN |
| Live comments | DB messages | Realtime | PENDING | UNKNOWN |
| DMs | chat tables | Realtime | PENDING | UNKNOWN |
| Calls | chat invites + LK room | local call machine | PENDING | UNKNOWN |
| Beauty prefs | local device | engines | PENDING | UNKNOWN |
| Media assets | R2 via uniapplab-media | local/CDN caches | PENDING | UNKNOWN |

## Rules for Stage A

1. Mark one **primary** SoT per domain after code+runtime check.
2. Document every competing write path; do not assume audit text.
3. No production schema/deploy changes in Stage A unless explicitly gated later.
