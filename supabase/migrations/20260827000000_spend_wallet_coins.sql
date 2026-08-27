-- Authoritative coin spend for in-app purchases / redemptions (shop, game packs, etc.)

create or replace function public.spend_wallet_coins(
  p_user uuid,
  p_amount bigint,
  p_tx_type text default 'purchase',
  p_metadata jsonb default '{}'::jsonb,
  p_client_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount bigint := greatest(0, coalesce(p_amount, 0));
  v_balance bigint;
  v_existing uuid;
  v_tx uuid;
  v_type text := coalesce(nullif(trim(p_tx_type), ''), 'purchase');
begin
  if p_user is null or v_amount <= 0 then
    raise exception 'invalid_spend';
  end if;
  if v_type not in ('transfer', 'credit', 'debit', 'purchase', 'reward') then
    raise exception 'invalid_tx_type';
  end if;

  if p_client_request_id is not null and length(trim(p_client_request_id)) > 0 then
    select id into v_existing
    from public.wallet_transactions
    where metadata->>'clientRequestId' = p_client_request_id
      and from_user = p_user
    limit 1;
    if v_existing is not null then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'transactionId', v_existing
      );
    end if;
  end if;

  perform public.ensure_wallet(p_user);

  select balance into v_balance from public.wallets where user_id = p_user for update;
  if coalesce(v_balance, 0) < v_amount then
    raise exception 'insufficient_coins';
  end if;

  update public.wallets
    set balance = balance - v_amount,
        updated_at = now()
    where user_id = p_user;

  insert into public.wallet_transactions (
    from_user, to_user, amount, tx_type, metadata
  ) values (
    p_user,
    null,
    v_amount,
    v_type,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'clientRequestId', p_client_request_id,
      'ledger', 'gift',
      'direction', 'spend'
    )
  )
  returning id into v_tx;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'transactionId', v_tx,
    'amount', v_amount
  );
end;
$$;

revoke all on function public.spend_wallet_coins(uuid, bigint, text, jsonb, text) from public;
revoke all on function public.spend_wallet_coins(uuid, bigint, text, jsonb, text) from anon, authenticated;
grant execute on function public.spend_wallet_coins(uuid, bigint, text, jsonb, text) to service_role;
