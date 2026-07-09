-- Platform-wide app logo — public read (splash/PWA before sign-in); admins write.

create table if not exists public.platform_app_brand (
  id text primary key default 'default',
  logo_url text,
  logo_media_type text not null default 'image',
  updated_at timestamptz not null default now()
);

insert into public.platform_app_brand (id, logo_url, logo_media_type)
values ('default', null, 'image')
on conflict (id) do nothing;

alter table public.platform_app_brand enable row level security;

drop policy if exists platform_app_brand_select_public on public.platform_app_brand;
create policy platform_app_brand_select_public on public.platform_app_brand
  for select
  using (true);

drop policy if exists platform_app_brand_admin_write on public.platform_app_brand;
create policy platform_app_brand_admin_write on public.platform_app_brand
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

alter table public.platform_app_brand replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.platform_app_brand;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
