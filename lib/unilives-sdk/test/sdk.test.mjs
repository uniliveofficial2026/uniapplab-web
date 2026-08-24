import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError, AuthError, RTCError, NetworkError } from '@unilives/errors';
import {
  PLATFORM_VERSION,
  createRequestHelper,
  createUniLive,
  createControlPlaneStore,
} from '../index.mjs';

test('PLATFORM_VERSION is exported', () => {
  assert.equal(PLATFORM_VERSION, '0.1.0');
});

test('createUniLive requires projectId', () => {
  assert.throws(() => createUniLive({}), ValidationError);
  assert.throws(() => createUniLive({ projectId: '  ' }), ValidationError);
});

test('createUniLive validates environment', () => {
  assert.throws(
    () => createUniLive({ projectId: 'p1', environment: 'staging' }),
    ValidationError,
  );
  const uni = createUniLive({ projectId: 'p1', environment: 'preview' });
  assert.equal(uni.environment, 'preview');
  assert.equal(uni.platformVersion, '0.1.0');
});

test('namespaces expose typed adapter errors', async () => {
  const uni = createUniLive({ projectId: 'p1' });
  await assert.rejects(() => uni.auth.signIn(), AuthError);
  await assert.rejects(() => uni.database.query(), (err) => err.name === 'ProviderError');
  await assert.rejects(() => uni.rtc.joinRoom(), RTCError);
});

test('observe and events expose createTrace', async () => {
  const uni = createUniLive({ projectId: 'p1' });
  const trace = uni.events.createTrace({ roomId: 'r1' });
  assert.ok(trace.traceId);
  uni.observe.log('info', 'hello', { roomId: 'r1' });
  const logs = await uni.observe.getLogs({ limit: 5 });
  assert.ok(logs.length >= 1);
});

test('authorize requires credential', () => {
  const uni = createUniLive({ projectId: 'p1' });
  assert.equal(uni.authorize('project:read').ok, false);
});

test('authorize with credential', () => {
  const cp = createControlPlaneStore();
  const org = cp.createOrganization({ name: 'o', actor: 't' });
  const project = cp.createProject({ organizationId: org.organizationId, name: 'p', actor: 't' });
  const cred = cp.createApiCredential({
    projectId: project.projectId,
    kind: 'mcp',
    scopes: ['*'],
    actor: 't',
  });
  const uni = createUniLive({
    projectId: project.projectId,
    controlPlane: cp,
    credentialPublicId: cred.publicId,
  });
  assert.equal(uni.authorize('project:read').ok, true);
});

test('request helper attaches trace header and respects timeout', async () => {
  const request = createRequestHelper({ timeout: 50 });
  await assert.rejects(
    () => request('https://127.0.0.1:1/unreachable', { idempotent: false }),
    NetworkError,
  );
});

test('request helper does not retry non-idempotent ops', async () => {
  let attempts = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attempts += 1;
    throw new Error('network down');
  };
  try {
    const request = createRequestHelper({ retries: 2 });
    await assert.rejects(
      () => request('https://example.com/x', { idempotent: false, retries: 2 }),
      NetworkError,
    );
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('request helper retries idempotent ops', async () => {
  let attempts = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts < 2) throw new Error('transient');
    return new Response('ok', { status: 200 });
  };
  try {
    const request = createRequestHelper({ retries: 2 });
    const res = await request('https://example.com/x', { idempotent: true, retries: 2 });
    assert.equal(res.status, 200);
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
