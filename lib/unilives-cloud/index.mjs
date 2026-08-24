import { createControlPlaneStore } from '@unilives/platform-core';
import { PermissionError, ValidationError, NotFoundError, RateLimitError } from '@unilives/errors';
import { PLATFORM_VERSION } from '@unilives/release';
import { randomBytes, createHash } from 'node:crypto';

const ROLES = new Set([
  'organization_owner',
  'organization_admin',
  'developer',
  'operator',
  'viewer',
]);

const ENV_KINDS = new Set(['development', 'preview', 'production']);

const ROLE_PERMS = {
  organization_owner: ['*'],
  organization_admin: [
    'project:read',
    'project:write',
    'member:write',
    'provider:write',
    'secret:write',
    'deploy:write',
    'deploy:read',
    'logs:read',
    'usage:read',
    'plugin:write',
  ],
  developer: [
    'project:read',
    'project:write',
    'provider:read',
    'secret:read',
    'deploy:write',
    'deploy:read',
    'logs:read',
    'usage:read',
    'plugin:write',
  ],
  operator: ['project:read', 'provider:read', 'deploy:read', 'deploy:write', 'logs:read', 'usage:read'],
  viewer: ['project:read', 'provider:read', 'deploy:read', 'logs:read', 'usage:read'],
};

