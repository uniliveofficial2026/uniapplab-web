-- Platform-wide gift catalog — all signed-in users read; admins write.

create table if not exists public.platform_gift_catalog (
  id text primary key default 'default',
  gifts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.platform_gift_catalog (id, gifts)
values ('default', '[]'::jsonb)
on conflict (id) do nothing;

alter table public.platform_gift_catalog enable row level security;

drop policy if exists platform_gift_catalog_select_auth on public.platform_gift_catalog;
create policy platform_gift_catalog_select_auth on public.platform_gift_catalog
  for select
  using (auth.uid() is not null);

drop policy if exists platform_gift_catalog_admin_write on public.platform_gift_catalog;
create policy platform_gift_catalog_admin_write on public.platform_gift_catalog
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

alter table public.platform_gift_catalog replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.platform_gift_catalog;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
