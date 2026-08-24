import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTheme,
  setTheme,
  uniliveReferenceTheme,
  themeToCssVars,
  listComponentPalette,
  Button,
  createUiKitRegistry,
} from '../index.mjs';

test('reference theme tokens are stable', () => {
  const t = getTheme();
  assert.equal(t.id, 'unilives-reference');
  assert.equal(t.colors.primary, uniliveReferenceTheme.colors.primary);
  assert.ok(themeToCssVars()['--ul-color-primary']);
  setTheme({ colors: { primary: '#FFFFFF' } });
  assert.equal(getTheme().colors.primary, '#FFFFFF');
  setTheme(null);
  assert.equal(getTheme().colors.primary, uniliveReferenceTheme.colors.primary);
});

test('palette covers major categories', () => {
  const cats = listComponentPalette().map((c) => c.category);
  for (const c of ['Layout', 'Buttons', 'Auth', 'Messaging', 'RTC', 'Live', 'Commerce']) {
    assert.ok(cats.includes(c), c);
  }
});

test('components export without requiring DOM', () => {
  assert.equal(typeof Button, 'function');
  assert.ok(createUiKitRegistry().list().length >= 10);
});
