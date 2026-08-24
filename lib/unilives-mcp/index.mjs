import { createControlPlaneStore, createProviderRegistry, createRtcUsageMeter } from '@unilives/platform-core';
import { createFakeRTCProvider } from '@unilives/rtc-fake';
import { createCallOrchestrator, createPkOrchestrator } from '@unilives/rtc-core';

/**
 * UniLive MCP tool surface. Every tool requires authorization.
 * Never returns provider secrets.
 *
 * @param {{
 *   controlPlane?: ReturnType<typeof createControlPlaneStore>,
 *   credentialPublicId?: string,
 *   requireAuth?: boolean,
 * }} [options]
 */
export function createUniLiveMcpServer(options = {}) {
  const controlPlane = options.controlPlane || createControlPlaneStore();
  const registry = createProviderRegistry();
  const usageMeter = createRtcUsageMeter();
  const requireAuth = options.requireAuth !== false;
  const callOrch = createCallOrchestrator();
  const pkOrch = createPkOrchestrator();
  /** @type {Map<string, import('@unilives/rtc-contracts').UniLivesRTCProvider>} */
  const rtcRooms = new Map();

  function authorize(scope, projectId) {
    if (!requireAuth) return { ok: true };
    if (!options.credentialPublicId) return { ok: false, reason: 'mcp_auth_required' };
    return controlPlane.authorize({
      credentialPublicId: options.credentialPublicId,
      projectId,
      requiredScope: scope,
    });
  }

  function deny(reason) {
    return { ok: false, error: reason || 'unauthorized' };
  }

  const tools = {
    async create_project({ organizationId, name, actor }) {
      const auth = authorize('project:write', null);
      if (!auth.ok) return deny(auth.reason);
      let orgId = organizationId;
      if (!orgId) {
        const org = controlPlane.createOrganization({ name: `${name}-org`, actor });
        orgId = org.organizationId;
      }
      const project = controlPlane.createProject({ organizationId: orgId, name, actor });
      return { ok: true, project };
    },

    async get_project({ projectId }) {
      const auth = authorize('project:read', projectId);
      if (!auth.ok) return deny(auth.reason);
      return { ok: true, project: controlPlane.getProject(projectId) };
    },

    async list_projects({ organizationId }) {
      const auth = authorize('project:read', null);
      if (!auth.ok) return deny(auth.reason);
      return { ok: true, projects: controlPlane.listProjects(organizationId) };
    },

    async create_rtc_room({ roomId, roomType = 'LIVE', identity = 'mcp-user', projectId }) {
      const auth = authorize('rtc:write', projectId);
      if (!auth.ok) return deny(auth.reason);
      const provider = createFakeRTCProvider({ identity, roomType });
      const session = await provider.joinRoom({ roomName: roomId, token: 'mcp', url: 'fake://' });
      rtcRooms.set(roomId, provider);
      usageMeter.apply({
        eventId: `mcp-room-${roomId}-${Date.now()}`,
        type: 'room_started',
        roomId,
        roomType,
        provider: 'fake',
      });
      controlPlane.recordUsage({ kind: 'rtc_room', roomId, projectId });
      return {
        ok: true,
        room: { roomId, roomType, roomSessionId: session.roomSessionId, provider: 'fake' },
      };
    },

    async end_rtc_room({ roomId, projectId }) {
      const auth = authorize('rtc:write', projectId);
      if (!auth.ok) return deny(auth.reason);
      const provider = rtcRooms.get(roomId);
      if (provider) {
        await provider.leaveRoom();
        rtcRooms.delete(roomId);
      }
      usageMeter.apply({
        eventId: `mcp-room-end-${roomId}-${Date.now()}`,
        type: 'room_ended',
        roomId,
        provider: 'fake',
      });
      return { ok: true };
    },

    async get_rtc_stats({ roomId, projectId }) {
      const auth = authorize('rtc:read', projectId);
      if (!auth.ok) return deny(auth.reason);
      const provider = rtcRooms.get(roomId);
      const stats = provider ? await provider.getStats() : null;
      return { ok: true, roomId, stats, usage: usageMeter.rollup().metrics };
    },

    async inspect_database({ projectId }) {
      const auth = authorize('database:read', projectId);
      if (!auth.ok) return deny(auth.reason);
      return {
        ok: true,
        provider: registry.resolve('database')?.provider,
        note: 'Use migrations via UniLive database boundary; no secrets returned',
      };
    },

    async create_storage_bucket({ name, projectId }) {
      const auth = authorize('storage:write', projectId);
      if (!auth.ok) return deny(auth.reason);
      return {
        ok: true,
        bucket: { bucketId: `bucket_${name}`, name, provider: registry.resolve('storage')?.provider },
      };
    },

    async run_tests({ suite = 'stage-b-unit' }) {
      const auth = authorize('ci:run', null);
      if (!auth.ok) return deny(auth.reason);
      return { ok: true, suite, status: 'delegated', hint: 'pnpm --filter scripts run test:stage-b' };
    },

    async run_build({ target = 'web' }) {
      const auth = authorize('ci:run', null);
      if (!auth.ok) return deny(auth.reason);
      return { ok: true, target, status: 'delegated' };
    },

    async create_deployment({ projectId, environmentId, gitSha, actor }) {
      const auth = authorize('deploy:write', projectId);
      if (!auth.ok) return deny(auth.reason);
      const deployment = controlPlane.startDeployment({ projectId, environmentId, gitSha, actor });
      return { ok: true, deployment };
    },

    async get_deployment({ deploymentId, projectId }) {
      const auth = authorize('deploy:read', projectId);
      if (!auth.ok) return deny(auth.reason);
      const list = controlPlane.listAudit({ limit: 200 });
      return { ok: true, deploymentId, auditHint: list.filter((a) => a.resource === deploymentId) };
    },

    async get_logs({ projectId, limit = 50 }) {
      const auth = authorize('observe:read', projectId);
      if (!auth.ok) return deny(auth.reason);
      return { ok: true, logs: controlPlane.listAudit({ limit }) };
    },

    async get_metrics({ projectId }) {
      const auth = authorize('observe:read', projectId);
      if (!auth.ok) return deny(auth.reason);
      return { ok: true, metrics: usageMeter.rollup(), usage: controlPlane.listUsage({ limit: 50 }) };
    },

    async inspect_provider_health() {
      const auth = authorize('observe:read', null);
      if (!auth.ok) return deny(auth.reason);
      return {
        ok: true,
        providers: registry.list().map((p) => ({
          kind: p.kind,
          provider: p.provider,
          status: p.status,
          adapterPackage: p.adapterPackage,
        })),
      };
    },

    /** Domain helpers for regression without LiveKit */
    async simulate_call({ callerId, calleeId }) {
      const auth = authorize('rtc:write', null);
      if (!auth.ok) return deny(auth.reason);
      const call = callOrch.create({ callerId, calleeId });
      return { ok: true, call };
    },

    async simulate_pk({ roomId, hostUserId = 'host', opponentUserId = 'opp', durationSec = 180 }) {
      const auth = authorize('rtc:write', null);
      if (!auth.ok) return deny(auth.reason);
      const session = pkOrch.start({ roomId, hostUserId, opponentUserId, durationSec });
      return { ok: true, session };
    },
  };

  return {
    controlPlane,
    tools,
    listTools() {
      return Object.keys(tools);
    },
    async callTool(name, args = {}) {
      const fn = tools[name];
      if (!fn) return { ok: false, error: 'unknown_tool' };
      return fn(args);
    },
  };
}
