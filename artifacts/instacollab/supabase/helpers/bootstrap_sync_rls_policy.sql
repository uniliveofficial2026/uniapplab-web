-- Idempotent RLS policy helper (included in bootstrap.sql; safe to re-run).
create or replace function public.bootstrap_sync_rls_policy(
  p_table regclass,
  p_name text,
  p_cmd text,
  p_using text default null,
  p_with_check text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stmt text;
begin
  execute format('drop policy if exists %I on %s', p_name, p_table);

  stmt := format('create policy %I on %s for %s', p_name, p_table, lower(p_cmd));

  if lower(p_cmd) in ('select', 'update', 'delete', 'all') and p_using is not null then
    stmt := stmt || format(' using (%s)', p_using);
  end if;

  if p_with_check is not null then
    stmt := stmt || format(' with check (%s)', p_with_check);
  end if;

  execute stmt;
exception
  when duplicate_object then
    execute format('drop policy if exists %I on %s', p_name, p_table);
    execute stmt;
end;
$$;
