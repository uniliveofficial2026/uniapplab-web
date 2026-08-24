import { createControlPlaneStore, createProviderRegistry } from '@unilives/platform-core';
import { createUniLive, PLATFORM_VERSION as SDK_VERSION } from '@unilives/sdk';
import { PLATFORM_VERSION as RELEASE_VERSION } from '@unilives/release';
import { createFakeRTCProvider } from '@unilives/rtc-fake';
import { createUniLiveMcpServer } from '@unilives/mcp';
import { createFromTemplate, listTemplates } from '@unilives/templates';
import { startStudioServer } from '@unilives/studio';
import { createUniLiveCloud } from '@unilives/cloud';
import {
  initSelfHost,
  getSelfHostStatus,
  backupSelfHost,
  restoreSelfHost,
  upgradePreflight,
} from '@unilives/selfhost';
import { createMarketplaceRegistry } from '@unilives/marketplace';
import { createPlanner } from '@unilives/ai-builder';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PLATFORM_VERSION = RELEASE_VERSION || SDK_VERSION;

/**
 * UniLive CLI — Stage C + Stage D cloud / self-host / marketplace commands.
 */
export function createUniLiveCli(options = {}) {
  const cwd = options.cwd || process.cwd();
  const controlPlane = options.controlPlane || createControlPlaneStore();
  const cloud = options.cloud || createUniLiveCloud({ controlPlane });
  const marketplace = options.marketplace || createMarketplaceRegistry();
  const registry = createProviderRegistry();
  const configPath = resolve(cwd, '.unilive.json');

  function loadLocalConfig() {
    if (!existsSync(configPath)) return null;
    try {
      return JSON.parse(readFileSync(configPath, 'utf8'));
    } catch {
      return null;
    }
  }

  function writeConfig(config) {
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  }

  return {
    version() {
      return { ok: true, version: PLATFORM_VERSION, platform: 'UniLive', name: '@unilives/cli' };
    },

    async login() {
      return {
        ok: true,
        status: 'local_dev',
        note: 'Use unilive init / unilive create for local credentials (no cloud required)',
      };
    },

    async logout() {
      return { ok: true, status: 'logged_out_local' };
    },

    async whoami() {
      const config = loadLocalConfig();
      return {
        ok: true,
        projectId: config?.projectId || null,
        organizationId: config?.organizationId || null,
        credentialPublicId: config?.credentialPublicId || null,
        authenticated: Boolean(config?.credentialPublicId),
      };
    },

    async init({ name = 'unilive-app' } = {}) {
      const org = controlPlane.createOrganization({ name: `${name}-org`, actor: 'cli' });
      const project = controlPlane.createProject({
        organizationId: org.organizationId,
        name,
        actor: 'cli',
      });
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
        environment: 'local',
        createdAt: new Date().toISOString(),
      };
      writeConfig(config);
      return { ok: true, config, path: configPath };
    },

    async create({ name = 'my-app', template = 'basic', outDir } = {}) {
      const dir = resolve(cwd, outDir || name);
      mkdirSync(dir, { recursive: true });
      const projectId = `project_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const result = await createFromTemplate(template, { projectId, outDir: dir });
      const org = controlPlane.createOrganization({ name: `${name}-org`, actor: 'cli' });
      const project = controlPlane.createProject({
        organizationId: org.organizationId,
        name,
        actor: 'cli',
      });
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
        template,
        environment: 'local',
        createdAt: new Date().toISOString(),
      };
      writeFileSync(join(dir, '.unilive.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
      writeConfig(config);
      return {
        ok: true,
        template,
        outDir: dir,
        projectId: project.projectId,
        templates: listTemplates().map((t) => t.id),
        generated: result,
      };
    },

    async doctor() {
      const config = loadLocalConfig();
      const providers = registry.list();
      const node = process.versions.node;
      return {
        ok: true,
        version: PLATFORM_VERSION,
        cwd,
        node,
        configPresent: Boolean(config),
        projectId: config?.projectId || null,
        providers: providers.map((p) => ({ kind: p.kind, provider: p.provider, status: p.status })),
        checks: {
          platformCore: true,
          rtcFake: true,
          templates: listTemplates().filter((t) => t.status === 'released').length >= 6,
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
      return { ok: true, status: 'delegated', hint: 'Use repository supabase migration workflow or unilive start --local' };
    },

    async build() {
      return { ok: true, status: 'delegated', hint: 'pnpm --filter @workspace/instacollab run build' };
    },

    async test() {
      return { ok: true, status: 'delegated', hint: 'pnpm run test:stage-c && pnpm run test:stage-b' };
    },

    async deploy({ projectId, environmentId, gitSha } = {}) {
      const config = loadLocalConfig();
      const actorId = config?.credentialPublicId || 'cli';
      if (projectId && environmentId && gitSha) {
        const deployment = cloud.startDeployment({
          projectId,
          environmentId,
          gitSha,
          actorId: config?.ownerActorId || actorId,
        });
        return { ok: true, deployment };
      }
      return {
        ok: true,
        status: 'delegated',
        hint: 'unilive deploy --project <id> --env <envId> --sha <gitSha> or use control-plane Studio',
      };
    },

    async logs() {
      const config = loadLocalConfig();
      const uni = createUniLive({
        projectId: config?.projectId || 'project_local',
        controlPlane,
        credentialPublicId: config?.credentialPublicId,
        environment: 'local',
      });
      return { ok: true, logs: await uni.observe.getLogs() };
    },

    async projectList() {
      const config = loadLocalConfig();
      if (config?.cloudOrganizationId && config?.ownerActorId) {
        return {
          ok: true,
          projects: cloud.listProjects(config.cloudOrganizationId, config.ownerActorId),
        };
      }
      return { ok: true, projects: controlPlane.listProjects() };
    },

    async cloudInit({ name = 'cloud-org', actorId = 'cli_owner' } = {}) {
      const org = cloud.createOrganization({ name, ownerActorId: actorId });
      const { project, environments } = cloud.createProject({
        organizationId: org.organizationId,
        name: `${name}-project`,
        actorId,
      });
      const config = {
        ...(loadLocalConfig() || {}),
        cloudOrganizationId: org.organizationId,
        projectId: project.projectId,
        ownerActorId: actorId,
        environments: environments.map((e) => ({ environmentId: e.environmentId, kind: e.kind })),
        createdAt: new Date().toISOString(),
      };
      writeConfig(config);
      return { ok: true, org, project, environments, path: configPath };
    },

    async marketplaceList({ query } = {}) {
      const items = query ? marketplace.search(query) : marketplace.list();
      return { ok: true, items };
    },

    async aiPlan({ requirement = 'Create a basic social feed page' } = {}) {
      const planner = createPlanner();
      const result = await planner.buildFromRequirement({
        projectId: loadLocalConfig()?.projectId || 'project_cli',
        requirement,
      });
      return { ok: true, ...result };
    },

    async selfHostInit({ outDir } = {}) {
      const dataDir = resolve(cwd, outDir || '.unilive-selfhost');
      const result = await initSelfHost({ dataDir });
      return { ok: true, ...result };
    },

    async selfHostStatus({ rootDir, json = true } = {}) {
      const dataDir = resolve(cwd, rootDir || '.unilive-selfhost');
      return { ok: true, ...(await getSelfHostStatus({ dataDir, json })) };
    },

    async selfHostBackup({ rootDir } = {}) {
      const dataDir = resolve(cwd, rootDir || '.unilive-selfhost');
      return { ok: true, ...(await backupSelfHost({ dataDir })) };
    },

    async selfHostRestore({ rootDir, backupId, backupPath } = {}) {
      const dataDir = resolve(cwd, rootDir || '.unilive-selfhost');
      const path = backupPath || backupId;
      if (!path) return { ok: false, error: 'backupPath_required' };
      return { ok: true, ...(await restoreSelfHost({ dataDir, backupPath: resolve(cwd, path) })) };
    },

    async selfHostUpgrade({ rootDir } = {}) {
      const dataDir = resolve(cwd, rootDir || '.unilive-selfhost');
      return { ok: true, ...(await upgradePreflight({ dataDir })) };
    },

    async projectUse({ projectId } = {}) {
      if (!projectId) return { ok: false, error: 'projectId_required' };
      const config = loadLocalConfig() || {};
      config.projectId = projectId;
      writeConfig(config);
      return { ok: true, projectId, path: configPath };
    },

    async start({ local = true } = {}) {
      const script = join(ROOT, 'scripts', 'unilive-local.mjs');
      return {
        ok: true,
        status: 'spawn_hint',
        command: `node ${script} start ${local ? '--local' : ''} --json`,
        note: 'Prefer: node scripts/unilive-local.mjs start',
      };
    },

    async dev() {
      return this.start({ local: true });
    },

    async studio({ port = 8787 } = {}) {
      const server = startStudioServer({
        port,
        projectsDir: join(cwd, '.unilive', 'projects'),
        controlPlane,
      });
      return {
        ok: true,
        url: `http://127.0.0.1:${port}`,
        port,
        close: () =>
          new Promise((resolveClose) => {
            server.close(() => resolveClose());
          }),
      };
    },

    async mcpList() {
      const mcp = createUniLiveMcpServer({ controlPlane, requireAuth: false });
      return { ok: true, tools: mcp.listTools() };
    },
  };
}

export { PLATFORM_VERSION };
