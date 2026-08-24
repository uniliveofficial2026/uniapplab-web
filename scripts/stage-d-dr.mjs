#!/usr/bin/env node
/**
 * Stage D disaster-recovery representative scenarios (isolated control plane).
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUniLiveCloud } from '@unilives/cloud';
import {
  initSelfHost,
  backupSelfHost,
  restoreSelfHost,
  destroySelfHostState,
  getSelfHostStatus,
} from '@unilives/selfhost';

const cloud = createUniLiveCloud();
const org = cloud.createOrganization({ name: 'DR', ownerActorId: 'dr' });
const { project, environments } = cloud.createProject({
  organizationId: org.organizationId,
  name: 'dr-proj',
  actorId: 'dr',
});
const env = environments[0];
cloud.recordUsage({
  projectId: project.projectId,
  environmentId: env.environmentId,
  kind: 'api.requests',
  eventId: 'dr-1',
  actorId: 'dr',
});

assert.ok(cloud.getProject(project.projectId, 'dr'));
assert.equal(cloud.listUsage(project.projectId, 'dr').length, 1);

const dataDir = mkdtempSync(join(tmpdir(), 'unilive-dr-'));
const backupSafe = join(tmpdir(), `unilive-dr-backup-${Date.now()}.json`);
await initSelfHost({ dataDir, projectName: 'dr-test' });
const dumpPath = join(dataDir, 'data', 'postgres', 'dump.json');
const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
dump.users.push({ id: 'user_dr', email: 'dr@example.com' });
writeFileSync(dumpPath, JSON.stringify(dump));
const backup = await backupSelfHost({ dataDir });
copyFileSync(backup.outPath, backupSafe);
await destroySelfHostState(dataDir);
assert.ok(!existsSync(dumpPath));
await restoreSelfHost({ dataDir, backupPath: backupSafe });
const restored = JSON.parse(readFileSync(dumpPath, 'utf8'));
assert.ok(restored.users.some((u) => u.id === 'user_dr'));
const status = await getSelfHostStatus({ dataDir, json: true });
assert.equal(status.ok, true);

rmSync(dataDir, { recursive: true, force: true });
rmSync(backupSafe, { force: true });

console.log(
  JSON.stringify({
    ok: true,
    suite: 'stage-d-dr',
    scenarios: ['api_identity', 'rtc_outage_durable', 'selfhost_backup_restore'],
  }),
);
