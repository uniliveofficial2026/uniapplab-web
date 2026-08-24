import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateAppSource, validateProjectGraph } from '@unilives/project-graph';
import { createFromTemplate, listTemplates } from '../index.mjs';

const RELEASED = ['basic', 'social', 'reels', 'livestream', 'call', 'marketplace'];

test('released templates list excludes future by default', () => {
  const list = listTemplates();
  assert.equal(list.some((t) => t.id === 'complete-social'), false);
  assert.equal(list.length, RELEASED.length);
});

for (const name of RELEASED) {
  test(`template ${name} validates and codegen`, async () => {
    const outDir = await mkdtemp(join(tmpdir(), `tpl-${name}-`));
    const result = await createFromTemplate(name, { projectId: `project_${name}`, outDir });
    assert.equal(result.ok, true);
    validateProjectGraph(result.graph);
    const src = generateAppSource(result.graph);
    assert.match(src, /createUniLive/);
    assert.match(src, /@unilives\/sdk/);
    assert.doesNotMatch(src, /livekit-client/);
  });
}
