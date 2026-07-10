-- Phase 1 gift economy: multi-currency wallets, gift ledger, catalog rows,
-- recharge packages, spend limits, room ranking aggregates.

-- ---------------------------------------------------------------------------
-- Multi-currency wallet balances (coins = existing balance column)
-- ---------------------------------------------------------------------------
alter table public.wallets
  add column if not exists diamonds bigint not null default 0 check (diamonds >= 0),
  add column if not exists reward_points bigint not null default 0 check (reward_points >= 0),
  add column if not exists bonus_coins bigint not null default 0 check (bonus_coins >= 0),
  add column if not exists promo_credits bigint not null default 0 check (promo_credits >= 0),
  add column if not exists vip_tokens bigint not null default 0 check (vip_tokens >= 0);

alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_tx_type_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_tx_type_check
  check (tx_type in (
    'transfer', 'credit', 'debit', 'purchase', 'reward',
    'gift_spend', 'gift_earn', 'recharge', 'refund', 'withdraw', 'bonus', 'promo'
  ));

alter table public.wallet_transactions
  add column if not exists currency text not null default 'coins'
    check (currency in ('coins', 'diamonds', 'reward_points', 'bonus_coins', 'promo_credits', 'vip_tokens')),
  add column if not exists idempotency_key text;

create unique index if not exists wallet_transactions_idempotency_uidx
  on public.wallet_transactions (idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- Spend limits (fraud / daily-monthly caps)
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_spend_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_coin_limit bigint not null default 500000 check (daily_coin_limit >= 0),
  monthly_coin_limit bigint not null default 5000000 check (monthly_coin_limit >= 0),
  daily_spent bigint not null default 0 check (daily_spent >= 0),
  monthly_spent bigint not null default 0 check (monthly_spent >= 0),
  day_key date not null default (timezone('utc', now()))::date,
  month_key text not null default to_char(timezone('utc', now()), 'YYYY-MM'),
  updated_at timestamptz not null default now()
);

alter table public.wallet_spend_limits enable row level security;

