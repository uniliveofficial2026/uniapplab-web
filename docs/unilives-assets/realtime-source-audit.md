# Realtime source audit (Phase 11)

| file | service | domain | source | type | key | identity | room | create | cleanup | reconnect | dup risk | stale risk | safe? | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| presenceHeartbeat.ts | installPresenceHeartbeat | user online | platform API | interval 60s | auth session | user | — | boot | SIGNED_OUT pause | resume on SIGNED_IN | low | medium→fixed | yes | |
| liveCloudSurfaces.ts | beatPresence | friends online | platform API | interval | activeUserId | user | — | startLiveCloud | stopLiveCloud | restart surfaces | low | low | yes | |
| liveCloudSurfaces.ts | chat/notif/posts… | social | supabase RT | channels | userId | user | — | start | stop | start again | guarded | low | yes | |
| useCloudLiveDiscovery | discovery | live/party | poll+postgres | channel+timer | live-discovery-feed | viewer | — | tab active | unsub | refresh | medium | medium | yes | removeChannelsContaining |
| useCloudPartyRooms | party lobby | party | fetch+RT/FS | channel/snapshot | party rooms | viewer | — | tab active | unsub | refresh | low | medium | yes | status=active |
| partyRoomPresence.ts | hub | room viewers | supabase presence | channel | party-room-presence:roomId | user_id | roomId | first sub | last unsub | re-ensure hub | low (hub) | low | yes | |
| usePartyRoomLiveKit | A/V | party voice | LiveKit | room | roomId | token identity | roomId | enabled | disconnect | bounded retry | medium→fixed | audio leak→fixed | yes | |
| useMultiGuestLiveKit | A/V | multi video | LiveKit | room | roomId | identity | roomId | active | disconnect | none | low | audio detach→fixed | yes | |
| useGameLiveKit | A/V | game cast | LiveKit | room | roomId | hostUserId | roomId | enabled | disconnect | bounded retry | medium→fixed | fixed | yes | |
| useStreamViewerPresence | viewers | stream | platform API | poll+join | streamId | — | streamId | watching | leave | — | low | stale join→fixed | yes | |
| adminCloudData.ts | admin | many tables | postgres | channel | ADMIN_RT | — | — | admin UI | unsub | — | unique topic | — | yes | |
| cloudChatSync.ts | chat | messages | supabase | channel | user | user | thread | start | stop | — | guarded | — | chat safety only | |
