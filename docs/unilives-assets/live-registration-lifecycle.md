# Live registration lifecycle (Phase 11)

```
host start → upsert party_rooms/streams (existing)
  → discoverable status=active
  → LiveKit connect (token API)
  → presence track / viewer join
  → heartbeat/updated_at via participant_count & upserts
host leave / endPartyRoom → status=ended
  → discovery fetch filters status=active
  → LiveKit disconnect + audio detach
  → presence untrack
```

| stage | function | room ID | host ID | record | status | timestamp | cleanup | retry | failure | risk |
|---|---|---|---|---|---|---|---|---|---|---|
| create/upsert | upsertPartyRoom | room.id | owner_id | party_rooms | active | updated_at | endPartyRoom | cloud fallback | throw | schema unchanged |
| discovery | fetchActivePartyRooms | id | owner_id | rows | active | updated_at | ended filtered | empty list | soft | no client TTL filter |
| LiveKit | usePartyRoomLiveKit | roomId | token | — | connected | — | disconnect | bounded 5 | UI without A/V | fixed |
| viewer | useStreamViewerPresence | streamId | — | API | join/leave | — | leave | — | ignore | stale join fixed |
