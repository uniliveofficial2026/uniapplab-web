#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appSrc = path.join(root, 'artifacts/instacollab/src');

const files = [
  'components/wallet/WalletScreen.tsx',
  'components/wallet/BuyExchangeTab.tsx',
  'components/wallet/WithdrawTab.tsx',
  'components/wallet/CryptoTab.tsx',
  'components/wallet/GameCoinTab.tsx',
  'components/wallet/ShopTab.tsx',
];

let inputFiles = 0;
let ssotFiles = 0;
for (const rel of files) {
  const full = path.join(appSrc, rel);
  assert.ok(fs.existsSync(full), `missing ${rel}`);
  const src = fs.readFileSync(full, 'utf8');
  if (!/\<(input|textarea)\b/.test(src)) continue;
  inputFiles += 1;
  if (
    /keyboardInputClassName|KeyboardAwareForm|walletFieldInputClassName|walletAmountInputClassName|data-keyboard-ssot|pb-composer/.test(
      src,
    )
  ) {
    ssotFiles += 1;
  }
}

assert.ok(inputFiles >= 5, `expected wallet input files, got ${inputFiles}`);
assert.equal(ssotFiles, inputFiles, `wallet keyboard SSOT ${ssotFiles}/${inputFiles}`);

const walletScreen = fs.readFileSync(path.join(appSrc, 'components/wallet/WalletScreen.tsx'), 'utf8');
assert.ok(!walletScreen.includes('app-screen-scroll'), 'wallet must not nest scroll — shell main owns scroll');
assert.match(walletScreen, /data-testid="wallet-screen"/);

console.log(`wallet-keyboard: ${ssotFiles}/${inputFiles} wallet input files with SSOT`);
console.log('wallet-keyboard static gate PASS');
