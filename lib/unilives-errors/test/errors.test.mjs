import test from 'node:test';
import assert from 'node:assert/strict';
import { UniLiveError, ValidationError } from '../index.mjs';

test('redacts secret-like detail keys', () => {
  const err = new UniLiveError('X', 'msg', { details: { apiKey: 'sk-live', ok: 1 }, traceId: 't1' });
  assert.equal(err.details.apiKey, '[redacted]');
  assert.equal(err.details.ok, 1);
  assert.equal(err.toJSON().traceId, 't1');
});

test('ValidationError code', () => {
  const e = new ValidationError('bad');
  assert.equal(e.code, 'VALIDATION_ERROR');
});
