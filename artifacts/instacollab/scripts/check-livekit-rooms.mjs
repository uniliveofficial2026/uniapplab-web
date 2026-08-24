#!/usr/bin/env node
/**
 * Stage A: LiveKit room create → grant mint → list → delete (isolated test room).
 * Never prints secrets. Soft-FAIL only when LiveKit not configured.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function loadDotEnv() {
  for (const file of [
    path.join(ROOT, '.env'),
    path.join(ROOT, '.env.local'),
    path.join(ROOT, 'artifacts/instacollab/.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

loadDotEnv();

const evidence = {
  ok: false,
  configured: false,
  created: false,
  listed: false,
  deleted: false,
  grantHost: false,
  grantViewer: false,
  roomName: null,
  blocker: null,
};

const {
  isLiveKitConfigured,
  ensureLiveKitRoom,
  deleteLiveKitRoom,
  getRoomService,
  createLiveKitToken,
} = await import('../../../lib/livekit/index.mjs');

if (!isLiveKitConfigured()) {
  evidence.blocker = 'livekit_not_configured';
  console.log('[check-livekit-rooms] SKIP');
  console.log(JSON.stringify(evidence, null, 2));
  process.exit(0);
}

evidence.configured = true;
const roomName = `stage-a-tmp-${Date.now().toString(36)}`;
evidence.roomName = roomName;

try {
  await ensureLiveKitRoom(roomName, 'solo');
  evidence.created = true;

  const svc = getRoomService();
  const rooms = await svc.listRooms([roomName]);
  evidence.listed = Array.isArray(rooms) && rooms.some((r) => r.name === roomName);

  const hostTok = await createLiveKitToken({
    identity: 'stage-a-host',
    room: roomName,
    role: 'host',
    canPublish: true,
  });
  evidence.grantHost = Boolean(hostTok && String(hostTok).length > 20);

  const viewerTok = await createLiveKitToken({
    identity: 'stage-a-viewer',
    room: roomName,
    role: 'viewer',
    canPublish: false,
  });
  evidence.grantViewer = Boolean(viewerTok && String(viewerTok).length > 20);

  await deleteLiveKitRoom(roomName);
  evidence.deleted = true;

  const after = await svc.listRooms([roomName]).catch(() => []);
  evidence.cleanupConfirmed = !Array.isArray(after) || !after.some((r) => r.name === roomName);

  evidence.ok =
    evidence.created &&
    evidence.listed &&
    evidence.grantHost &&
    evidence.grantViewer &&
    evidence.deleted &&
    evidence.cleanupConfirmed !== false;
} catch (err) {
  evidence.blocker = err instanceof Error ? err.message.slice(0, 200) : 'room_lifecycle_failed';
  try {
    await deleteLiveKitRoom(roomName);
  } catch {
    /* best-effort cleanup */
  }
}

console.log(`[check-livekit-rooms] ${evidence.ok ? 'PASS' : 'FAIL'}`);
console.log(JSON.stringify(evidence, null, 2));
process.exit(evidence.ok ? 0 : 1);
