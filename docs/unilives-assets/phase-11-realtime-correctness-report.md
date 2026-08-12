# UniLive’s Phase 11 — Realtime correctness report

Generated: 2026-07-23  
Status: **complete — awaiting human approval**  
Official brand spelling: **UniLive’s**

Correctness and lifecycle only. No UI redesign, schema, payload, route, auth, wallet, gift, or moderation changes. No deploy/push.

---

## Existing realtime flow summary

1. **App presence:** `installPresenceHeartbeat` (60s platform API) + `liveCloudSurfaces.beatPresence` (friends heartbeat while cloud surfaces active).
2. **Cloud surfaces:** `startLiveCloudSurfaces` owns chat/notifications/posts/blocks/visits/wallet/gift-catalog/brand realtime + timers; stopped on logout via `sessionManager`.
3. **Live discovery:** `useCloudLiveDiscovery` — poll + `party_rooms`/`streams` postgres_changes; gated by keep-alive tab + enabled flag.
4. **Party lobby:** `useCloudPartyRooms` — fetch active + surface refresh + optional Firebase snapshot / Supabase channel.
5. **Party presence:** hub in `partyRoomPresence.ts` — one channel per room, multi-listener.
6. **LiveKit:** `usePartyRoomLiveKit`, `useMultiGuestLiveKit`, `useGameLiveKit`, host `connectLiveKitHost`; data bus via `liveRoomBus`.
7. **Viewer counts:** stream API join/leave + poll (`useStreamViewerPresence`); party `participant_count` from presence hub; discovery cards merge counts.
8. **Room type / PK:** `liveRing.ts` maps authoritative `room_mode` / `liveKind` — not title text. Team PK unsupported.

## Ownership boundaries

| Domain | Owner | Start | Stop |
|---|---|---|---|
| Platform presence heartbeat | `presenceHeartbeat.ts` | app boot | SIGNED_OUT clears timer; auth listener retained |
| Friend presence + inbox | `liveCloudSurfaces` | session start | logout / user switch |
| Live discovery feed | `useCloudLiveDiscovery` | enabled && tabActive | cleanup unsub + timer |
| Party presence hub | `partyRoomPresence.ts` | first subscribe | last unsubscribe |
| Party LiveKit | `usePartyRoomLiveKit` | enabled+roomId | disconnect + audio detach |
| Multi-guest LiveKit | `useMultiGuestLiveKit` | active+roomId | disconnect |
| Game LiveKit | `useGameLiveKit` | enabled+roomId | disconnect + listener off |

## Fixes made (classify)

| Fix | Class |
|---|---|
| LiveKit remote audio detach on unsub/cleanup (party/game) | fixed-cleanup / fixed-binding |
| Multi-guest audio detach on TrackUnsubscribed | fixed-cleanup |
| Bounded LiveKit reconnect (max 5, exponential backoff) party+game | fixed-client-lifecycle |
| Presence heartbeat pauses on SIGNED_OUT | fixed-cleanup |
| Party presence no longer resubscribes on name/avatar cosmetics | fixed-deduplication / fixed-binding |
| Stream viewer stale join rollback after unmount | fixed-registration |
| Dev-only `realtimeLifecycleDebug` | observability |

## Deferred

| Issue | Class |
|---|---|
| Client-side stale-room age filter beyond `status=active` | deferred-backend (needs authoritative heartbeat TTL policy) |
| Dual presence systems (platform 60s + surfaces friends beat) | verified-correct / deferred-product-rule (both intentional) |
| Team PK | not-in-phase / unsupported |
| Chat product redesign | not-in-phase |
| Discovery channel share across Live+Karaoke if both active | verified-correct when Karaoke gates `activeTab==='party'` + keep-alive |

## Proof schemas/payloads preserved

No migrations, no RPC renames, no LiveKit token API changes, no presence API payload changes, no party_rooms column changes.

## Rollback

Revert Phase 11 files under `livekit/liveKitRemoteAudio.ts`, `realtime/realtimeLifecycleDebug.ts`, hooks listed in “Files modified”, and this docs folder; rebuild locally.

**STOP** — awaiting human approval.
