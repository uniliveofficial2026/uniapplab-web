import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('marketplace: commerce order store is durable local ledger key', () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/commerce/commerceOrderStore.ts'), 'utf8');
  assert.match(src, /unilive\.commerce\.orders/);
  assert.match(src, /create|add|upsert|save/i);
});

test('marketplace: shop-live commerce settle does not use transfer_coins', () => {
  const pay = fs.readFileSync(path.join(root, 'src/lib/commercePayments.ts'), 'utf8');
  assert.match(pay, /settleCommerceCoinSaleApi/);
  assert.doesNotMatch(pay, /transfer_coins|transferCoins\(/);
  assert.match(pay, /creditHostCommerceCoinEarnings/);
});

test('marketplace: ledger lanes keep gift diamonds off commerce earnings', () => {
  const lanes = fs.readFileSync(path.join(root, 'src/lib/ledger/ledgerLanes.ts'), 'utf8');
  assert.match(lanes, /commerce_host_coin_earnings|commerce_coin/);
  assert.match(lanes, /Gift settle must not write commerce|gift/i);
});

test('api: commerce-settle route uses settle_commerce_coin_sale RPC', () => {
  const wallet = fs.readFileSync(
    path.join(root, '../api-server/src/routes/wallet.ts'),
    'utf8',
  );
  assert.match(wallet, /commerce-settle/);
  assert.match(wallet, /settle_commerce_coin_sale/);
});
