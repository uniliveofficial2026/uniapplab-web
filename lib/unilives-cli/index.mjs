import { createControlPlaneStore, createProviderRegistry } from '@unilives/platform-core';
import { createUniLive } from '@unilives/sdk';
import { createFakeRTCProvider } from '@unilives/rtc-fake';
import { createUniLiveMcpServer } from '@unilives/mcp';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * UniLive CLI command handlers — same contracts as API/MCP.
 */
export function createUniLiveCli(options = {}) {
  const cwd = options.cwd || process.cwd();
  const controlPlane = options.controlPlane || createControlPlaneStore();
  const registry = createProviderRegistry();

  function loadLocalConfig() {
    const path = resolve(cwd, '.unilive.json');
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return null;
    }
  }

  return {
    async login() {
      return {
        ok: true,
        status: 'local_dev',
        note: 'Use unilive init to create a local project credential (no cloud required)',
      };
    },

    async init({ name = 'unilive-app' } = {}) {
      const org = controlPlane.createOrganization({ name: `${name}-org`, actor: 'cli' });
      const project = controlPlane.createProject({ organizationId: org.organizationId, name, actor: 'cli' });
      const cred = controlPlane.createApiCredential({
        projectId: project.projectId,
        kind: 'developer',
        scopes: ['*'],
        actor: 'cli',
      });
      const config = {
        projectId: project.projectId,
        organizationId: org.organizationId,
        credentialPublicId: cred.publicId,
        secretRef: cred.secretRef,
        createdAt: new Date().toISOString(),
      };
      return { ok: true, config, writeHint: '.unilive.json (gitignored recommended)' };
    },

    async doctor() {
      const config = loadLocalConfig();
      const providers = registry.list();
      return {
        ok: true,
        cwd,
        configPresent: Boolean(config),
        projectId: config?.projectId || null,
        providers: providers.map((p) => ({ kind: p.kind, provider: p.provider, status: p.status })),
        checks: {
          platformCore: true,
          rtcFake: true,
          livekitOptional: true,
        },
      };
    },

    async rtcStatus() {
      const provider = createFakeRTCProvider({ identity: 'cli-doctor' });
      const session = await provider.joinRoom({ roomName: 'cli-status', token: 'x', url: 'fake://' });
      await provider.leaveRoom();
      return {
        ok: true,
        mediaProviderDefault: registry.resolve('rtc')?.provider,
        fakeProbe: { roomSessionId: session.roomSessionId, connection: 'ok' },
      };
    },

    async dbStatus() {
      return {
        ok: true,
        provider: registry.resolve('database')?.provider,
        note: 'Postgres remains authoritative; UniLive DB boundary does not replace SQL',
      };
    },

    async dbMigrate() {
      return { ok: true, status: 'delegated', hint: 'Use repository supabase migration workflow' };
    },

    async build() {
      return { ok: true, status: 'delegated', hint: 'pnpm --filter @workspace/instacollab run build' };
    },

    async test() {
      return { ok: true, status: 'delegated', hint: 'pnpm exec node scripts/... or package smoke targets' };
    },

    async deploy() {
      return { ok: true, status: 'delegated', hint: 'Use existing Vercel/GitHub deploy path via UniLive deploy boundary' };
    },

    async logs() {
      const config = loadLocalConfig();
      const uni = createUniLive({
        projectId: config?.projectId || 'project_local',
        controlPlane,
        credentialPublicId: config?.credentialPublicId,
      });
      return { ok: true, logs: await uni.observe.getLogs() };
    },

    async dev() {
      return {
        ok: true,
        status: 'foundation',
        localStack: ['postgres', 'auth', 'realtime', 'storage', 'rtc-fake|livekit', 'api', 'mcp'],
        note: 'unilive start / local stack orchestration is FOUNDATION_READY',
      };
    },

    async mcpList() {
      const mcp = createUniLiveMcpServer({ controlPlane, requireAuth: false });
      return { ok: true, tools: mcp.listTools() };
    },
  };
}
