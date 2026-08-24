# 14 — Webhook Normalization

Provider webhooks are normalized to UniLive event envelopes in `@unilives/rtc-server`.

## Function

`normalizeProviderWebhook({ provider, providerEventId, type, roomId, participantIdentity, occurredAt })`

## Type mapping (LiveKit)

| Provider type | UniLive eventType |
|---|---|
| `room_started` | `RTCRoomStarted` |
| `room_finished` | `RTCRoomEnded` |
| `participant_joined` | `RTCParticipantJoined` |
| `participant_left` | `RTCParticipantLeft` |
| `track_published` | `RTCTrackPublished` |
| `track_unpublished` | `RTCTrackUnpublished` |
| other | `RTCProvider.{type}` |

## Envelope fields

- `eventId`: `{provider}:{providerEventId}` — global dedupe key
- `lane`: `SERVER_AUTHORITATIVE`
- `eventClass`: `AUTHORITATIVE_EVENT`
- `canonicalUserId`: from `participantIdentity`
- `properties.provider`, `properties.providerEventId`

## API

`POST /v1/rtc/webhooks/normalize` — validates `providerEventId`, applies to usage meter, returns `{ event }`.

Legacy route: `artifacts/api-server/src/routes/livekit.ts` (direct LiveKit SDK) coexists during migration.

## Consumer rules

1. Never treat raw provider payload as product truth without normalization.
2. Downstream handlers must be idempotent on `eventId`.
3. Do not expose provider internal ids in public client APIs.

## Future providers

Add mapping table per provider adapter; keep normalization in rtc-server, not product routes.
