-- Security hardening: wallet RPC server-only, party message guard.

-- Wallet transfers must go through API (service role) — not direct client RPC.
revoke execute on function public.transfer_coins(uuid, uuid, bigint) from authenticated;
revoke execute on function public.transfer_coins(uuid, uuid, bigint) from anon;
grant execute on function public.transfer_coins(uuid, uuid, bigint) to service_role;

-- Party messages: cap body length.
alter table public.party_room_messages
  drop constraint if exists party_room_messages_body_len;

alter table public.party_room_messages
  add constraint party_room_messages_body_len
  check (char_length(body) <= 4000);

-- Tighten party message insert — room must be active.
drop policy if exists party_room_messages_insert_auth on public.party_room_messages;
create policy party_room_messages_insert_auth on public.party_room_messages
  for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.party_rooms pr
      where pr.id = room_id and pr.status = 'active'
    )
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.banned_at is not null
    )
  );

notify pgrst, 'reload schema';