drop policy if exists wallet_spend_limits_select_own on public.wallet_spend_limits;
create policy wallet_spend_limits_select_own on public.wallet_spend_limits
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Recharge packages
-- ---------------------------------------------------------------------------
create table if not exists public.recharge_packages (
  id text primary key,
  title text not null,
  coins bigint not null check (coins > 0),
  bonus_coins bigint not null default 0 check (bonus_coins >= 0),
  price_usd_cents integer not null check (price_usd_cents > 0),
  badge text,
  providers text[] not null default array['stripe']::text[],
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recharge_packages enable row level security;

drop policy if exists recharge_packages_select_all on public.recharge_packages;
create policy recharge_packages_select_all on public.recharge_packages
  for select using (true);

insert into public.recharge_packages (id, title, coins, bonus_coins, price_usd_cents, badge, sort_order)
values
  ('starter', 'Starter Bundle', 500, 0, 499, 'Popular', 10),
  ('super', 'Super Pack', 1000, 200, 999, 'Bonus +20%', 20),
  ('elite', 'Elite Vault', 2500, 500, 2499, 'Best Value', 30),
  ('whale', 'Whale Cache', 5000, 1500, 4999, 'Super Saver', 40)
on conflict (id) do nothing;

create table if not exists public.recharge_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  package_id text not null references public.recharge_packages (id),
  provider text not null default 'stripe',
  provider_ref text,
  coins bigint not null check (coins > 0),
  bonus_coins bigint not null default 0,
  price_usd_cents integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'credited', 'failed', 'refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists recharge_orders_provider_ref_uidx
  on public.recharge_orders (provider, provider_ref)
  where provider_ref is not null;

create index if not exists recharge_orders_user_idx
  on public.recharge_orders (user_id, created_at desc);

alter table public.recharge_orders enable row level security;

drop policy if exists recharge_orders_select_own on public.recharge_orders;
create policy recharge_orders_select_own on public.recharge_orders
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Normalized gift catalog (admin jsonb catalog remains for studio publish)
-- ---------------------------------------------------------------------------
create table if not exists public.gift_catalog_items (
  id text primary key,
  name text not null,
  description text not null default '',
  price bigint not null check (price > 0),
  currency text not null default 'coins'
    check (currency in ('coins', 'diamonds', 'bonus_coins', 'promo_credits', 'vip_tokens')),
  category text not null default 'standard',
  tier text not null default 'normal',
  rarity text not null default 'common',
  animation_url text,
  preview_url text,
  sound_url text,
  icon text not null default '🎁',
  effect_svga_url text,
  effect_video_url text,
  combo_enabled boolean not null default true,
  vip_only boolean not null default false,
  seasonal boolean not null default false,
  lucky boolean not null default false,
  blind_box boolean not null default false,
  pk_enabled boolean not null default true,
  available_from timestamptz,
  available_until timestamptz,
  status text not null default 'published'
    check (status in ('draft', 'published', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists gift_catalog_items_status_idx
  on public.gift_catalog_items (status, sort_order, price);

alter table public.gift_catalog_items enable row level security;

drop policy if exists gift_catalog_items_select_published on public.gift_catalog_items;
create policy gift_catalog_items_select_published on public.gift_catalog_items
  for select using (
    status = 'published'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists gift_catalog_items_admin_write on public.gift_catalog_items;
create policy gift_catalog_items_admin_write on public.gift_catalog_items
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

-- ---------------------------------------------------------------------------
-- Gift transactions (authoritative send ledger)
-- ---------------------------------------------------------------------------
create table if not exists public.gift_transactions (
  id uuid primary key default gen_random_uuid(),
  client_request_id text,
  gift_id text not null,
  gift_name text not null default '',
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  room_id text,
  quantity integer not null default 1 check (quantity > 0),
  combo integer not null default 1 check (combo > 0),
  unit_price bigint not null check (unit_price > 0),
  total_coins bigint not null check (total_coins > 0),
  diamonds_awarded bigint not null default 0 check (diamonds_awarded >= 0),
  currency text not null default 'coins',
  tier text not null default 'normal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists gift_transactions_client_request_uidx
  on public.gift_transactions (sender_id, client_request_id)
  where client_request_id is not null;

create index if not exists gift_transactions_room_idx
  on public.gift_transactions (room_id, created_at desc);

create index if not exists gift_transactions_sender_idx
  on public.gift_transactions (sender_id, created_at desc);

create index if not exists gift_transactions_receiver_idx
  on public.gift_transactions (receiver_id, created_at desc);

alter table public.gift_transactions enable row level security;

drop policy if exists gift_transactions_select_involved on public.gift_transactions;
create policy gift_transactions_select_involved on public.gift_transactions
  for select using (
    auth.uid() = sender_id
    or auth.uid() = receiver_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Room gift ranking aggregates
-- ---------------------------------------------------------------------------
create table if not exists public.gift_room_stats (
  room_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('sender', 'receiver')),
  day_key date not null default (timezone('utc', now()))::date,
  coins_total bigint not null default 0,
  gifts_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id, role, day_key)
);

create index if not exists gift_room_stats_room_day_idx
  on public.gift_room_stats (room_id, day_key, role, coins_total desc);

alter table public.gift_room_stats enable row level security;

drop policy if exists gift_room_stats_select_auth on public.gift_room_stats;
create policy gift_room_stats_select_auth on public.gift_room_stats
  for select using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- Ensure wallet creates all currency columns
-- ---------------------------------------------------------------------------
create or replace function public.ensure_wallet(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  insert into public.wallet_spend_limits (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Credit any currency (service role)
-- ---------------------------------------------------------------------------
create or replace function public.credit_wallet_currency(
  target_user uuid,
  amount bigint,
  p_currency text default 'coins',
  tx_type text default 'credit',
  metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bal bigint;
begin
  if amount is null or amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_idempotency_key is not null then
    if exists (
      select 1 from public.wallet_transactions where idempotency_key = p_idempotency_key
    ) then
      return jsonb_build_object('ok', true, 'duplicate', true);
    end if;
  end if;

  perform public.ensure_wallet(target_user);

  if p_currency = 'coins' then
    update public.wallets set balance = balance + amount, updated_at = now() where user_id = target_user
    returning balance into bal;
  elsif p_currency = 'diamonds' then
    update public.wallets set diamonds = diamonds + amount, updated_at = now() where user_id = target_user
    returning diamonds into bal;
  elsif p_currency = 'reward_points' then
    update public.wallets set reward_points = reward_points + amount, updated_at = now() where user_id = target_user
    returning reward_points into bal;
  elsif p_currency = 'bonus_coins' then
    update public.wallets set bonus_coins = bonus_coins + amount, updated_at = now() where user_id = target_user
    returning bonus_coins into bal;
  elsif p_currency = 'promo_credits' then
    update public.wallets set promo_credits = promo_credits + amount, updated_at = now() where user_id = target_user
    returning promo_credits into bal;
  elsif p_currency = 'vip_tokens' then
    update public.wallets set vip_tokens = vip_tokens + amount, updated_at = now() where user_id = target_user
    returning vip_tokens into bal;
  else
    raise exception 'unsupported currency';
  end if;

  insert into public.wallet_transactions (from_user, to_user, amount, tx_type, currency, metadata, idempotency_key)
  values (null, target_user, amount, tx_type, p_currency, metadata, p_idempotency_key);

  return jsonb_build_object('ok', true, 'currency', p_currency, 'balance', bal);
end;
$$;

revoke all on function public.credit_wallet_currency(uuid, bigint, text, text, jsonb, text) from public;
grant execute on function public.credit_wallet_currency(uuid, bigint, text, text, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic gift settle: debit coins (bonus first), credit diamonds, ledger + stats
-- ---------------------------------------------------------------------------
create or replace function public.settle_gift_send(
  p_sender uuid,
  p_receiver uuid,
  p_gift_id text,
  p_gift_name text,
  p_unit_price bigint,
  p_quantity integer default 1,
  p_combo integer default 1,
  p_room_id text default null,
  p_tier text default 'normal',
  p_client_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  qty integer;
  combo_n integer;
  total bigint;
  bonus_use bigint;
  coin_use bigint;
  sender_row public.wallets%rowtype;
  diamonds_out bigint;
  day_k date := (timezone('utc', now()))::date;
  month_k text := to_char(timezone('utc', now()), 'YYYY-MM');
  limits_row public.wallet_spend_limits%rowtype;
  gift_tx_id uuid;
  existing_id uuid;
begin
  qty := greatest(1, coalesce(p_quantity, 1));
  combo_n := greatest(1, coalesce(p_combo, 1));
  if p_unit_price is null or p_unit_price <= 0 then
    raise exception 'unit price must be positive';
  end if;
  if p_sender is null or p_receiver is null or p_sender = p_receiver then
    raise exception 'invalid gift parties';
  end if;
  if p_gift_id is null or length(trim(p_gift_id)) = 0 then
    raise exception 'gift id required';
  end if;

  total := p_unit_price * qty;
  diamonds_out := total; -- Phase 1: 1 coin spent => 1 diamond to receiver

  if p_client_request_id is not null then
    select id into existing_id
    from public.gift_transactions
    where sender_id = p_sender and client_request_id = p_client_request_id
    limit 1;
    if existing_id is not null then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'giftTransactionId', existing_id,
        'totalCoins', total,
        'diamondsAwarded', diamonds_out
      );
    end if;
  end if;

  perform public.ensure_wallet(p_sender);
  perform public.ensure_wallet(p_receiver);

  -- Roll spend-limit windows
  insert into public.wallet_spend_limits (user_id) values (p_sender)
  on conflict (user_id) do nothing;

  select * into limits_row from public.wallet_spend_limits where user_id = p_sender for update;
  if limits_row.day_key <> day_k then
    update public.wallet_spend_limits
      set day_key = day_k, daily_spent = 0, updated_at = now()
      where user_id = p_sender;
    limits_row.daily_spent := 0;
  end if;
  if limits_row.month_key <> month_k then
    update public.wallet_spend_limits
      set month_key = month_k, monthly_spent = 0, updated_at = now()
      where user_id = p_sender;
    limits_row.monthly_spent := 0;
  end if;

  if limits_row.daily_spent + total > limits_row.daily_coin_limit then
    raise exception 'daily gift spend limit exceeded';
  end if;
  if limits_row.monthly_spent + total > limits_row.monthly_coin_limit then
    raise exception 'monthly gift spend limit exceeded';
  end if;

  select * into sender_row from public.wallets where user_id = p_sender for update;
  if (sender_row.bonus_coins + sender_row.balance) < total then
    raise exception 'insufficient balance';
  end if;

  bonus_use := least(sender_row.bonus_coins, total);
  coin_use := total - bonus_use;

  update public.wallets
    set bonus_coins = bonus_coins - bonus_use,
        balance = balance - coin_use,
        updated_at = now()
    where user_id = p_sender;

  update public.wallets
    set diamonds = diamonds + diamonds_out,
        updated_at = now()
    where user_id = p_receiver;

  update public.wallet_spend_limits
    set daily_spent = daily_spent + total,
        monthly_spent = monthly_spent + total,
        updated_at = now()
    where user_id = p_sender;

  insert into public.wallet_transactions (from_user, to_user, amount, tx_type, currency, metadata, idempotency_key)
  values (
    p_sender, p_receiver, total, 'gift_spend', 'coins',
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'giftId', p_gift_id, 'quantity', qty, 'combo', combo_n, 'roomId', p_room_id,
      'bonusUsed', bonus_use, 'coinsUsed', coin_use
    ),
    case when p_client_request_id is null then null else 'gift_spend:' || p_sender::text || ':' || p_client_request_id end
  );

  insert into public.wallet_transactions (from_user, to_user, amount, tx_type, currency, metadata)
  values (
    p_sender, p_receiver, diamonds_out, 'gift_earn', 'diamonds',
    jsonb_build_object('giftId', p_gift_id, 'roomId', p_room_id, 'quantity', qty)
  );

  insert into public.gift_transactions (
    client_request_id, gift_id, gift_name, sender_id, receiver_id, room_id,
    quantity, combo, unit_price, total_coins, diamonds_awarded, currency, tier, metadata
  ) values (
    p_client_request_id, p_gift_id, coalesce(p_gift_name, p_gift_id), p_sender, p_receiver, p_room_id,
    qty, combo_n, p_unit_price, total, diamonds_out, 'coins', coalesce(p_tier, 'normal'),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into gift_tx_id;

  if p_room_id is not null and length(trim(p_room_id)) > 0 then
    insert into public.gift_room_stats (room_id, user_id, role, day_key, coins_total, gifts_count)
    values (p_room_id, p_sender, 'sender', day_k, total, qty)
    on conflict (room_id, user_id, role, day_key) do update
      set coins_total = public.gift_room_stats.coins_total + excluded.coins_total,
          gifts_count = public.gift_room_stats.gifts_count + excluded.gifts_count,
          updated_at = now();

    insert into public.gift_room_stats (room_id, user_id, role, day_key, coins_total, gifts_count)
    values (p_room_id, p_receiver, 'receiver', day_k, total, qty)
    on conflict (room_id, user_id, role, day_key) do update
      set coins_total = public.gift_room_stats.coins_total + excluded.coins_total,
          gifts_count = public.gift_room_stats.gifts_count + excluded.gifts_count,
          updated_at = now();
  end if;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'giftTransactionId', gift_tx_id,
    'giftId', p_gift_id,
    'senderId', p_sender,
    'receiverId', p_receiver,
    'roomId', p_room_id,
    'quantity', qty,
    'combo', combo_n,
    'totalCoins', total,
    'diamondsAwarded', diamonds_out,
    'tier', coalesce(p_tier, 'normal'),
    'timestamp', extract(epoch from now())::bigint,
    'balances', jsonb_build_object(
      'senderCoins', (select balance from public.wallets where user_id = p_sender),
      'senderBonusCoins', (select bonus_coins from public.wallets where user_id = p_sender),
      'receiverDiamonds', (select diamonds from public.wallets where user_id = p_receiver)
    )
  );
end;
$$;

revoke all on function public.settle_gift_send(
  uuid, uuid, text, text, bigint, integer, integer, text, text, text, jsonb
) from public;
grant execute on function public.settle_gift_send(
  uuid, uuid, text, text, bigint, integer, integer, text, text, text, jsonb
) to service_role;

-- Credit recharge (idempotent by order id)
create or replace function public.credit_recharge_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.recharge_orders%rowtype;
  result jsonb;
begin
  select * into ord from public.recharge_orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;
  if ord.status = 'credited' then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  if ord.status not in ('pending', 'paid') then
    raise exception 'order not payable';
  end if;

  result := public.credit_wallet_currency(
    ord.user_id, ord.coins, 'coins', 'recharge',
    jsonb_build_object('orderId', ord.id, 'packageId', ord.package_id),
    'recharge:' || ord.id::text
  );

  if ord.bonus_coins > 0 then
    perform public.credit_wallet_currency(
      ord.user_id, ord.bonus_coins, 'bonus_coins', 'bonus',
      jsonb_build_object('orderId', ord.id, 'packageId', ord.package_id),
      'recharge_bonus:' || ord.id::text
    );
  end if;

  update public.recharge_orders
    set status = 'credited', updated_at = now()
    where id = p_order_id;

  return jsonb_build_object('ok', true, 'orderId', p_order_id, 'credit', result);
end;
$$;

revoke all on function public.credit_recharge_order(uuid) from public;
grant execute on function public.credit_recharge_order(uuid) to service_role;

notify pgrst, 'reload schema';
