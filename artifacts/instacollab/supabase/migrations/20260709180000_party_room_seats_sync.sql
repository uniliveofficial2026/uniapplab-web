-- Cross-device party seat snapshots (who is on each sofa / stage seat).
alter table public.party_room_sync_events
  drop constraint if exists party_room_sync_events_event_type_check;

alter table public.party_room_sync_events
  add constraint party_room_sync_events_event_type_check
  check (event_type in ('gift', 'gift_play', 'pk', 'commerce', 'game', 'seats'));

notify pgrst, 'reload schema';
