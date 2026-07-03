-- Require direct wallet RPC callers to debit only their own wallet.
-- The API server still uses service_role after independently authenticating req.authUser.

create or replace function public.transfer_coins(
  from_user uuid,
  to_user uuid,
  amount bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_balance bigint;
begin
  if amount is null or amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if from_user is null or to_user is null or from_user = to_user then
    raise exception 'invalid transfer parties';
  end if;

  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is distinct from from_user then
    raise exception 'not authorized to transfer from wallet' using errcode = '42501';
  end if;

  perform public.ensure_wallet(from_user);
  perform public.ensure_wallet(to_user);

  select balance into sender_balance from public.wallets where user_id = from_user for update;
  if sender_balance < amount then
    raise exception 'insufficient balance';
  end if;

  update public.wallets set balance = balance - amount, updated_at = now() where user_id = from_user;
  update public.wallets set balance = balance + amount, updated_at = now() where user_id = to_user;

  insert into public.wallet_transactions (from_user, to_user, amount, tx_type)
  values (from_user, to_user, amount, 'transfer');

  return jsonb_build_object('ok', true, 'balance', (select balance from public.wallets where user_id = from_user));
end;
$$;

revoke all on function public.transfer_coins(uuid, uuid, bigint) from public;
grant execute on function public.transfer_coins(uuid, uuid, bigint) to authenticated, service_role;
