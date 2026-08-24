import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyProjectGraph,
  createProjectGraphEditor,
  generateAppSource,
  validateProjectGraph,
} from '../index.mjs';

test('project graph create edit undo generate', () => {
  const graph = createEmptyProjectGraph({ projectId: 'project_demo', name: 'Demo' });
  validateProjectGraph(graph);
  const ed = createProjectGraphEditor(graph);
  const page = ed.addPage({ path: '/', title: 'Home' });
  const cmp = ed.addComponent({ componentType: 'Button', props: { label: 'Go' } });
  const node = ed.placeComponent({ pageId: page.pageId, componentId: cmp.componentId });
  ed.bindAction({
    pageId: page.pageId,
    nodeId: node.nodeId,
    action: { type: 'navigate', to: '/live' },
  });
  ed.updateNodeProps({ pageId: page.pageId, nodeId: node.nodeId, props: { label: 'Live' } });
  assert.equal(ed.undo(), true);
  assert.equal(ed.redo(), true);
  const src = generateAppSource(ed.toJSON());
  assert.match(src, /createUniLive/);
  assert.match(src, /@unilives\/sdk/);
  assert.doesNotMatch(src, /livekit-client/);
});
