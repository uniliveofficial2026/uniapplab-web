import test from 'node:test';
import assert from 'node:assert/strict';
import { createExampleButtonPlugin, registerPlugin, validatePluginManifest } from '../index.mjs';

test('example plugin registers without dangerous caps', () => {
  const plugin = createExampleButtonPlugin();
  validatePluginManifest(plugin.manifest);
  const reg = new Map();
  registerPlugin(reg, plugin);
  assert.equal(reg.size, 1);
  assert.throws(() =>
    validatePluginManifest({
      id: 'bad',
      name: 'bad',
      version: '1',
      kind: 'component',
      capabilities: ['provider.secrets'],
    }),
  );
});
