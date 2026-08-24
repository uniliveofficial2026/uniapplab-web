/**
 * @unilives/platform-core — control plane domain + provider registry foundation.
 * Secrets are referenced, never embedded.
 */

function nowIso() {
  return new Date().toISOString();
}

function mint(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** @typedef {'organization_owner'|'organization_admin'|'developer'|'operator'|'viewer'} PlatformRole */
/** @typedef {'development'|'preview'|'production'} EnvironmentKind */
/** @typedef {'rtc'|'database'|'auth'|'storage'|'realtime'|'functions'|'deployment'|'git'|'notification'|'ai'} ProviderKind */

/**
 * @typedef {{ secretRef: string, provider?: string, description?: string }} SecretRef
 */

/**
 * In-memory control plane store (foundation). Persist via adapters later.
 */
export function createControlPlaneStore() {
  /** @type {Map<string, any>} */
  const orgs = new Map();
  /** @type {Map<string, any>} */
  const projects = new Map();
  /** @type {Map<string, any>} */
  const environments = new Map();
  /** @type {Map<string, any>} */
  const members = new Map();
  /** @type {Map<string, any>} */
  const providerConnections = new Map();
  /** @type {Map<string, any>} */
  const deployments = new Map();
  /** @type {Map<string, any>} */
  const apiCredentials = new Map();
  /** @type {any[]} */
  const audit = [];
  /** @type {any[]} */
  const usage = [];

  function auditEvent(action, resource, actor, properties = {}) {
    const row = {
      eventId: mint('aud'),
      action,
      resource,
      actor: actor || 'system',
      timestamp: nowIso(),
      traceId: properties.traceId || mint('trace'),
      properties: { ...properties },
    };
    // Never store secret values
    delete row.properties.secret;
    delete row.properties.token;
    delete row.properties.apiKey;
    audit.push(row);
    return row;
  }

  return {
    createOrganization({ name, actor }) {
      const id = mint('org');
      const row = { organizationId: id, name, createdAt: nowIso() };
      orgs.set(id, row);
      auditEvent('project.created', id, actor, { kind: 'organization', name });
      return row;
    },
    createProject({ organizationId, name, actor }) {
      if (!orgs.has(organizationId)) throw Object.assign(new Error('org_not_found'), { code: 'ORG_NOT_FOUND' });
      const id = mint('project');
      const row = {
        projectId: id,
        organizationId,
        name,
        createdAt: nowIso(),
      };
      projects.set(id, row);
      for (const kind of /** @type {EnvironmentKind[]} */ (['development', 'preview', 'production'])) {
        const envId = mint('env');
        environments.set(envId, {
          environmentId: envId,
          projectId: id,
          kind,
          createdAt: nowIso(),
          providers: {},
        });
      }
      auditEvent('project.created', id, actor, { organizationId, name });
      return row;
    },
    getProject(projectId) {
      return projects.get(projectId) || null;
    },
    listProjects(organizationId) {
      return [...projects.values()].filter((p) => !organizationId || p.organizationId === organizationId);
    },
    listEnvironments(projectId) {
      return [...environments.values()].filter((e) => e.projectId === projectId);
    },
    addMember({ organizationId, userId, role = /** @type {PlatformRole} */ ('developer'), actor }) {
      const id = mint('member');
      const row = { memberId: id, organizationId, userId, role, createdAt: nowIso() };
      members.set(id, row);
      auditEvent('member.added', id, actor, { organizationId, userId, role });
      return row;
    },
    /**
     * @param {{ projectId: string, environmentId: string, kind: ProviderKind, provider: string, secretRef?: string, config?: Record<string, unknown>, actor?: string }} input
     */
    connectProvider(input) {
      const id = mint('pconn');
      const row = {
        connectionId: id,
        projectId: input.projectId,
        environmentId: input.environmentId,
        kind: input.kind,
        provider: input.provider,
        secretRef: input.secretRef || null,
        config: input.config || {},
        createdAt: nowIso(),
      };
      providerConnections.set(id, row);
      const env = environments.get(input.environmentId);
      if (env) env.providers[input.kind] = id;
      auditEvent('provider.config.changed', id, input.actor, {
        kind: input.kind,
        provider: input.provider,
        secretRef: input.secretRef || undefined,
      });
      return row;
    },
    /**
     * @param {{ projectId: string, environmentId: string, gitSha: string, provider?: string, actor?: string }} input
     */
    startDeployment(input) {
      const id = mint('deployment');
      const row = {
        deploymentId: id,
        projectId: input.projectId,
        environmentId: input.environmentId,
        gitSha: input.gitSha,
        provider: input.provider || 'vercel',
        providerDeploymentId: null,
        status: 'started',
        startedAt: nowIso(),
        completedAt: null,
        rollbackTarget: null,
      };
      deployments.set(id, row);
      auditEvent('deployment.started', id, input.actor, { gitSha: input.gitSha });
      return row;
    },
    completeDeployment(deploymentId, { providerDeploymentId, status = 'completed', actor } = {}) {
      const row = deployments.get(deploymentId);
      if (!row) throw Object.assign(new Error('deployment_not_found'), { code: 'DEPLOYMENT_NOT_FOUND' });
      row.status = status;
      row.providerDeploymentId = providerDeploymentId || row.providerDeploymentId;
      row.completedAt = nowIso();
      auditEvent(status === 'rolled_back' ? 'deployment.rolled_back' : 'deployment.completed', deploymentId, actor, {
        status,
      });
      return row;
    },
    /**
     * Public project key or server credential reference — never raw secrets.
     * @param {{ projectId: string, kind: 'public'|'server'|'developer'|'mcp', scopes?: string[], actor?: string }} input
     */
    createApiCredential(input) {
      const id = mint('cred');
      const publicId = mint(input.kind === 'public' ? 'pk' : 'sk');
      const row = {
        credentialId: id,
        projectId: input.projectId,
        kind: input.kind,
        publicId,
        secretRef: `secret://${id}`,
        scopes: input.scopes || ['project:read'],
        revoked: false,
        createdAt: nowIso(),
      };
      apiCredentials.set(id, row);
      auditEvent('api_key.created', id, input.actor, { kind: input.kind, publicId, scopes: row.scopes });
      return { credentialId: id, publicId, secretRef: row.secretRef, scopes: row.scopes };
    },
    revokeApiCredential(credentialId, actor) {
      const row = apiCredentials.get(credentialId);
      if (!row) return null;
      row.revoked = true;
      auditEvent('api_key.revoked', credentialId, actor, { publicId: row.publicId });
      return row;
    },
    authorize({ credentialPublicId, projectId, requiredScope }) {
      const cred = [...apiCredentials.values()].find((c) => c.publicId === credentialPublicId && !c.revoked);
      if (!cred) return { ok: false, reason: 'invalid_credential' };
      if (projectId && cred.projectId !== projectId) return { ok: false, reason: 'project_mismatch' };
      if (requiredScope && !cred.scopes.includes(requiredScope) && !cred.scopes.includes('*')) {
        return { ok: false, reason: 'scope_denied' };
      }
      return { ok: true, credential: { credentialId: cred.credentialId, projectId: cred.projectId, kind: cred.kind } };
    },
    recordUsage(row) {
      const entry = {
        usageId: mint('usage'),
        recordedAt: nowIso(),
        ...row,
      };
      usage.push(entry);
      return entry;
    },
    listAudit({ limit = 50 } = {}) {
      return audit.slice(-limit);
    },
    listUsage({ limit = 50 } = {}) {
      return usage.slice(-limit);
    },
  };
}

/**
 * Provider registry — maps UniLive capability → adapter id (no fake adapters).
 */
export function createProviderRegistry() {
  /** @type {Map<string, { kind: ProviderKind, provider: string, status: string, adapterPackage?: string }>} */
  const entries = new Map();

  const defaults = [
    { kind: /** @type {ProviderKind} */ ('rtc'), provider: 'livekit', status: 'active', adapterPackage: '@unilives/rtc-livekit' },
    { kind: /** @type {ProviderKind} */ ('auth'), provider: 'supabase', status: 'active', adapterPackage: '@unilives/auth' },
    { kind: /** @type {ProviderKind} */ ('database'), provider: 'supabase', status: 'active', adapterPackage: '@unilives/database' },
    { kind: /** @type {ProviderKind} */ ('storage'), provider: 'cloudflare-r2', status: 'active', adapterPackage: '@unilives/storage' },
    { kind: /** @type {ProviderKind} */ ('realtime'), provider: 'supabase', status: 'active', adapterPackage: '@unilives/realtime' },
    { kind: /** @type {ProviderKind} */ ('deployment'), provider: 'vercel', status: 'active', adapterPackage: '@unilives/deploy' },
    { kind: /** @type {ProviderKind} */ ('git'), provider: 'github', status: 'active', adapterPackage: '@unilives/git' },
    { kind: /** @type {ProviderKind} */ ('functions'), provider: 'vercel', status: 'foundation', adapterPackage: '@unilives/functions' },
  ];
  for (const d of defaults) entries.set(`${d.kind}:${d.provider}`, d);

  return {
    list() {
      return [...entries.values()];
    },
    get(kind, provider) {
      return entries.get(`${kind}:${provider}`) || null;
    },
    resolve(kind) {
      return [...entries.values()].find((e) => e.kind === kind && e.status === 'active') || null;
    },
    register(entry) {
      const key = `${entry.kind}:${entry.provider}`;
      entries.set(key, entry);
      return entry;
    },
  };
}

/**
 * Machine-readable ProjectGraph foundation (Builder/Studio/CLI/MCP shared model).
 * @param {{ projectId: string, name?: string }} input
 */
export function createProjectGraph(input) {
  return {
    version: 1,
    projectId: input.projectId,
    name: input.name || input.projectId,
    pages: [],
    routes: [],
    components: [],
    dataSources: [],
    bindings: {
      data: [],
      actions: [],
      permissions: [],
      auth: [],
      rtc: [],
      storage: [],
      deployment: [],
    },
    addPage(page) {
      this.pages.push({ pageId: page.pageId || mint('page'), ...page });
      return this.pages[this.pages.length - 1];
    },
    addRoute(route) {
      this.routes.push({ routeId: route.routeId || mint('route'), ...route });
      return this.routes[this.routes.length - 1];
    },
    addComponent(component) {
      this.components.push({ componentId: component.componentId || mint('cmp'), ...component });
      return this.components[this.components.length - 1];
    },
    toJSON() {
      return {
        version: this.version,
        projectId: this.projectId,
        name: this.name,
        pages: this.pages,
        routes: this.routes,
        components: this.components,
        dataSources: this.dataSources,
        bindings: this.bindings,
      };
    },
  };
}

/**
 * RTC usage metering (provider-independent truth).
 */
export function createRtcUsageMeter() {
  /** @type {Map<string, any>} */
  const roomSessions = new Map();
  /** @type {Map<string, any>} */
  const participantSessions = new Map();
  /** @type {Map<string, any>} */
  const trackSessions = new Map();
  /** @type {Set<string>} */
  const seen = new Set();

  return {
    /**
     * Idempotent event apply.
     * @param {{ eventId: string, type: string, roomId?: string, roomType?: string, provider?: string, canonicalUserId?: string, role?: string, trackId?: string, kind?: string, bytes?: number }} evt
     */
    apply(evt) {
      if (seen.has(evt.eventId)) return { duplicate: true };
      seen.add(evt.eventId);
      const now = nowIso();
      if (evt.type === 'room_started') {
        roomSessions.set(evt.roomId || evt.eventId, {
          roomId: evt.roomId,
          roomType: evt.roomType,
          provider: evt.provider || 'livekit',
          startedAt: now,
          endedAt: null,
          peakParticipants: 0,
        });
      }
      if (evt.type === 'participant_joined') {
        const key = `${evt.roomId}:${evt.canonicalUserId}`;
        participantSessions.set(key, {
          roomId: evt.roomId,
          canonicalUserId: evt.canonicalUserId,
          role: evt.role,
          joinedAt: now,
          leftAt: null,
        });
        const room = roomSessions.get(evt.roomId);
        if (room) {
          const active = [...participantSessions.values()].filter((p) => p.roomId === evt.roomId && !p.leftAt).length;
          room.peakParticipants = Math.max(room.peakParticipants, active);
        }
      }
      if (evt.type === 'participant_left') {
        const key = `${evt.roomId}:${evt.canonicalUserId}`;
        const row = participantSessions.get(key);
        if (row) row.leftAt = now;
      }
      if (evt.type === 'track_published') {
        trackSessions.set(evt.trackId || evt.eventId, {
          trackId: evt.trackId,
          roomId: evt.roomId,
          kind: evt.kind,
          startedAt: now,
          endedAt: null,
          bytes: 0,
        });
      }
      if (evt.type === 'track_unpublished') {
        const row = trackSessions.get(evt.trackId);
        if (row) {
          row.endedAt = now;
          row.bytes = (row.bytes || 0) + (evt.bytes || 0);
        }
      }
      if (evt.type === 'room_ended') {
        const room = roomSessions.get(evt.roomId);
        if (room) room.endedAt = now;
      }
      return { duplicate: false };
    },
    rollup() {
      return {
        rooms: [...roomSessions.values()],
        participants: [...participantSessions.values()],
        tracks: [...trackSessions.values()],
        metrics: {
          roomCount: roomSessions.size,
          participantSessionCount: participantSessions.size,
          trackSessionCount: trackSessions.size,
        },
      };
    },
  };
}

/**
 * Trace correlation helper (no sensitive payloads).
 */
export function createTraceContext(partial = {}) {
  return {
    traceId: partial.traceId || mint('trace'),
    canonicalUserId: partial.canonicalUserId || null,
    sessionId: partial.sessionId || null,
    roomId: partial.roomId || null,
    callId: partial.callId || null,
    pkId: partial.pkId || null,
    giftEventId: partial.giftEventId || null,
    deploymentId: partial.deploymentId || null,
  };
}
