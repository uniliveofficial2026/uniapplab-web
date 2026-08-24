import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_REPAIR_ATTEMPTS,
  applyProjectGraphPatch,
  createMockAIProvider,
  createPlanner,
  sanitizeRequirement,
  validateExecutionPlan,
} from '../index.mjs';
import { createEmptyProjectGraph, validateProjectGraph } from '@unilives/project-graph';

test('mock provider builds basic plan', async () => {
  const provider = createMockAIProvider();
  const plan = await provider.plan({ requirement: 'basic home starter' });
  const validation = validateExecutionPlan(plan);
  assert.equal(validation.ok, true);
  assert.ok(plan.patches.length >= 1);
});

test('unsafe requirement rejected', () => {
  assert.throws(() => sanitizeRequirement('run shell rm -rf /'), /unsafe_requirement/);
  assert.throws(() => sanitizeRequirement('read ../etc/passwd'), /unsafe_requirement/);
});

test('apply patch produces valid graph and codegen', async () => {
  const provider = createMockAIProvider();
  const plan = await provider.plan({ requirement: 'basic app' });
  let graph = createEmptyProjectGraph({ projectId: 'ai_demo' });
  for (const patch of plan.patches) {
    graph = applyProjectGraphPatch(graph, patch);
  }
  validateProjectGraph(graph);
  assert.ok(graph.pages.some((p) => p.path === '/'));
});

test('privileged patch requires grant', () => {
  const graph = createEmptyProjectGraph({ projectId: 'perm_demo' });
  const patch = {
    patchId: 'p1',
    summary: 'deploy',
    requiredPermissions: ['deploy.mutate'],
    operations: [{ op: 'setProjectName', params: { name: 'X' } }],
  };
  assert.throws(() => applyProjectGraphPatch(graph, patch), /patch_permission_denied/);
  assert.doesNotThrow(() => applyProjectGraphPatch(graph, patch, { grantedPermissions: ['deploy.mutate'] }));
});

test('planner repair loop bounded', async () => {
  let calls = 0;
  const provider = {
    id: 'broken',
    async plan() {
      calls += 1;
      return {
        planId: 'bad',
        requirement: 'x',
        intent: 'bad',
        permissions: [],
        patches: [
          {
            patchId: 'bad_patch',
            summary: 'invalid',
            operations: [{ op: 'runShell', params: { cmd: 'echo no' } }],
          },
        ],
      };
    },
  };
  const planner = createPlanner({ provider, maxAttempts: MAX_REPAIR_ATTEMPTS });
  const result = await planner.buildFromRequirement({ projectId: 'repair_demo', requirement: 'anything' });
  assert.equal(result.ok, false);
  assert.equal(calls, MAX_REPAIR_ATTEMPTS);
});

test('live requirement adds rtc page', async () => {
  const planner = createPlanner();
  const result = await planner.buildFromRequirement({
    projectId: 'live_demo',
    requirement: 'live stream stage',
  });
  assert.equal(result.ok, true);
  assert.ok(result.source?.includes('LiveStage') || result.graph.pages.some((p) => p.path === '/live'));
});
