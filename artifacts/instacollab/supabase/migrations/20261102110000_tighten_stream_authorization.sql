-- Tighten stream creation and signaling authorization for existing projects.

drop policy if exists streams_insert_own on public.streams;
create policy streams_insert_own on public.streams for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('streamer', 'admin')
    )
  );

drop policy if exists stream_signals_select_involved on public.stream_signals;
create policy stream_signals_select_involved on public.stream_signals for select
  using (
    from_user = auth.uid()
    or to_user = auth.uid()
    or exists (
      select 1 from public.streams s
      where s.id = stream_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists stream_signals_insert_own on public.stream_signals;
create policy stream_signals_insert_own on public.stream_signals for insert
  with check (
    from_user = auth.uid()
    and exists (
      select 1 from public.streams s
      where s.id = stream_id
        and s.status = 'live'
        and s.user_id = auth.uid()
    )
  );
