#!/usr/bin/env node
/**
 * Stage D security matrix — tenant isolation, redaction, path/command safety, AI security.
 */
import assert from 'node:assert/strict';
import { createUniLiveCloud } from '@unilives/cloud';
import { redactFields, redactString } from '@unilives/observe';
import { createPlanner, sanitizeRequirement } from '@unilives/ai-builder';
import {
  validateInstallSafety,
  computeManifestIntegrity,
  PRIVILEGED_PERMISSIONS,
} from '@unilives/marketplace';
import { PermissionError } from '@unilives/errors';

const cloud = createUniLiveCloud();
const orgA = cloud.createOrganization({ name: 'SecA', ownerActorId: 'a' });
const orgB = cloud.createOrganization({ name: 'SecB', ownerActorId: 'b' });
const { project: pA } = cloud.createProject({ organizationId: orgA.organizationId, name: 'pa', actorId: 'a' });
const { project: pB } = cloud.createProject({ organizationId: orgB.organizationId, name: 'pb', actorId: 'b' });

assert.throws(() => cloud.listUsage(pB.projectId, 'a'), PermissionError);
assert.throws(() => cloud.listDeployments(pA.projectId, 'b'), PermissionError);

const synthetic = redactFields({
  authorization: 'Bearer aaa.bbb.ccc',
  bearer: 'tok',
  cookie: 'sid=1',
  password: 'x',
  api_secret: 's',
  private_key: 'k',
  apns: 'apns',
  fcm: 'fcm',
  livekit_api_secret: 'lk',
  supabase_service_role_key: 'sb',
  cloudflare_token: 'cf',
  vercel_token: 'vc',
  github_token: 'gh',
  jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb',
  safe: 'ok',
});
for (const k of Object.keys(synthetic)) {
  if (k === 'safe') assert.equal(synthetic[k], 'ok');
  else assert.equal(synthetic[k], '[redacted]');
}
assert.match(redactString('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb'), /\[redacted\]/);

const planner = createPlanner();
assert.throws(() => sanitizeRequirement('rm -rf / && cat ../../.env && deploy production'), /unsafe_requirement/);
const plan = await planner.buildFromRequirement({
  projectId: 'project_sec',
  requirement: 'Add a settings page',
});
assert.equal(plan.ok, true);

const body = {
  id: 'plugin.evil',
  name: 'Evil',
  publisher: 'test',
  version: '0.0.1',
  type: 'plugin',
  description: 'x',
  capabilities: [],
  compatibility: { platform: '>=0.1.0', schemaVersion: 1 },
  entrypoint: './index.mjs',
  permissions: [...PRIVILEGED_PERMISSIONS],
  metadata: {},
};
const privileged = { ...body, integrity: { algorithm: 'sha256', hash: computeManifestIntegrity(body) } };
assert.throws(() => validateInstallSafety(privileged, { grantedPermissions: [] }), PermissionError);

console.log(JSON.stringify({ ok: true, suite: 'stage-d-security-matrix' }));
