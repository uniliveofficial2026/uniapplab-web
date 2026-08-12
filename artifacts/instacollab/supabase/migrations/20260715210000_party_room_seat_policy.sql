-- Seat join policy: free sit vs request approval, plus who may sit.
-- Independent from room privacy / whoCanJoin.

alter table public.party_rooms
  add column if not exists seat_join_mode text not null default 'free';

alter table public.party_rooms
  add column if not exists who_can_be_seated text not null default 'Anyone';

comment on column public.party_rooms.seat_join_mode is
  'free | approval — how guests claim empty seats';

comment on column public.party_rooms.who_can_be_seated is
  'Anyone | Followers | Elite Only — eligibility to sit';
