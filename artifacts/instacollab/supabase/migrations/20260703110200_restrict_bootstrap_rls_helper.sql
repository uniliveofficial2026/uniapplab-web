-- bootstrap_sync_rls_policy rewrites RLS policies and must not be callable by
-- anon/authenticated Supabase API clients.

do $$
begin
  if to_regprocedure('public.bootstrap_sync_rls_policy(regclass,text,text,text,text)') is not null then
    execute 'revoke all on function public.bootstrap_sync_rls_policy(regclass, text, text, text, text) from public';
    execute 'grant execute on function public.bootstrap_sync_rls_policy(regclass, text, text, text, text) to service_role';
  end if;
end $$;
