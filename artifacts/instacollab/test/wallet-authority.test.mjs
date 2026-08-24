import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const insta = join(dirname(fileURLToPath(import.meta.url)), '../src');

test('wallet: local ledger helper refuses cloud+API authority', () => {
  const src = readFileSync(join(insta, 'lib/walletKstarSync.ts'), 'utf8');
  assert.ok(src.includes('isLocalWalletLedgerAllowed'));
  assert.ok(src.includes('display cache only'));
  assert.ok(src.includes('Never treat local balance as the source of truth'));
  assert.ok(src.includes('if (!isLocalWalletLedgerAllowed(userId))'));
  assert.match(src, /export function addWalletCoins[\s\S]*isLocalWalletLedgerAllowed\(userId\)/);
  assert.match(src, /export function spendWalletCoins[\s\S]*isLocalWalletLedgerAllowed\(userId\)/);
});

test('wallet: OverviewTab reads server transactions for cloud users', () => {
  const src = readFileSync(join(insta, 'components/wallet/OverviewTab.tsx'), 'utf8');
  assert.ok(src.includes('fetchWallet()'));
  assert.equal(src.includes("id: 't1'"), false);
  assert.equal(src.includes('MLBB Redeemed'), false);
});

test('wallet: shop/exchange/game/crypto/greedy refuse local settlement for cloud', () => {
  const shop = readFileSync(join(insta, 'components/wallet/ShopTab.tsx'), 'utf8');
  const buy = readFileSync(join(insta, 'components/wallet/BuyExchangeTab.tsx'), 'utf8');
  const game = readFileSync(join(insta, 'components/wallet/GameCoinTab.tsx'), 'utf8');
  const crypto = readFileSync(join(insta, 'components/wallet/CryptoTab.tsx'), 'utf8');
  const greedy = readFileSync(join(insta, 'contexts/GreedySessionContext.tsx'), 'utf8');
  assert.ok(shop.includes('isLocalWalletLedgerAllowed'));
  assert.ok(buy.includes('isLocalWalletLedgerAllowed'));
  assert.ok(game.includes('isLocalWalletLedgerAllowed'));
  assert.ok(crypto.includes('isLocalWalletLedgerAllowed'));
  assert.ok(greedy.includes('isLocalWalletLedgerAllowed'));
});

test('wallet: commerce cloud settle does not fall back to local debit', () => {
  const src = readFileSync(join(insta, 'lib/commercePayments.ts'), 'utf8');
  assert.ok(src.includes("reason: 'commerce_settle_failed'"));
  assert.ok(src.includes('settleCommerceCoinSaleApi'));
  assert.equal(src.includes('Fall through to local ledger'), false);
  assert.equal(src.includes('transferCoins('), false);
});

test('wallet: GameLivePanel gates arcade coin mints on local ledger', () => {
  const src = readFileSync(join(insta, 'smule-rooms/components/GameLivePanel.tsx'), 'utf8');
  assert.ok(src.includes('isLocalWalletLedgerAllowed'));
  assert.ok(src.includes('addWalletCoins'));
  const mintBlocks = src.split('addWalletCoins(').length - 1;
  assert.ok(mintBlocks >= 1);
  assert.ok(src.includes('isLocalWalletLedgerAllowed(selfUserId)'));
});

test('wallet: party gift settle refuses local mint for cloud users', () => {
  const src = readFileSync(join(insta, 'lib/partyGiftPayments.ts'), 'utf8');
  assert.ok(src.includes("reason: 'gift_settle_failed'"));
  assert.ok(src.includes('isLocalWalletLedgerAllowed'));
  assert.equal(src.includes('/* fall through to local */'), false);
  assert.equal(src.includes('/* local fallback */'), false);
});

test('wallet: Firebase gift wallet never seeds from client local balance', () => {
  const src = readFileSync(join(insta, 'lib/firebase/giftWallet.ts'), 'utf8');
  assert.ok(src.includes('Never lift cloud balance from client-supplied'));
  assert.equal(src.includes('lift empty cloud wallet up to local'), false);
});
