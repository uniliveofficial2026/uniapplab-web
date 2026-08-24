#!/usr/bin/env node
/**
 * Lightweight Stage D concurrency / load qualification (no external paid load).
 */
import assert from 'node:assert/strict';
import { createUniLiveCloud } from '@unilives/cloud';

const cloud = createUniLiveCloud();
const org = cloud.createOrganization({ name: 'LoadOrg', ownerActorId: 'load_owner' });

const N = 25;
const started = Date.now();
const results = await Promise.all(
  Array.from({ length: N }, async (_, i) => {
    const { project } = cloud.createProject({
      organizationId: org.organizationId,
      name: `p-${i}`,
      actorId: 'load_owner',
    });
    const envs = cloud.listEnvironments(project.projectId, 'load_owner');
    cloud.recordUsage({
      projectId: project.projectId,
      environmentId: envs[0].environmentId,
      kind: 'api.requests',
      eventId: `load-${i}`,
      actorId: 'load_owner',
    });
    // retry same event id — must be idempotent
    cloud.recordUsage({
      projectId: project.projectId,
      environmentId: envs[0].environmentId,
      kind: 'api.requests',
      eventId: `load-${i}`,
      actorId: 'load_owner',
    });
    return project.projectId;
  }),
);

const elapsed = Date.now() - started;
assert.equal(new Set(results).size, N);
assert.equal(cloud.listProjects(org.organizationId, 'load_owner').length, N);

console.log(
  JSON.stringify({
    ok: true,
    suite: 'stage-d-load-harness',
    projects: N,
    elapsedMs: elapsed,
    p95HintMs: elapsed, // single-batch wall clock for local harness
  }),
);