function mint(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function hashRef(value) {
  return `secret://${createHash('sha256').update(String(value)).digest('hex').slice(0, 24)}`;
}

/**
 * UniLive Cloud control plane MVP (in-memory + Stage B control plane bridge).
 */
export function createUniLiveCloud(options = {}) {
  const controlPlane = options.controlPlane || createControlPlaneStore();
  /** @type {Map<string, any>} */
  const orgs = new Map();
  /** @type {Map<string, any>} */
  const members = new Map();
  /** @type {Map<string, any>} */
  const projects = new Map();
  /** @type {Map<string, any>} */
  const environments = new Map();
  /** @type {Map<string, any>} */
  const secrets = new Map();
  /** @type {Map<string, any>} */
  const providers = new Map();
  /** @type {Map<string, any>} */
  const deployments = new Map();
  /** @type {Map<string, any>} */
  const domains = new Map();
  /** @type {any[]} */
  const audit = [];
  /** @type {any[]} */
  const usage = [];
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const rateBuckets = new Map();
  /** @type {Map<string, number>} */
  const quotas = new Map([
    ['project.create', 100],
    ['api.requests', 10000],
    ['rtc.rooms', 50],
  ]);

  function auditEvent(action, resource, actor, details = {}) {
    const row = {
      auditId: mint('audit'),
      action,
      resource,
      actor: actor || 'system',
      details,
      at: now(),
      platformVersion: PLATFORM_VERSION,
    };
    audit.push(row);
    return row;
  }

  function getMember(orgId, actorId) {
    return [...members.values()].find((m) => m.organizationId === orgId && m.actorId === actorId && !m.revoked);
  }

  function assertPerm(orgId, actorId, perm) {
    const m = getMember(orgId, actorId);
    if (!m) throw new PermissionError('not_organization_member', { details: { orgId, actorId } });
    const allowed = ROLE_PERMS[m.role] || [];
    if (!allowed.includes('*') && !allowed.includes(perm)) {
      throw new PermissionError('role_denied', { details: { role: m.role, perm } });
    }
    return m;
  }

  function assertProjectAccess(projectId, actorId, perm) {
    const project = projects.get(projectId);
    if (!project || project.deleted) throw new NotFoundError('project_not_found', { details: { projectId } });
    assertPerm(project.organizationId, actorId, perm);
    return project;
  }

  function rateLimit(key, limit = 60, windowMs = 60_000) {
    const t = Date.now();
    const b = rateBuckets.get(key);
    if (!b || b.resetAt < t) {
      rateBuckets.set(key, { count: 1, resetAt: t + windowMs });
      return true;
    }
    b.count += 1;
    if (b.count > limit) {
      throw new RateLimitError('rate_limit_exceeded', { details: { key, limit } });
    }
    return true;
  }

  function checkQuota(kind, current) {
    const max = quotas.get(kind);
    if (max != null && current >= max) {
      throw new ValidationError('quota_exceeded', { details: { kind, max, current } });
    }
  }

  return {
    PLATFORM_VERSION,
    controlPlane,
    ROLES: [...ROLES],

    createOrganization({ name, ownerActorId }) {
      if (!name || !ownerActorId) throw new ValidationError('name_and_owner_required');
      rateLimit(`org.create:${ownerActorId}`, 20);
      const organizationId = mint('org');
      const org = { organizationId, name, createdAt: now(), ownerActorId };
      orgs.set(organizationId, org);
      const memberId = mint('om');
      members.set(memberId, {
        memberId,
        organizationId,
        actorId: ownerActorId,
        role: 'organization_owner',
        createdAt: now(),
        revoked: false,
      });
      auditEvent('organization.created', organizationId, ownerActorId, { name });
      return org;
    },

    addMember({ organizationId, actorId, role, byActorId }) {
      if (!ROLES.has(role)) throw new ValidationError('invalid_role', { details: { role } });
      assertPerm(organizationId, byActorId, 'member:write');
      if (role === 'organization_owner') {
        throw new PermissionError('cannot_assign_owner_via_add');
      }
      const memberId = mint('om');
      const row = { memberId, organizationId, actorId, role, createdAt: now(), revoked: false };
      members.set(memberId, row);
      auditEvent('member.role.changed', memberId, byActorId, { actorId, role, organizationId });
      return row;
    },

    listMembers(organizationId, actorId) {
      assertPerm(organizationId, actorId, 'project:read');
      return [...members.values()].filter((m) => m.organizationId === organizationId && !m.revoked);
    },

    createProject({ organizationId, name, actorId }) {
      assertPerm(organizationId, actorId, 'project:write');
      checkQuota(
        'project.create',
        [...projects.values()].filter((p) => p.organizationId === organizationId && !p.deleted).length,
      );
      rateLimit(`project.create:${actorId}`, 30);
      const projectId = mint('project');
      const cpOrg =
        controlPlane.listOrganizations?.()?.[0] ||
        controlPlane.createOrganization({ name: `${name}-bridge`, actor: actorId });
      const cpProject = controlPlane.createProject({
        organizationId: cpOrg.organizationId,
        name,
        actor: actorId,
      });
      const project = {
        projectId,
        organizationId,
        name,
        controlPlaneProjectId: cpProject.projectId,
        createdAt: now(),
        createdBy: actorId,
        deleted: false,
      };
      projects.set(projectId, project);
      for (const kind of ['development', 'preview', 'production']) {
        const environmentId = mint('env');
        environments.set(environmentId, {
          environmentId,
          projectId,
          kind,
          createdAt: now(),
        });
      }
      auditEvent('project.created', projectId, actorId, { organizationId, name });
      return {
        project,
        environments: this.listEnvironments(projectId, actorId),
      };
    },

    softDeleteProject({ projectId, actorId }) {
      const project = assertProjectAccess(projectId, actorId, 'project:write');
      // production delete requires owner/admin
      assertPerm(project.organizationId, actorId, 'member:write');
      project.deleted = true;
      project.deletedAt = now();
      auditEvent('project.soft_deleted', projectId, actorId, {});
      return project;
    },

    getProject(projectId, actorId) {
      return assertProjectAccess(projectId, actorId, 'project:read');
    },

    listProjects(organizationId, actorId) {
      assertPerm(organizationId, actorId, 'project:read');
      return [...projects.values()].filter((p) => p.organizationId === organizationId && !p.deleted);
    },

    listEnvironments(projectId, actorId) {
      assertProjectAccess(projectId, actorId, 'project:read');
      return [...environments.values()].filter((e) => e.projectId === projectId);
    },

    getEnvironment(environmentId, actorId) {
      const env = environments.get(environmentId);
      if (!env) throw new NotFoundError('environment_not_found');
      assertProjectAccess(env.projectId, actorId, 'project:read');
      return env;
    },

    createSecretRef({ projectId, environmentId, name, actorId, plaintextForHashOnly }) {
      assertProjectAccess(projectId, actorId, 'secret:write');
      const env = environments.get(environmentId);
      if (!env || env.projectId !== projectId) throw new ValidationError('environment_mismatch');
      // Never store plaintext — only opaque reference derived from value
      const secretId = mint('secret');
      const secretRef = hashRef(`${projectId}:${environmentId}:${name}:${plaintextForHashOnly || randomBytes(16).toString('hex')}`);
      const row = {
        secretId,
        projectId,
        environmentId,
        name,
        secretRef,
        status: 'active',
        version: 1,
        createdAt: now(),
        createdBy: actorId,
      };
      secrets.set(secretId, row);
      auditEvent('secret.ref.created', secretId, actorId, { projectId, environmentId, name, secretRef });
      // Never return plaintext
      return { ...row };
    },

    listSecretMetadata({ projectId, actorId }) {
      assertProjectAccess(projectId, actorId, 'secret:read');
      return [...secrets.values()]
        .filter((s) => s.projectId === projectId && s.status === 'active')
        .map(({ secretId, projectId: p, environmentId, name, secretRef, status, version, createdAt }) => ({
          secretId,
          projectId: p,
          environmentId,
          name,
          secretRef,
          status,
          version,
          createdAt,
        }));
    },

    connectProvider({
      projectId,
      environmentId,
      providerType,
      actorId,
      capabilities = [],
      secretRef,
    }) {
      assertProjectAccess(projectId, actorId, 'provider:write');
      const env = environments.get(environmentId);
      if (!env || env.projectId !== projectId) throw new ValidationError('environment_mismatch');
      const providerConnectionId = mint('providerconn');
      const row = {
        providerConnectionId,
        projectId,
        environmentId,
        providerType,
        capabilities,
        secretRef: secretRef || null,
        status: 'HEALTHY',
        lastCheckedAt: now(),
        createdAt: now(),
      };
      providers.set(providerConnectionId, row);
      auditEvent('provider.connected', providerConnectionId, actorId, {
        providerType,
        projectId,
        environmentId,
      });
      return row;
    },

    providerHealth(providerConnectionId, actorId) {
      const row = providers.get(providerConnectionId);
      if (!row) throw new NotFoundError('provider_not_found');
      assertProjectAccess(row.projectId, actorId, 'provider:read');
      // Safe health — no secrets
      const states = ['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'MISCONFIGURED'];
      row.lastCheckedAt = now();
      if (!states.includes(row.status)) row.status = 'HEALTHY';
      return {
        providerConnectionId,
        providerType: row.providerType,
        status: row.status,
        lastCheckedAt: row.lastCheckedAt,
        capabilities: row.capabilities,
        reason: row.status === 'HEALTHY' ? null : 'check_required',
      };
    },

    listProviders(projectId, actorId) {
      assertProjectAccess(projectId, actorId, 'provider:read');
      return [...providers.values()]
        .filter((p) => p.projectId === projectId)
        .map((p) => ({
          providerConnectionId: p.providerConnectionId,
          environmentId: p.environmentId,
          providerType: p.providerType,
          status: p.status,
          capabilities: p.capabilities,
          lastCheckedAt: p.lastCheckedAt,
        }));
    },

    startDeployment({ projectId, environmentId, gitSha, actorId, provider = 'vercel' }) {
      assertProjectAccess(projectId, actorId, 'deploy:write');
      const env = environments.get(environmentId);
      if (!env || env.projectId !== projectId) throw new ValidationError('environment_mismatch');
      if (!gitSha) throw new ValidationError('gitSha_required');
      rateLimit(`deploy:${projectId}`, 20);
      // Previous READY deployment becomes rollback target
      const previous = [...deployments.values()]
        .filter((d) => d.projectId === projectId && d.environmentId === environmentId && d.status === 'READY')
        .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))[0];
      const deploymentId = mint('deployment');
      const row = {
        deploymentId,
        projectId,
        environmentId,
        gitSha,
        provider,
        providerDeploymentId: `prov_${randomBytes(6).toString('hex')}`,
        status: 'QUEUED',
        startedAt: now(),
        completedAt: null,
        health: null,
        rollbackTarget: previous?.deploymentId || null,
      };
      deployments.set(deploymentId, row);
      auditEvent('deployment.started', deploymentId, actorId, { projectId, environmentId, gitSha });
      return row;
    },

    advanceDeployment(deploymentId, status, actorId) {
      const row = deployments.get(deploymentId);
      if (!row) throw new NotFoundError('deployment_not_found');
      assertProjectAccess(row.projectId, actorId, 'deploy:write');
      const allowed = new Set([
        'QUEUED',
        'BUILDING',
        'DEPLOYING',
        'VERIFYING',
        'READY',
        'FAILED',
        'ROLLED_BACK',
        'CANCELLED',
      ]);
      if (!allowed.has(status)) throw new ValidationError('invalid_deployment_status');
      row.status = status;
      if (status === 'READY' || status === 'FAILED' || status === 'ROLLED_BACK') {
        row.completedAt = now();
        row.health = status === 'READY' ? 'ok' : 'failed';
      }
      auditEvent('deployment.status', deploymentId, actorId, { status });
      return row;
    },

    rollbackDeployment({ deploymentId, actorId }) {
      const row = deployments.get(deploymentId);
      if (!row) throw new NotFoundError('deployment_not_found');
      assertProjectAccess(row.projectId, actorId, 'deploy:write');
      if (!row.rollbackTarget) throw new ValidationError('no_rollback_target');
      const target = deployments.get(row.rollbackTarget);
      if (!target) throw new NotFoundError('rollback_target_missing');
      row.status = 'ROLLED_BACK';
      row.completedAt = now();
      target.status = 'READY';
      target.completedAt = now();
      target.health = 'ok';
      auditEvent('deployment.rolled_back', deploymentId, actorId, { to: target.deploymentId });
      return { rolledBack: row, restored: target };
    },

    listDeployments(projectId, actorId) {
      assertProjectAccess(projectId, actorId, 'deploy:read');
      return [...deployments.values()].filter((d) => d.projectId === projectId);
    },

    addDomain({ projectId, environmentId, domain, actorId }) {
      assertProjectAccess(projectId, actorId, 'project:write');
      const domainId = mint('domain');
      const row = {
        domainId,
        projectId,
        environmentId,
        domain,
        verificationStatus: 'pending',
        tlsStatus: 'pending',
        providerMapping: null,
        createdAt: now(),
      };
      domains.set(domainId, row);
      return row;
    },

    recordUsage({ projectId, environmentId, kind, amount = 1, eventId, actorId }) {
      if (actorId) assertProjectAccess(projectId, actorId, 'usage:read');
      const id = eventId || mint('usage');
      if (usage.some((u) => u.eventId === id)) return usage.find((u) => u.eventId === id);
      const row = {
        eventId: id,
        projectId,
        environmentId: environmentId || null,
        kind,
        amount,
        at: now(),
      };
      usage.push(row);
      return row;
    },

    listUsage(projectId, actorId, { limit = 50 } = {}) {
      assertProjectAccess(projectId, actorId, 'usage:read');
      return usage.filter((u) => u.projectId === projectId).slice(-limit);
    },

    setQuota(kind, max) {
      quotas.set(kind, max);
    },

    listAudit({ projectId, organizationId, limit = 50 } = {}) {
      let rows = audit.slice();
      if (projectId) rows = rows.filter((a) => a.details?.projectId === projectId || a.resource === projectId);
      if (organizationId) rows = rows.filter((a) => a.details?.organizationId === organizationId || a.resource === organizationId);
      return rows.slice(-limit);
    },

    /** Cross-tenant probe helper for tests */
    _unsafePeekProject(projectId) {
      return projects.get(projectId) || null;
    },
  };
}

export { ROLES, ENV_KINDS, ROLE_PERMS };
