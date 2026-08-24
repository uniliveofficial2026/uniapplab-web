import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUniLiveCloud } from '../index.mjs';
import { PermissionError, RateLimitError, ValidationError } from '@unilives/errors';

test('org project environments RBAC and tenant isolation', () => {
  const cloud = createUniLiveCloud();
  const orgA = cloud.createOrganization({ name: 'A', ownerActorId: 'owner_a' });
  const orgB = cloud.createOrganization({ name: 'B', ownerActorId: 'owner_b' });

  cloud.addMember({
    organizationId: orgA.organizationId,
    actorId: 'viewer_a',
    role: 'viewer',
    byActorId: 'owner_a',
  });

  const { project: projA, environments } = cloud.createProject({
    organizationId: orgA.organizationId,
    name: 'proj-a',
    actorId: 'owner_a',
  });
  assert.equal(environments.length, 3);
  assert.ok(environments.every((e) => ['development', 'preview', 'production'].includes(e.kind)));

  const { project: projB } = cloud.createProject({
    organizationId: orgB.organizationId,
    name: 'proj-b',
    actorId: 'owner_b',
  });

  assert.throws(() => cloud.getProject(projB.projectId, 'owner_a'), PermissionError);
  assert.throws(() => cloud.getProject(projA.projectId, 'owner_b'), PermissionError);
  assert.throws(
    () => cloud.createProject({ organizationId: orgA.organizationId, name: 'x', actorId: 'viewer_a' }),
    PermissionError,
  );
  assert.ok(cloud.getProject(projA.projectId, 'viewer_a'));
});

test('secret refs never return plaintext', () => {
  const cloud = createUniLiveCloud();
  const org = cloud.createOrganization({ name: 'S', ownerActorId: 'o' });
  const { project, environments } = cloud.createProject({
    organizationId: org.organizationId,
    name: 'p',
    actorId: 'o',
  });
  const env = environments.find((e) => e.kind === 'development');
  const secret = cloud.createSecretRef({
    projectId: project.projectId,
    environmentId: env.environmentId,
    name: 'LIVEKIT_API_KEY',
    actorId: 'o',
    plaintextForHashOnly: 'super-secret-value-never-store',
  });
  assert.match(secret.secretRef, /^secret:\/\//);
  assert.ok(!JSON.stringify(secret).includes('super-secret-value-never-store'));
  const listed = cloud.listSecretMetadata({ projectId: project.projectId, actorId: 'o' });
  assert.ok(!JSON.stringify(listed).includes('super-secret-value-never-store'));
});

test('deployment lifecycle and rollback', () => {
  const cloud = createUniLiveCloud();
  const org = cloud.createOrganization({ name: 'D', ownerActorId: 'o' });
  const { project, environments } = cloud.createProject({
    organizationId: org.organizationId,
    name: 'p',
    actorId: 'o',
  });
  const env = environments.find((e) => e.kind === 'preview');
  const d1 = cloud.startDeployment({
    projectId: project.projectId,
    environmentId: env.environmentId,
    gitSha: 'aaa111',
    actorId: 'o',
  });
  cloud.advanceDeployment(d1.deploymentId, 'BUILDING', 'o');
  cloud.advanceDeployment(d1.deploymentId, 'DEPLOYING', 'o');
  cloud.advanceDeployment(d1.deploymentId, 'VERIFYING', 'o');
  cloud.advanceDeployment(d1.deploymentId, 'READY', 'o');

  const d2 = cloud.startDeployment({
    projectId: project.projectId,
    environmentId: env.environmentId,
    gitSha: 'bbb222',
    actorId: 'o',
  });
  assert.equal(d2.rollbackTarget, d1.deploymentId);
  cloud.advanceDeployment(d2.deploymentId, 'READY', 'o');
  const rb = cloud.rollbackDeployment({ deploymentId: d2.deploymentId, actorId: 'o' });
  assert.equal(rb.rolledBack.status, 'ROLLED_BACK');
  assert.equal(rb.restored.deploymentId, d1.deploymentId);
  assert.equal(rb.restored.status, 'READY');
});

test('provider health and usage idempotency', () => {
  const cloud = createUniLiveCloud();
  const org = cloud.createOrganization({ name: 'P', ownerActorId: 'o' });
  const { project, environments } = cloud.createProject({
    organizationId: org.organizationId,
    name: 'p',
    actorId: 'o',
  });
  const env = environments[0];
  const conn = cloud.connectProvider({
    projectId: project.projectId,
    environmentId: env.environmentId,
    providerType: 'livekit',
    actorId: 'o',
    capabilities: ['rtc'],
    secretRef: 'secret://abc',
  });
  const health = cloud.providerHealth(conn.providerConnectionId, 'o');
  assert.equal(health.status, 'HEALTHY');
  assert.ok(!('secretRef' in health) || health.secretRef === undefined);

  const u1 = cloud.recordUsage({
    projectId: project.projectId,
    environmentId: env.environmentId,
    kind: 'api.requests',
    eventId: 'evt_1',
    actorId: 'o',
  });
  const u2 = cloud.recordUsage({
    projectId: project.projectId,
    environmentId: env.environmentId,
    kind: 'api.requests',
    eventId: 'evt_1',
    actorId: 'o',
  });
  assert.equal(u1.eventId, u2.eventId);
  assert.equal(cloud.listUsage(project.projectId, 'o').length, 1);
});

test('quota and rate limit typed errors', () => {
  const cloud = createUniLiveCloud();
  cloud.setQuota('project.create', 1);
  const org = cloud.createOrganization({ name: 'Q', ownerActorId: 'o' });
  cloud.createProject({ organizationId: org.organizationId, name: 'p1', actorId: 'o' });
  assert.throws(
    () => cloud.createProject({ organizationId: org.organizationId, name: 'p2', actorId: 'o' }),
    ValidationError,
  );
});

test('resource id prefixes', () => {
  const cloud = createUniLiveCloud();
  const org = cloud.createOrganization({ name: 'I', ownerActorId: 'o' });
  assert.match(org.organizationId, /^org_/);
  const { project, environments } = cloud.createProject({
    organizationId: org.organizationId,
    name: 'p',
    actorId: 'o',
  });
  assert.match(project.projectId, /^project_/);
  assert.ok(environments.every((e) => e.environmentId.startsWith('env_')));
});
