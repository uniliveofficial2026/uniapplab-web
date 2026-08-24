#!/usr/bin/env node
/**
 * Stage C local stack E2E — in-process path (always available).
 * Docker LiveKit/Postgres is additive when compose works.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalPlatform } from '@unilives/local-runtime';
import { createFromTemplate } from '@unilives/templates';
import { generateAppSource, validateProjectGraph } from '@unilives/project-graph';
import { createBuilderSession } from '@unilives/builder';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, 'tmp', 'stage-c-local-e2e');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  await rm(TMP, { recursive: true, force: true });
  await mkdir(TMP, { recursive: true });

  // 1-3 start
  const platform = await startLocalPlatform({
    rootDir: ROOT,
    apiPort: 8791,
    studioPort: 8792,
  });
  assert(platform.apiUrl, 'api url');

  // 4 health
  const health = await (await fetch(`${platform.apiUrl}/api/v1/health`)).json();
  assert(health.ok && health.productionRtcApi === 'UniLiveRTC', 'health');

  // 5-6 migrate + auth
  const mig = await (await fetch(`${platform.apiUrl}/api/v1/db/migrate`, { method: 'POST' })).json();
  assert(mig.ok, 'migrate');
  const email = `dev_${Date.now()}@example.com`;
  const signup = await (
    await fetch(`${platform.apiUrl}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'local-dev-password' }),
    })
  ).json();
  assert(signup.ok && signup.personId && signup.sessionId, 'signup');
  const signin = await (
    await fetch(`${platform.apiUrl}/api/v1/auth/signin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'local-dev-password' }),
    })
  ).json();
  assert(signin.ok, 'signin');

  // 8 db
  const ins = await (
    await fetch(`${platform.apiUrl}/api/v1/db/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ table: 'notes', op: 'insert', values: { text: 'hello' } }),
    })
  ).json();
  assert(ins.ok && ins.row?.id, 'db insert');

  // 9 storage
  const up = await (
    await fetch(`${platform.apiUrl}/api/v1/storage/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'hello.txt', content: 'hi' }),
    })
  ).json();
  assert(up.ok, 'storage upload');
  const listed = await (await fetch(`${platform.apiUrl}/api/v1/storage/list`)).json();
  assert(listed.objects?.some((o) => o.key === 'hello.txt'), 'storage list');

  // 10 realtime
  const rt = await (
    await fetch(`${platform.apiUrl}/api/v1/realtime/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'notes', payload: { hello: true } }),
    })
  ).json();
  assert(rt.ok, 'realtime');

  // 11-12 RTC
  const room = await (
    await fetch(`${platform.apiUrl}/api/v1/rtc/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomId: 'e2e-room', identity: 'a' }),
    })
  ).json();
  assert(room.ok, 'rtc room');
  await fetch(`${platform.apiUrl}/api/v1/rtc/rooms/e2e-room`, { method: 'DELETE' });

  // 13 MCP
  const mcp = await (
    await fetch(`${platform.apiUrl}/api/v1/mcp/invoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool: 'list_projects', args: {} }),
    })
  ).json();
  assert(mcp.ok, 'mcp list_projects');

  // 14 Studio
  const studioHealth = await (await fetch(`${platform.studioUrl}/api/health`)).json();
  assert(studioHealth.ok, 'studio health');

  // 15-16 template + builder generate
  const outDir = join(TMP, 'app-basic');
  const tpl = await createFromTemplate('basic', { projectId: 'project_e2e_basic', outDir });
  validateProjectGraph(tpl.graph);
  const src = generateAppSource(tpl.graph);
  assert(src.includes('@unilives/sdk'), 'codegen sdk');
  assert(!/livekit-client/.test(src), 'no livekit in generated');
  await writeFile(join(outDir, 'generated-App.jsx'), src);

  const projectsDir = join(TMP, 'builder-projects');
  const session = createBuilderSession({ projectsDir });
  await session.createProject({ projectId: 'e2e_builder', name: 'E2E' });
  const page = session.addPage({ path: '/', title: 'Home' });
  const cmp = session.addComponentFromPalette({ componentType: 'Button' });
  session.placeComponent({ pageId: page.pageId, componentId: cmp.componentId });
  await session.save();
  assert(existsSync(join(projectsDir, 'e2e_builder', 'project-graph.json')), 'builder save');

  // 17 stop
  await platform.close();

  // 18-19 restart
  const platform2 = await startLocalPlatform({ rootDir: ROOT, apiPort: 8791, studioPort: 8792 });
  const health2 = await (await fetch(`${platform2.apiUrl}/api/v1/health`)).json();
  assert(health2.ok, 'restart health');
  await platform2.close();

  console.log(JSON.stringify({ ok: true, suite: 'stage-c-local-e2e', mode: 'in-process' }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2));
  process.exit(1);
});
