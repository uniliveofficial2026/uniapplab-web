/**
 * Local UniLive platform runtime — in-process stack for Stage C acceptance.
 * Docker Compose provides postgres/minio/livekit when available.
 * In-process mode is a supported DEV SUBSET (documented), not full production parity.
 */
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { createControlPlaneStore } from '@unilives/platform-core';
import { createUniLiveMcpServer } from '@unilives/mcp';
import { createUniLiveObserve } from '@unilives/observe';
import { createFakeRTCProvider } from '@unilives/rtc-fake';
import { startStudioServer } from '@unilives/studio';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function mintSecret() {
  return randomBytes(24).toString('hex');
}

function hash(s) {
  return createHash('sha256').update(String(s)).digest('hex');
}

/**
 * @param {{ rootDir: string, apiPort?: number, studioPort?: number }} options
 */
export async function startLocalPlatform(options) {
  const rootDir = options.rootDir;
  const generatedDir = join(rootDir, 'local', '.generated');
  await mkdir(generatedDir, { recursive: true });

  const secretsPath = join(generatedDir, 'local-secrets.json');
  let secrets = { apiKey: mintSecret(), authPepper: mintSecret() };
  if (existsSync(secretsPath)) {
    try {
      secrets = { ...secrets, ...JSON.parse(readFileSync(secretsPath, 'utf8')) };
    } catch {
      /* regenerate */
    }
  } else {
    await writeFile(secretsPath, JSON.stringify({ note: 'local-only', createdAt: new Date().toISOString() }, null, 2));
    // Do not write raw secrets into tracked docs; keep in ignored file without echoing
    await writeFile(
      join(generatedDir, 'runtime-secrets.env'),
      `UNILIVE_LOCAL_API_KEY=${secrets.apiKey}\nUNILIVE_LOCAL_AUTH_PEPPER=${secrets.authPepper}\n`,
      { mode: 0o600 },
    );
  }

  const controlPlane = createControlPlaneStore();
  const observe = createUniLiveObserve();
  const org = controlPlane.createOrganization({ name: 'local-org', actor: 'local' });
  const project = controlPlane.createProject({
    organizationId: org.organizationId,
    name: 'local-app',
    actor: 'local',
  });
  const cred = controlPlane.createApiCredential({
    projectId: project.projectId,
    kind: 'developer',
    scopes: ['*'],
    actor: 'local',
  });

  /** @type {Map<string, { personId: string, email: string, passwordHash: string }>} */
  const users = new Map();
  /** @type {Map<string, { sessionId: string, personId: string, deviceId: string }>} */
  const sessions = new Map();
  /** @type {Map<string, any[]>} */
  const tables = new Map([['notes', []]]);
  /** @type {Map<string, { key: string, bytes: Buffer, contentType: string }>} */
  const blobs = new Map();
  /** @type {Map<string, Set<(payload: any) => void>>} */
  const channels = new Map();
  /** @type {Map<string, ReturnType<typeof createFakeRTCProvider>>} */
  const rtcRooms = new Map();

  const mcp = createUniLiveMcpServer({
    controlPlane,
    credentialPublicId: cred.publicId,
    requireAuth: true,
  });

  function publish(channel, payload) {
    const set = channels.get(channel) || new Set();
    for (const fn of set) fn(payload);
    observe.log('info', 'realtime.publish', { channel });
  }

  function json(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      'content-type': 'application/json',
      'x-request-id': randomBytes(8).toString('hex'),
      'x-unilive-platform': 'local',
    });
    res.end(payload);
  }

  async function readJson(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (!chunks.length) return {};
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return {};
    }
  }

  const apiPort = Number(options.apiPort) || 8788;
  const apiServer = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${apiPort}`);
    try {
      if (url.pathname === '/api/v1/health' && req.method === 'GET') {
        return json(res, 200, {
          ok: true,
          productionRtcApi: 'UniLiveRTC',
          productionMediaProvider: 'LiveKit',
          localMode: 'in-process',
          platformVersion: '0.1.0',
        });
      }

      if (url.pathname === '/api/v1/auth/signup' && req.method === 'POST') {
        const body = await readJson(req);
        if (!body.email || !body.password) return json(res, 400, { ok: false, error: 'email_password_required' });
        if (users.has(body.email)) return json(res, 409, { ok: false, error: 'user_exists' });
        const personId = `person_${randomBytes(6).toString('hex')}`;
        users.set(body.email, {
          personId,
          email: body.email,
          passwordHash: hash(`${secrets.authPepper}:${body.password}`),
        });
        const sessionId = `sess_${randomBytes(8).toString('hex')}`;
        const deviceId = body.deviceId || `device_${randomBytes(4).toString('hex')}`;
        sessions.set(sessionId, { sessionId, personId, deviceId });
        observe.log('info', 'auth.signup', { personId });
        return json(res, 200, { ok: true, personId, sessionId, deviceId });
      }

      if (url.pathname === '/api/v1/auth/signin' && req.method === 'POST') {
        const body = await readJson(req);
        const user = users.get(body.email);
        if (!user || user.passwordHash !== hash(`${secrets.authPepper}:${body.password}`)) {
          return json(res, 401, { ok: false, error: 'invalid_credentials' });
        }
        const sessionId = `sess_${randomBytes(8).toString('hex')}`;
        const deviceId = body.deviceId || `device_${randomBytes(4).toString('hex')}`;
        sessions.set(sessionId, { sessionId, personId: user.personId, deviceId });
        return json(res, 200, { ok: true, personId: user.personId, sessionId, deviceId });
      }

      if (url.pathname === '/api/v1/auth/logout' && req.method === 'POST') {
        const body = await readJson(req);
        sessions.delete(body.sessionId);
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/v1/db/migrate' && req.method === 'POST') {
        if (!tables.has('notes')) tables.set('notes', []);
        if (!tables.has('profiles')) tables.set('profiles', []);
        return json(res, 200, { ok: true, tables: [...tables.keys()], status: 'applied' });
      }

      if (url.pathname === '/api/v1/db/query' && req.method === 'POST') {
        const body = await readJson(req);
        const rows = tables.get(body.table) || [];
        if (body.op === 'insert') {
          const row = { id: `row_${randomBytes(4).toString('hex')}`, ...(body.values || {}) };
          rows.push(row);
          tables.set(body.table, rows);
          publish(`db:${body.table}`, { type: 'insert', row });
          return json(res, 200, { ok: true, row });
        }
        return json(res, 200, { ok: true, rows });
      }

      if (url.pathname === '/api/v1/storage/upload' && req.method === 'POST') {
        const body = await readJson(req);
        const key = body.key || `obj_${randomBytes(4).toString('hex')}`;
        const bytes = Buffer.from(String(body.content || ''), 'utf8');
        blobs.set(key, { key, bytes, contentType: body.contentType || 'text/plain' });
        return json(res, 200, { ok: true, key, size: bytes.length });
      }

      if (url.pathname === '/api/v1/storage/list' && req.method === 'GET') {
        return json(res, 200, {
          ok: true,
          objects: [...blobs.values()].map((b) => ({ key: b.key, size: b.bytes.length, contentType: b.contentType })),
        });
      }

      if (url.pathname.startsWith('/api/v1/storage/object/') && req.method === 'GET') {
        const key = decodeURIComponent(url.pathname.replace('/api/v1/storage/object/', ''));
        const obj = blobs.get(key);
        if (!obj) return json(res, 404, { ok: false, error: 'not_found' });
        res.writeHead(200, { 'content-type': obj.contentType });
        return res.end(obj.bytes);
      }

      if (url.pathname === '/api/v1/realtime/publish' && req.method === 'POST') {
        const body = await readJson(req);
        publish(body.channel || 'default', body.payload || {});
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/v1/rtc/rooms' && req.method === 'POST') {
        const body = await readJson(req);
        const roomId = body.roomId || `room_${randomBytes(4).toString('hex')}`;
        const provider = createFakeRTCProvider({ identity: body.identity || 'local-user' });
        const session = await provider.joinRoom({ roomName: roomId, token: 'local', url: 'fake://' });
        rtcRooms.set(roomId, provider);
        return json(res, 200, {
          ok: true,
          room: { roomId, roomSessionId: session.roomSessionId, provider: 'fake', note: 'LiveKit used when Docker stack is up' },
        });
      }

      if (url.pathname.startsWith('/api/v1/rtc/rooms/') && req.method === 'DELETE') {
        const roomId = url.pathname.split('/').pop();
        const p = rtcRooms.get(roomId);
        if (p) {
          await p.leaveRoom();
          rtcRooms.delete(roomId);
        }
        return json(res, 200, { ok: true });
      }

      if (url.pathname === '/api/v1/mcp/invoke' && req.method === 'POST') {
        const body = await readJson(req);
        const tool = mcp.tools[body.tool];
        if (!tool) return json(res, 404, { ok: false, error: 'unknown_tool' });
        const result = await tool(body.args || {});
        return json(res, 200, result);
      }

      if (url.pathname === '/api/v1/logs' && req.method === 'GET') {
        return json(res, 200, { ok: true, logs: observe.getLogs({ limit: Number(url.searchParams.get('limit') || 50) }) });
      }

      if (url.pathname === '/api/v1/metrics' && req.method === 'GET') {
        return json(res, 200, {
          ok: true,
          metrics: {
            users: users.size,
            sessions: sessions.size,
            rtcRooms: rtcRooms.size,
            storageObjects: blobs.size,
          },
        });
      }

      return json(res, 404, { ok: false, error: 'not_found' });
    } catch (err) {
      observe.log('error', 'api.error', { message: String(err?.message || err) });
      return json(res, 500, { ok: false, error: 'internal_error' });
    }
  });

  await new Promise((resolve, reject) => {
    apiServer.on('error', reject);
    apiServer.listen(apiPort, '127.0.0.1', resolve);
  });

  const studioPort = Number(options.studioPort) || 8787;
  const studio = await startStudioServer({
    port: studioPort,
    projectsDir: join(rootDir, '.unilive', 'projects'),
    controlPlane,
  });

  const state = {
    mode: 'in-process',
    apiUrl: `http://127.0.0.1:${apiPort}`,
    studioUrl: studio.url,
    projectId: project.projectId,
    organizationId: org.organizationId,
    credentialPublicId: cred.publicId,
    mcpTools: mcp.listTools(),
    fallbackScope:
      'In-process provides Platform API, Auth (memory), DB (memory), Storage (memory), Realtime (memory), Fake RTC, MCP, Studio. Docker adds Postgres/MinIO/LiveKit.',
    startedAt: new Date().toISOString(),
  };
  await writeFile(join(generatedDir, 'runtime.json'), `${JSON.stringify(state, null, 2)}\n`);

  return {
    ...state,
    controlPlane,
    mcp,
    observe,
    async close() {
      await studio.close();
      await new Promise((r) => apiServer.close(() => r()));
    },
  };
}
