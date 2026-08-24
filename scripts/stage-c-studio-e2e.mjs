#!/usr/bin/env node
/**
 * Studio MVP E2E — real HTTP workflows against @unilives/studio.
 */
import { mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStudioServer } from '@unilives/studio';
import { createControlPlaneStore } from '@unilives/platform-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const projectsDir = join(ROOT, 'tmp', 'studio-e2e-projects');

async function json(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  await rm(projectsDir, { recursive: true, force: true });
  await mkdir(projectsDir, { recursive: true });
  const controlPlane = createControlPlaneStore();
  const studio = await startStudioServer({ port: 8793, projectsDir, controlPlane });
  const base = studio.url;

  assert((await json(`${base}/api/health`)).body.ok, 'health');

  const created = await json(`${base}/api/projects`, {
    method: 'POST',
    body: JSON.stringify({ name: 'studio-e2e', template: 'basic' }),
  });
  assert(created.body.ok && created.body.project?.projectId, 'create project');
  const projectId = created.body.project.projectId;

  assert((await json(`${base}/api/projects`)).body.projects?.length >= 1, 'list projects');
  assert((await json(`${base}/api/builder/palette`)).body.ok, 'palette');
  assert((await json(`${base}/api/data`)).body.ok, 'data panel');
  assert((await json(`${base}/api/rtc`)).body.ok, 'rtc panel');
  assert((await json(`${base}/api/storage`)).body.ok, 'storage panel');
  assert((await json(`${base}/api/deploy`)).body.ok, 'deploy panel');
  assert((await json(`${base}/api/logs`)).body.ok, 'logs panel');
  assert((await json(`${base}/api/settings`)).body.ok, 'settings');

  const sess = await json(`${base}/api/builder/sessions`, {
    method: 'POST',
    body: JSON.stringify({ projectId: 'studio_builder_graph', name: 'Graph', create: true }),
  });
  assert(sess.body.ok && sess.body.sessionId, 'builder session');
  const sid = sess.body.sessionId;

  const page = await json(`${base}/api/builder/sessions/${sid}/page`, {
    method: 'POST',
    body: JSON.stringify({ path: '/', title: 'Home' }),
  });
  assert(page.body.ok && page.body.page?.pageId, 'add page');

  const cmp = await json(`${base}/api/builder/sessions/${sid}/component`, {
    method: 'POST',
    body: JSON.stringify({ fromPalette: true, componentType: 'Button', props: { label: 'Hi' } }),
  });
  assert(cmp.body.ok && cmp.body.component?.componentId, 'add component');

  const place = await json(`${base}/api/builder/sessions/${sid}/place`, {
    method: 'POST',
    body: JSON.stringify({
      pageId: page.body.page.pageId,
      componentId: cmp.body.component.componentId,
    }),
  });
  assert(place.body.ok, 'place');

  await json(`${base}/api/builder/sessions/${sid}/bind`, {
    method: 'POST',
    body: JSON.stringify({
      pageId: page.body.page.pageId,
      nodeId: place.body.node.nodeId,
      action: { type: 'navigate', to: '/next' },
    }),
  });

  assert((await json(`${base}/api/builder/sessions/${sid}/preview-size`, {
    method: 'POST',
    body: JSON.stringify({ size: 'mobile' }),
  })).body.ok, 'preview');

  assert((await json(`${base}/api/builder/sessions/${sid}/save`, { method: 'POST', body: '{}' })).body.ok, 'save');
  assert((await json(`${base}/api/builder/sessions/${sid}/undo`, { method: 'POST', body: '{}' })).body.ok, 'undo');
  assert((await json(`${base}/api/builder/sessions/${sid}/redo`, { method: 'POST', body: '{}' })).body.ok, 'redo');

  const gen = await json(`${base}/api/builder/sessions/${sid}/generate`);
  assert(gen.body.ok && /createUniLive/.test(gen.body.source), 'generate');
  assert(!/livekit-client/.test(gen.body.source), 'no livekit');

  await studio.close();
  console.log(JSON.stringify({ ok: true, suite: 'stage-c-studio-e2e', projectId }, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e.message || e) }));
  process.exit(1);
});
