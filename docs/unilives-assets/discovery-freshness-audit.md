# Discovery freshness audit (Phase 11)

**Enter discovery:** `status=active` party_rooms and/or live streams APIs + profile live flags; privacy normalized; blocked/private filtered by existing fetch helpers.

**Leave discovery:** `endPartyRoom` → `status=ended`; ended rows excluded from `fetchActivePartyRooms`; realtime scheduleRefresh on party_rooms/streams changes.

**Stale:** Client relies on `status` + `updated_at` ordering. No additional client-side heartbeat age cutoff added (deferred-backend).

**Demo vs production:** Local `db.users` live status merged in LiveScreen separately from cloud streams.
