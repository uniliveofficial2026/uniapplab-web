import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createControlPlaneStore, createProviderRegistry } from '@unilives/platform-core';
import { createUniLive } from '@unilives/sdk';
import { createUniLiveMcpServer } from '@unilives/mcp';
import { createUniLiveObserve } from '@unilives/observe';
import { createBuilderSession, GRAPH_FILENAME } from '@unilives/builder';
import { createFromTemplate, listTemplates } from '@unilives/templates';
import { createUniLiveDeploy } from '@unilives/deploy';
import { createUniLiveDatabase } from '@unilives/database';
import { createUniLiveStorage } from '@unilives/storage';
import { createFakeRTCProvider } from '@unilives/rtc-fake';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

/**
 * @param {{ port?: number, host?: string, projectsDir?: string, controlPlane?: ReturnType<typeof createControlPlaneStore> }} [options]
 */
export function startStudioServer(options = {}) {
  const port = Number(options.port) || 8787;
  const host = options.host || '127.0.0.1';
  const projectsDir = options.projectsDir || join(process.cwd(), '.unilive', 'projects');
  const controlPlane = options.controlPlane || createControlPlaneStore();
  const registry = createProviderRegistry();
  const observe = createUniLiveObserve();
  const mcp = createUniLiveMcpServer({ controlPlane, requireAuth: false });
  const deploy = createUniLiveDeploy({ controlPlane });
  const database = createUniLiveDatabase({ controlPlane });
  const storage = createUniLiveStorage({ controlPlane });
  /** @type {Map<string, ReturnType<typeof createBuilderSession>>} */
  const sessions = new Map();

  observe.log('info', 'studio.starting', { port, host, projectsDir });

  async function serveStatic(req, res, url) {
    let rel = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = join(PUBLIC_DIR, rel);
    if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) {
      sendJson(res, 404, { ok: false, error: 'not_found' });
      return;
    }
    const ext = extname(filePath);
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(body);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${host}:${port}`);
    try {
      if (url.pathname === '/api/health' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, service: 'unilives-studio', port });
      }

      if (url.pathname === '/api/projects' && req.method === 'GET') {
        const projects = controlPlane.listProjects();
        return sendJson(res, 200, { ok: true, projects });
      }

      if (url.pathname === '/api/projects' && req.method === 'POST') {
        const body = await readBody(req);
        const org = controlPlane.createOrganization({
          name: `${body.name || 'app'}-org`,
          actor: 'studio',
        });
        const project = controlPlane.createProject({
          organizationId: org.organizationId,
          name: body.name || 'unilive-app',
          actor: 'studio',
        });
        if (body.template) {
          await createFromTemplate(body.template, {
            projectId: project.projectId,
            outDir: join(projectsDir, project.projectId),
          });
        }
        observe.log('info', 'project.created', { projectId: project.projectId });
        return sendJson(res, 201, { ok: true, project, organization: org });
      }

      if (url.pathname === '/api/templates' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, templates: listTemplates() });
      }

      if (url.pathname === '/api/builder/palette' && req.method === 'GET') {
        const session = createBuilderSession({ projectsDir });
        return sendJson(res, 200, { ok: true, palette: session.getComponentPalette() });
      }

      if (url.pathname === '/api/builder/sessions' && req.method === 'POST') {
        const body = await readBody(req);
        const session = createBuilderSession({ projectsDir, previewSize: body.previewSize });
        sessions.set(session.sessionId, session);
        if (body.projectId) {
          if (body.create) await session.createProject({ projectId: body.projectId, name: body.name });
          else await session.openProject({ projectId: body.projectId });
        }
        return sendJson(res, 201, {
          ok: true,
          sessionId: session.sessionId,
          projectId: session.projectId,
          graph: session.projectId ? session.toJSON() : null,
        });
      }

      const sessionMatch = url.pathname.match(/^\/api\/builder\/sessions\/([^/]+)(\/.*)?$/);
      if (sessionMatch) {
        const session = sessions.get(sessionMatch[1]);
        if (!session) return sendJson(res, 404, { ok: false, error: 'session_not_found' });
        const sub = sessionMatch[2] || '';
        const body = req.method === 'GET' ? {} : await readBody(req);

        if (sub === '' && req.method === 'GET') {
          return sendJson(res, 200, {
            ok: true,
            sessionId: session.sessionId,
            projectId: session.projectId,
            preview: session.getPreviewFrame(),
            graph: session.projectId ? session.toJSON() : null,
          });
        }
        if (sub === '/save' && req.method === 'POST') {
          const saved = await session.save();
          return sendJson(res, 200, { ok: true, ...saved });
        }
        if (sub === '/undo' && req.method === 'POST') {
          return sendJson(res, 200, { ok: true, undone: session.undo(), graph: session.toJSON() });
        }
        if (sub === '/redo' && req.method === 'POST') {
          return sendJson(res, 200, { ok: true, redone: session.redo(), graph: session.toJSON() });
        }
        if (sub === '/generate' && req.method === 'GET') {
          return sendJson(res, 200, { ok: true, source: session.generateAppSource() });
        }
        if (sub === '/preview-size' && req.method === 'POST') {
          const frame = session.setPreviewSize(body.size || 'desktop');
          return sendJson(res, 200, { ok: true, preview: frame });
        }
        if (sub === '/page' && req.method === 'POST') {
          const page = session.addPage(body);
          return sendJson(res, 200, { ok: true, page, graph: session.toJSON() });
        }
        if (sub === '/component' && req.method === 'POST') {
          const cmp = body.fromPalette
            ? session.addComponentFromPalette(body)
            : session.addComponent(body);
          return sendJson(res, 200, { ok: true, component: cmp, graph: session.toJSON() });
        }
        if (sub === '/place' && req.method === 'POST') {
          const node = session.placeComponent(body);
          return sendJson(res, 200, { ok: true, node, graph: session.toJSON() });
        }
        if (sub === '/bind' && req.method === 'POST') {
          const node = session.bindAction(body);
          return sendJson(res, 200, { ok: true, node, graph: session.toJSON() });
        }
      }

      if (url.pathname === '/api/data' && req.method === 'GET') {
        const health = await database.health();
        return sendJson(res, 200, {
          ok: true,
          panel: 'data',
          health,
          provider: database.provider,
          note: 'Schema/resources MVP — full SQL IDE is FUTURE',
        });
      }

      if (url.pathname === '/api/rtc' && req.method === 'GET') {
        const provider = createFakeRTCProvider({ identity: 'studio' });
        const session = await provider.joinRoom({ roomName: 'studio-probe', token: 'x', url: 'fake://' });
        await provider.leaveRoom();
        return sendJson(res, 200, {
          ok: true,
          panel: 'rtc',
          provider: registry.resolve('rtc')?.provider || 'fake',
          probe: { roomSessionId: session.roomSessionId },
        });
      }

      if (url.pathname === '/api/storage' && req.method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          panel: 'storage',
          provider: storage.provider,
          driverConfigured: false,
        });
      }

      if (url.pathname === '/api/deploy' && req.method === 'GET') {
        const projects = controlPlane.listProjects();
        const projectId = projects[0]?.projectId;
        const envs = projectId ? controlPlane.listEnvironments(projectId) : [];
        return sendJson(res, 200, {
          ok: true,
          panel: 'deploy',
          provider: deploy.provider,
          projectId: projectId || null,
          environments: envs.map((e) => e.kind),
        });
      }

      if (url.pathname === '/api/logs' && req.method === 'GET') {
        const limit = Number(url.searchParams.get('limit') || 50);
        const config = { projectId: controlPlane.listProjects()[0]?.projectId || 'studio' };
        const uni = createUniLive({ projectId: config.projectId, controlPlane });
        const sdkLogs = await uni.observe.getLogs({ limit });
        const studioLogs = observe.getLogs({ limit });
        return sendJson(res, 200, { ok: true, panel: 'logs', logs: [...studioLogs, ...sdkLogs].slice(-limit) });
      }

      if (url.pathname === '/api/settings' && req.method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          panel: 'settings',
          projectsDir,
          graphFile: GRAPH_FILENAME,
          providers: registry.list(),
          mcpTools: mcp.listTools().length,
        });
      }

      if (url.pathname.startsWith('/api/')) {
        return sendJson(res, 404, { ok: false, error: 'api_not_found', path: url.pathname });
      }

      return serveStatic(req, res, url);
    } catch (err) {
      observe.log('error', 'studio.request_failed', { path: url.pathname, message: String(err?.message || err) });
      return sendJson(res, 500, { ok: false, error: err?.code || 'internal_error', message: String(err?.message || err) });
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      observe.log('info', 'studio.listening', { url: `http://${host}:${actualPort}` });
      resolve({
        server,
        port: actualPort,
        host,
        url: `http://${host}:${actualPort}`,
        close() {
          return new Promise((res, rej) => server.close((e) => (e ? rej(e) : res(undefined))));
        },
      });
    });
  });
}

export { PUBLIC_DIR };
