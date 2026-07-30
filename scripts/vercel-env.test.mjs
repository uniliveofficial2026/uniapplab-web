import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vercelEnvSet, vercelEnvSyncAll } from './lib/vercel-env.mjs';

test('vercelEnvSet updates a variable without deleting it first', () => {
  const calls = [];

  const code = vercelEnvSet('/repo', 'SUPABASE_SERVICE_ROLE_KEY', 'replacement', 'production', {
    spawnSync(command, args, options) {
      calls.push({ command, args, options });
      return { status: 0, stderr: Buffer.alloc(0) };
    },
  });

  assert.equal(code, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'pnpm');
  assert.deepEqual(calls[0].args.slice(0, 6), [
    'dlx',
    'vercel@latest',
    'env',
    'add',
    'SUPABASE_SERVICE_ROLE_KEY',
    'production',
  ]);
  assert.ok(calls[0].args.includes('--force'));
  assert.ok(calls[0].args.includes('--value'));
  assert.ok(!calls[0].args.includes('rm'));
});

test('vercelEnvSyncAll stops on add failure without removing existing values', () => {
  const calls = [];
  const originalError = console.error;
  console.error = () => {};

  try {
    const code = vercelEnvSyncAll(
      '/repo',
      [
        ['LINEAR_API_KEY', 'new-key'],
        ['LINEAR_TEAM_ID', 'team'],
      ],
      {
        label: 'linear',
        spawnSync(command, args) {
          calls.push({ command, args });
          return { status: 1, stderr: Buffer.from('vercel add failed') };
        },
      },
    );

    assert.equal(code, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, 'pnpm');
    assert.equal(calls[0].args[3], 'add');
    assert.ok(!calls.some((call) => call.args.includes('rm')));
  } finally {
    console.error = originalError;
  }
});
