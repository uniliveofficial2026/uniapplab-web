import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import {
  createBuilderSession,
  GRAPH_FILENAME,
  loadProjectGraphFromFile,
  validateProjectGraph,
} from '../index.mjs';

test('builder create edit save reload undo redo generate', async () => {
  const projectsDir = await mkdtemp(join(tmpdir(), 'unilives-builder-'));
  const session = createBuilderSession({ projectsDir });

  const created = await session.createProject({ projectId: 'demo_app', name: 'Demo App' });
  assert.equal(created.projectId, 'demo_app');
  assert.equal(session.getComponentPalette().length >= 10, true);

  const page = session.addPage({ path: '/', title: 'Home' });
  const cmp = session.addComponentFromPalette({ componentType: 'Button', props: { label: 'Go Live' } });
  const node = session.placeComponent({ pageId: page.pageId, componentId: cmp.componentId });
  session.bindAction({
    pageId: page.pageId,
    nodeId: node.nodeId,
    action: { type: 'rtc.join', roomId: 'live-1', roomType: 'LIVE' },
  });
  session.updateNodeProps({ pageId: page.pageId, nodeId: node.nodeId, props: { label: 'Join Live' } });

  session.setPreviewSize('mobile');
  assert.equal(session.getPreviewFrame().width, 390);

  assert.equal(session.undo(), true);
  assert.equal(session.redo(), true);

  const saved = await session.save();
  assert.equal(saved.ok, true);
  const graphPath = join(projectsDir, 'demo_app', GRAPH_FILENAME);
  assert.equal(existsSync(graphPath), true);

  const onDisk = await loadProjectGraphFromFile(graphPath);
  validateProjectGraph(onDisk);
  assert.equal(onDisk.pages.length, 1);

  const session2 = createBuilderSession({ projectsDir });
  await session2.openProject({ projectId: 'demo_app' });
  assert.equal(session2.toJSON().pages[0].nodes.length, 1);

  const src = session2.generateAppSource();
  assert.match(src, /createUniLive/);
  assert.match(src, /@unilives\/sdk/);
  assert.match(src, /Button/);
  assert.doesNotMatch(src, /livekit-client/);

  const raw = await readFile(graphPath, 'utf8');
  assert.doesNotMatch(raw, /\.tmp$/);
});
