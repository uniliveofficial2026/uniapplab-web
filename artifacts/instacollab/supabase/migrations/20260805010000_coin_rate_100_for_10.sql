-- Align recharge packages to 100 coins = $10.00 USD on all surfaces.
-- Flagship pack: all_coins → 100 coins for $10.00.

insert into public.recharge_packages (id, title, coins, bonus_coins, price_usd_cents, badge, sort_order, active)
values
  ('starter', 'Starter Bundle', 50, 0, 500, null, 10, true),
  ('all_coins', 'All Coins', 100, 0, 1000, 'Popular', 20, true),
  ('plus', 'Plus Pack', 250, 0, 2500, null, 30, true),
  ('pro', 'Pro Vault', 500, 0, 5000, 'Best Value', 40, true),
  ('mega', 'Mega Cache', 1000, 0, 10000, null, 50, true)
on conflict (id) do update set
  title = excluded.title,
  coins = excluded.coins,
  bonus_coins = excluded.bonus_coins,
  price_usd_cents = excluded.price_usd_cents,
  badge = excluded.badge,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- Retire old underpriced packs so clients only see the $10 / 100-coin rate.
update public.recharge_packages
set active = false
where id in ('super', 'elite', 'whale', 'pack_1', 'pack_2', 'pack_3', 'pack_4', 'pack_5', 'pack_6');
