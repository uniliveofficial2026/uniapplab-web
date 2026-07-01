-- Server-side wallet ledger (Phase 5)

create table if not exists public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references auth.users (id) on delete set null,
  to_user uuid references auth.users (id) on delete set null,
  amount bigint not null check (amount > 0),
  tx_type text not null check (tx_type in ('transfer', 'credit', 'debit', 'purchase', 'reward')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_from_user_idx on public.wallet_transactions (from_user, created_at desc);
create index if not exists wallet_transactions_to_user_idx on public.wallet_transactions (to_user, created_at desc);

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists wallets_select_own on public.wallets;
create policy wallets_select_own on public.wallets for select using (auth.uid() = user_id);

drop policy if exists wallet_tx_select_involved on public.wallet_transactions;
create policy wallet_tx_select_involved on public.wallet_transactions for select
  using (auth.uid() = from_user or auth.uid() = to_user);

-- No INSERT/UPDATE policies — mutations only via RPC

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
end;
$$;

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

create or replace function public.credit_coins(
  target_user uuid,
  amount bigint,
  tx_type text default 'credit',
  metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if amount is null or amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  perform public.ensure_wallet(target_user);
  update public.wallets set balance = balance + amount, updated_at = now() where user_id = target_user;
  insert into public.wallet_transactions (from_user, to_user, amount, tx_type, metadata)
  values (null, target_user, amount, tx_type, metadata);
  return jsonb_build_object('ok', true, 'balance', (select balance from public.wallets where user_id = target_user));
end;
$$;

revoke all on function public.transfer_coins(uuid, uuid, bigint) from public;
grant execute on function public.transfer_coins(uuid, uuid, bigint) to authenticated;

revoke all on function public.credit_coins(uuid, bigint, text, jsonb) from public;
grant execute on function public.credit_coins(uuid, bigint, text, jsonb) to service_role;

create or replace function public.handle_new_user_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_wallet(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_wallet on auth.users;
create trigger on_auth_user_wallet
  after insert on auth.users
  for each row execute function public.handle_new_user_wallet();
