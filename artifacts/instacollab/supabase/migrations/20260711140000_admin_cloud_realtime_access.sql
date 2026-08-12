-- Promote platform owners + allow admin SELECT for Control Center realtime.

update public.profiles
set role = 'admin', updated_at = now()
where username in ('uniliveofficial2026', 'oowai20')
  and coalesce(role, 'user') <> 'admin';

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

drop policy if exists chat_messages_select_admin on public.chat_messages;
create policy chat_messages_select_admin on public.chat_messages
  for select to authenticated
  using (public.is_platform_admin());

drop policy if exists wallets_select_admin on public.wallets;
create policy wallets_select_admin on public.wallets
  for select to authenticated
  using (public.is_platform_admin());

drop policy if exists posts_select_admin on public.posts;
create policy posts_select_admin on public.posts
  for select to authenticated
  using (public.is_platform_admin());

-- Ensure wallets participate in Realtime for Control Center
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'wallets'
  ) then
    alter publication supabase_realtime add table public.wallets;
  end if;
end $$;
