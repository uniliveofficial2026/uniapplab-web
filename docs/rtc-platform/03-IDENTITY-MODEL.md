# 03 — Identity Model

UniLive distinguishes **person**, **device**, and **session** layers. RTC grants and orchestrators use **canonical user id** as product truth.

## Branded id types (`rtc-contracts`)

| Type | Meaning |
|---|---|
| `CanonicalUserId` | UniLive person identity (Supabase/Firebase mapped) |
| `DeviceId` | Push/device registry row |
| `AppSessionId` | Browser/app session |
| `RtcRoomSessionId` | Single RTC room instance |
| `RtcParticipantSessionId` | Participant within a room session |
| `RtcTrackId` | Published track handle |

## Roles and permissions

`RtcRole`: `host | cohost | guest | viewer | caller | callee`

`permissionsForRole()` in contracts defines publish/subscribe/admin flags. Server-side `createRtcGrant()` applies these — clients cannot self-grant host privileges.

## Provider identity mapping

`RtcParticipant` carries both:

- `canonicalUserId` — domain authority
- `providerIdentity` — LiveKit participant identity (today typically equals canonical id)

Webhook normalization maps `participantIdentity` → `canonicalUserId` on inbound provider events.

## Auth boundary

`@unilives/auth`:

- Supabase adapter: maps `user.id` → `canonicalUserId`
- Memory adapter: `person_{email}` for local tests

Firebase/Supabase remain in the reference app during migration; new platform code should consume `@unilives/auth` or SDK auth facade.

## Push / device (Stage A preserved)

Push device registry ties FCM/APNs tokens to person + device. Native CallKit identity uses the same canonical user id for call signaling.

## Trace correlation

`createTraceContext()` in platform-core links `traceId`, `canonicalUserId`, `roomId`, `callId`, `pkId`, `giftEventId` without storing secrets.
