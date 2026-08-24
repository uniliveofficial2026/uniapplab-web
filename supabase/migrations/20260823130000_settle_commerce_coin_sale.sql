-- Commerce coin sales must not credit host gift-spendable balance.
-- Buyer debit → seller commerce_coin_earnings (separate ledger lane).

alter table public.wallets
  add column if not exists commerce_coin_earnings bigint not null default 0;

create or replace function public.settle_commerce_coin_sale(
  p_buyer uuid,
  p_seller uuid,
  p_amount bigint,
  p_client_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount bigint := greatest(0, coalesce(p_amount, 0));
  v_buyer_bal bigint;
  v_existing uuid;
  v_tx uuid;
begin
  if p_buyer is null or p_seller is null or v_amount <= 0 then
    raise exception 'invalid_commerce_sale';
  end if;
  if p_buyer = p_seller then
    raise exception 'buyer_seller_same';
  end if;

  if p_client_request_id is not null and length(trim(p_client_request_id)) > 0 then
    select id into v_existing
    from public.wallet_transactions
    where metadata->>'clientRequestId' = p_client_request_id
      and tx_type = 'commerce_sale'
    limit 1;
    if v_existing is not null then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'transactionId', v_existing
      );
    end if;
  end if;

  perform public.ensure_wallet(p_buyer);
  perform public.ensure_wallet(p_seller);

  select balance into v_buyer_bal from public.wallets where user_id = p_buyer for update;
  if coalesce(v_buyer_bal, 0) < v_amount then
    raise exception 'insufficient_coins';
  end if;

  update public.wallets
    set balance = balance - v_amount,
        updated_at = now()
    where user_id = p_buyer;

  update public.wallets
    set commerce_coin_earnings = coalesce(commerce_coin_earnings, 0) + v_amount,
        updated_at = now()
    where user_id = p_seller;

  insert into public.wallet_transactions (
    from_user, to_user, amount, tx_type, currency, metadata
  ) values (
    p_buyer,
    p_seller,
    v_amount,
    'commerce_sale',
    'coins',
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'clientRequestId', p_client_request_id,
      'ledger', 'commerce',
      'sellerLane', 'commerce_coin_earnings'
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

revoke all on function public.settle_commerce_coin_sale(uuid, uuid, bigint, text, jsonb) from public;
revoke all on function public.settle_commerce_coin_sale(uuid, uuid, bigint, text, jsonb) from anon, authenticated;
grant execute on function public.settle_commerce_coin_sale(uuid, uuid, bigint, text, jsonb) to service_role;
