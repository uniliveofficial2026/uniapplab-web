import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniLiveObserve, redactFields } from '../index.mjs';

test('redacts sensitive keys and JWT-like values', () => {
  const out = redactFields({
    authorization: 'Bearer abc',
    password: 'x',
    note: 'ok',
    nested: { apiKey: 'k', safe: 1 },
    tokenish: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb',
  });
  assert.equal(out.authorization, '[redacted]');
  assert.equal(out.password, '[redacted]');
  assert.equal(out.note, 'ok');
  assert.equal(out.nested.apiKey, '[redacted]');
  assert.equal(out.nested.safe, 1);
  assert.equal(out.tokenish, '[redacted]');
});

test('observe buffer filters', () => {
  const o = createUniLiveObserve();
  o.log('info', 'hello', { source: 'api', traceId: 't1', authorization: 'secret' });
  o.log('error', 'boom', { source: 'rtc', traceId: 't2' });
  const logs = o.getLogs({ level: 'info', source: 'api' });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].authorization, '[redacted]');
});
