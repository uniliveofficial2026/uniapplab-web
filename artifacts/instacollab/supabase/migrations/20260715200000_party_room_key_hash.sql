-- Private rooms: store SHA-256 of room key so guests can verify without
-- reading the plaintext key. SELECT on party_rooms is public; hash is one-way.

alter table public.party_rooms
  add column if not exists room_key_hash text;

comment on column public.party_rooms.room_key_hash is
  'SHA-256 hex of trimmed private room key; null when Public';
