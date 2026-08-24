-- Canonical PERSON ids may be uuid or linked provider subjects; store as text.
alter table public.push_devices drop constraint if exists push_devices_person_id_fkey;
alter table public.push_devices alter column person_id type text using person_id::text;
create index if not exists push_devices_person_id_idx
  on public.push_devices (person_id)
  where person_id is not null;
