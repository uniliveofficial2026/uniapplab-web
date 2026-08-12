# LiveKit attachment audit (Phase 11)

| file | owner | room ID | identity | listeners | media | cleanup | reconnect | dup instance | stale track | safe? |
|---|---|---|---|---|---|---|---|---|---|---|
| usePartyRoomLiveKit | hook | prop | token | TrackSubscribed/Unsubscribed via helper | audio elements | detach+disconnect | max 5 backoff | cancelled guard | fixed | yes |
| useMultiGuestLiveKit | hook | prop | participant.identity | video map + audio attach | camera/mic | disconnect | none | cancelled | audio detach fixed | yes |
| useGameLiveKit | hook | prop | hostUserId | track sync + remote audio | screen/camera | off+disconnect | max 5 | cancelled | fixed | yes |
| liveRoomBus | module | roomId | senderId | DataReceived | data | unregister | — | WeakSet bind once | roomId check | yes |
| liveKitConnection | host helper | streamId | host | publish tracks | camera | disconnectLiveKit | — | — | — | yes |
