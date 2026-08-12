# Presence lifecycle audit (Phase 11)

| surface | source | identity | freshness | online | offline | cleanup | fallback | UI | risks |
|---|---|---|---|---|---|---|---|---|---|
| Platform online | postPresenceHeartbeat | auth user | ~60s TTL (API) | heartbeat | miss TTL / logout pause | timer clear on SIGNED_OUT | silent fail | friends/online lists | dual heartbeat with surfaces |
| Friends beat | liveCloudSurfaces | currentUserId | presenceBeatIntervalMs | beat with friend ids | stop surfaces | stopLiveCloudSurfaces | ignore errors | — | |
| Party room members | supabase presence | user_id | sync events | track() | untrack / leave | hub detach | empty list | audience | cosmetic resub→fixed |
| Stream viewers | platform stream API | streamId | 3s poll | join | leave | effect cleanup | 0 | live UI | stale join→fixed |
| Profile green-dot | existing status fields | user.id | product rules | — | — | — | — | Avatar | not redesigned |
