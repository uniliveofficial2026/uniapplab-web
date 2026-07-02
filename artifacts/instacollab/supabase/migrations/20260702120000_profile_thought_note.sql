-- Avatar "thought" bubble text — synced across devices and visible to other users.

alter table public.profiles
  add column if not exists note text default '' not null,
  add column if not exists note_updated_at timestamptz;

comment on column public.profiles.note is 'Short thought shown as animated bubble on avatar';
comment on column public.profiles.note_updated_at is 'When note was last saved — drives cross-device animation replay';
