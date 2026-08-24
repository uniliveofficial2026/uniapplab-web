import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startStudioServer } from '../index.mjs';

test('studio HTTP API smoke', async () => {
  const projectsDir = await mkdtemp(join(tmpdir(), 'studio-'));
  const studio = await startStudioServer({ port: 0, projectsDir });
  const base = studio.url;

  const health = await fetch(`${base}/api/health`).then((r) => r.json());
  assert.equal(health.ok, true);

  const created = await fetch(`${base}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke App', template: 'basic' }),
  }).then((r) => r.json());
  assert.equal(created.ok, true);
  assert.ok(created.project.projectId);

  const palette = await fetch(`${base}/api/builder/palette`).then((r) => r.json());
  assert.ok(palette.palette.length >= 10);

  const session = await fetch(`${base}/api/builder/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: created.project.projectId, create: false }),
  }).then((r) => r.json());
  assert.ok(session.sessionId);

  const logs = await fetch(`${base}/api/logs`).then((r) => r.json());
  assert.equal(logs.ok, true);

  const html = await fetch(`${base}/`).then((r) => r.text());
  assert.match(html, /data-testid="studio-header"/);

  await studio.close();
});
