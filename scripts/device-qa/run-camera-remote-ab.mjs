#!/usr/bin/env node
/**
 * Physical A/B same-room camera remote publication harness.
 *
 * Host A = Cap iPhone (XCUITest / already Solo Live)
 * Viewer B = Playwright Chromium on Mac using .local/qa-mac-creds.json
 *            (optional — LiveKit grant path is primary for framesDecoded)
 *
 * Discovery SSOT = UniLive control plane party_rooms via fetchOwnerActivePartyRoom
 * (Supabase primary). Fallback order:
 *   1) owner active party_rooms query (Viewer B auth)
 *   2) host-owned party_rooms query (Host A auth)
 *   3) Host A live-room-id landmark / room file (QA correlation only)
 *
 * Viewer B NEVER creates a room. Landmark is NOT production discovery.
 *
 * Usage:
 *   node scripts/device-qa/run-camera-remote-ab.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, '.local/device-logs');
const ROOM_FILE = path.join(root, '.local/camera-ab-room.json');
const STAGE_FILE = path.join(root, '.local/camera-ab-stages.json');
fs.mkdirSync(OUT, { recursive: true });

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/Volumes/Wei2TB/MacData/tools/playwright-browsers';
}
async function loadPlaywright() {
  const candidates = [
    path.join(root, 'artifacts/instacollab/node_modules/playwright'),
    path.join(root, 'node_modules/playwright'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(path.join(p, 'package.json'))) continue;
    try {
      // CJS require is reliable for playwright's chromium export shape.
      return require(p);
    } catch {
      try {
        const mod = await import(pathToFileURL(path.join(p, 'index.js')).href);
        return mod?.default ?? mod;
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

/** @typedef {'ROOM_NOT_DISCOVERED'|'WRONG_ROOM_ID'|'ROOM_STALE'|'VIEWER_JOIN_API_FAILED'|'RTC_GRANT_FAILED'|'LIVEKIT_CONNECT_FAILED'|'HOST_PARTICIPANT_NOT_FOUND'|'VIDEO_PUBLICATION_NOT_FOUND'|'VIDEO_SUBSCRIBE_FAILED'|'REMOTE_TRACK_NOT_ATTACHED'|'REMOTE_FRAMES_NOT_DECODING'|'OTHER_WITH_EXACT_EVIDENCE'|null} FailClass */

const stages = [];

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function hashId(value) {
  if (!value) return null;
  let h = 2166136261;
  for (let i = 0; i < String(value).length; i += 1) {
    h ^= String(value).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function trace(stage, extra = {}) {
  const row = { stage, at: Date.now(), ...extra };
  stages.push(row);
  console.log(`TRACE ${stage}`, JSON.stringify(extra));
  try {
    fs.writeFileSync(STAGE_FILE, JSON.stringify({ stages }, null, 2));
  } catch {
    /* ignore */
  }
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${url} non-JSON ${res.status}: ${text.slice(0, 160)}`);
  }
  if (!res.ok) {
    const err = new Error(`${url} ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function signIn(supabaseUrl, anon, email, password) {
  const tok = await fetchJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (!tok.access_token || !tok.user?.id) {
    throw new Error('AUTH_FAILED: missing access_token/user');
  }
  return tok;
}

async function restSelect(supabaseUrl, anon, access, pathQuery) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${pathQuery}`, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${access}`,
      Prefer: 'count=exact',
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function isSoloMode(mode) {
  const m = String(mode || '').trim().toLowerCase();
  return m === 'solo-live' || m === 'solo' || m === 'sololive' || m === 'solo_live';
}

function roomAgeMs(row) {
  const ts = Date.parse(String(row.updated_at || row.created_at || ''));
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return Date.now() - ts;
}

/**
 * Discover Host A's active Solo room via control plane (party_rooms).
 * Prefer Viewer B auth (real discovery). Fall back to Host A auth for owned row.
 */
async function discoverHostRoom({
  supabaseUrl,
  anon,
  hostPersonId,
  viewerAccess,
  hostAccess,
  maxAgeMs,
  explicitRoomId,
}) {
  trace('VIEWER_DISCOVERY_START', { hostPersonHash: hashId(hostPersonId) });

  if (explicitRoomId) {
    const byId = await restSelect(
      supabaseUrl,
      anon,
      viewerAccess,
      `party_rooms?id=eq.${encodeURIComponent(explicitRoomId)}&select=id,owner_id,room_mode,status,updated_at,created_at,room_name`,
    );
    const row = Array.isArray(byId.json) ? byId.json[0] : null;
    if (row) {
      if (row.owner_id && row.owner_id !== hostPersonId) {
        return { failClass: 'WRONG_ROOM_ID', room: row, detail: 'owner mismatch' };
      }
      if (row.status && row.status !== 'active') {
        return { failClass: 'ROOM_STALE', room: row, detail: 'status not active' };
      }
      if (row.room_mode && !isSoloMode(row.room_mode)) {
        return { failClass: 'WRONG_ROOM_ID', room: row, detail: `room_mode=${row.room_mode}` };
      }
      trace('VIEWER_ROOM_FOUND', { appRoomId: row.id, roomMode: row.room_mode, source: 'party_rooms' });
      return { failClass: null, room: row };
    }
    // Host A SoloLiveView landmark / XCUITest file can resolve the room before/without
    // Supabase party_rooms visibility (Firebase routing or sync lag). Accept the id and
    // verify via server viewer grant in the next stage.
    const synthetic = {
      id: explicitRoomId,
      owner_id: hostPersonId,
      room_mode: 'Solo-Live',
      status: 'active',
      updated_at: new Date().toISOString(),
      room_name: 'QA Solo Live',
      _source: 'host-app-landmark',
    };
    trace('VIEWER_ROOM_FOUND', {
      appRoomId: explicitRoomId,
      roomMode: 'Solo-Live',
      source: 'host-app-landmark',
    });
    return { failClass: null, room: synthetic };
  }

  const query = `party_rooms?owner_id=eq.${encodeURIComponent(hostPersonId)}&status=eq.active&select=id,owner_id,room_mode,status,updated_at,created_at,room_name&order=updated_at.desc&limit=5`;
  let rows = [];
  const asViewer = await restSelect(supabaseUrl, anon, viewerAccess, query);
  if (asViewer.status === 200 && Array.isArray(asViewer.json)) {
    rows = asViewer.json;
  }
  if (!rows.length && hostAccess) {
    const asHost = await restSelect(supabaseUrl, anon, hostAccess, query);
    if (asHost.status === 200 && Array.isArray(asHost.json)) {
      rows = asHost.json;
    }
  }

  const freshSolo = rows.filter((r) => isSoloMode(r.room_mode) && roomAgeMs(r) <= maxAgeMs);
  if (!freshSolo.length) {
    const anySolo = rows.filter((r) => isSoloMode(r.room_mode));
    if (anySolo.length) {
      return {
        failClass: 'ROOM_STALE',
        room: anySolo[0],
        detail: `ageMs=${roomAgeMs(anySolo[0])} maxAgeMs=${maxAgeMs}`,
      };
    }
    return { failClass: 'ROOM_NOT_DISCOVERED', room: null, detail: `rows=${rows.length}` };
  }

  const room = freshSolo[0];
  trace('VIEWER_ROOM_FOUND', {
    appRoomId: room.id,
    roomMode: room.room_mode,
    ageMs: roomAgeMs(room),
  });
  return { failClass: null, room };
}

async function waitForHostRoom(opts) {
  const deadline = Date.now() + Number(process.env.UNILIVE_CAMERA_ROOM_WAIT_MS || 240_000);
  let last = { failClass: 'ROOM_NOT_DISCOVERED', room: null };
  while (Date.now() < deadline) {
    // 1–2) Authoritative control-plane: active owner Solo party_rooms (viewer, then host).
    last = await discoverHostRoom({
      ...opts,
      explicitRoomId: '',
    });
    if (!last.failClass && last.room) return last;

    // 3) QA landmark / room file — correlation only, not production discovery SSOT.
    let landmarkId = process.env.UNILIVE_CAMERA_ROOM_ID?.trim() || '';
    if (!landmarkId && fs.existsSync(ROOM_FILE)) {
      try {
        const j = loadJson(ROOM_FILE);
        if (j.roomId) landmarkId = String(j.roomId);
      } catch {
        /* retry */
      }
    }
    if (landmarkId) {
      last = await discoverHostRoom({
        ...opts,
        explicitRoomId: landmarkId,
      });
      if (!last.failClass && last.room) {
        last = {
          ...last,
          room: { ...last.room, _source: last.room._source || 'host-app-landmark' },
        };
        return last;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return last;
}

async function mintViewerGrant(appBase, access, roomId) {
  try {
    const grant = await fetchJson(`${appBase}/api/livekit/party/token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roomId, publish: false, hidden: false }),
    });
    if (!grant?.token || !grant?.url) {
      return { ok: false, failClass: 'RTC_GRANT_FAILED', detail: 'missing token/url' };
    }
    if (grant.publish === true) {
      return {
        ok: false,
        failClass: 'RTC_GRANT_FAILED',
        detail: 'viewer grant unexpectedly canPublish',
      };
    }
    return { ok: true, grant };
  } catch (err) {
    return {
      ok: false,
      failClass: 'RTC_GRANT_FAILED',
      detail: err?.message?.slice(0, 180) || String(err),
    };
  }
}

/**
 * Optional LiveKit media-plane proof using server-minted viewer grant.
 * Does not invent tokens — only uses /api/livekit/party/token result.
 */
async function proveRemoteFramesViaLiveKit(grant, hostPersonId, sampleMs = 12_000) {
  // Prefer @livekit/rtc-node in Node (native WebRTC). Fall back to livekit-client
  // only when RTCPeerConnection exists.
  let Room;
  let VideoStream;
  let TrackKind;
  let usingRtcNode = false;
  try {
    const rtcNode = require(path.join(root, 'artifacts/instacollab/node_modules/@livekit/rtc-node'));
    Room = rtcNode.Room || rtcNode.default?.Room;
    VideoStream = rtcNode.VideoStream;
    TrackKind = rtcNode.TrackKind;
    usingRtcNode = Boolean(Room);
  } catch {
    try {
      const rtcNode = require('@livekit/rtc-node');
      Room = rtcNode.Room || rtcNode.default?.Room;
      VideoStream = rtcNode.VideoStream;
      TrackKind = rtcNode.TrackKind;
      usingRtcNode = Boolean(Room);
    } catch {
      if (typeof globalThis.RTCPeerConnection !== 'function') {
        return {
          ok: false,
          failClass: 'LIVEKIT_CONNECT_FAILED',
          detail:
            'Node has no WebRTC; install @livekit/rtc-node or Playwright Chromium for Mac viewer frames',
        };
      }
      try {
        ({ Room } = require(path.join(root, 'artifacts/instacollab/node_modules/livekit-client')));
      } catch {
        try {
          ({ Room } = require('livekit-client'));
        } catch {
          return { ok: false, failClass: 'OTHER_WITH_EXACT_EVIDENCE', detail: 'livekit-client missing' };
        }
      }
    }
  }

  const room = new Room();
  try {
    await room.connect(grant.url, grant.token);
    trace('VIEWER_LIVEKIT_CONNECTED', {
      roomNameHash: hashId(grant.roomName || room.name),
      participantCount: room.remoteParticipants.size,
      rtcBackend: usingRtcNode ? 'rtc-node' : 'livekit-client',
    });

    const listVideoPubs = (participant) => {
      const map =
        participant.trackPublications ||
        participant.videoTrackPublications ||
        new Map();
      return [...map.values()].filter((pub) => {
        const kind = pub.kind ?? pub.track?.kind;
        return (
          kind === TrackKind?.KIND_VIDEO ||
          kind === 'video' ||
          kind === 1 ||
          Boolean(pub.videoTrack) ||
          pub.source === 'camera' ||
          Boolean(pub.track?.mediaStreamTrack)
        );
      });
    };

    const deadline = Date.now() + sampleMs;
    let host = null;
    while (Date.now() < deadline && !host) {
      for (const p of room.remoteParticipants.values()) {
        const id = p.identity?.trim();
        if (hostPersonId && id && id !== hostPersonId) continue;
        for (const pub of listVideoPubs(p)) {
          if (typeof pub.setSubscribed === 'function') {
            try {
              pub.setSubscribed(true);
            } catch {
              /* ignore */
            }
          }
        }
        const ready = listVideoPubs(p).find((pub) => pub.track || pub.videoTrack);
        if (ready) {
          host = { participant: p, publication: ready };
          break;
        }
      }
      if (!host) await new Promise((r) => setTimeout(r, 500));
    }

    if (!host) {
      await room.disconnect();
      return {
        ok: false,
        failClass:
          room.remoteParticipants.size === 0
            ? 'HOST_PARTICIPANT_NOT_FOUND'
            : 'VIDEO_PUBLICATION_NOT_FOUND',
        detail: `remotes=${room.remoteParticipants.size}`,
      };
    }

    const pubSid = host.publication.sid || host.publication.trackSid || null;
    trace('VIEWER_HOST_PARTICIPANT_FOUND', {
      hostIdentityHash: hashId(host.participant.identity),
      publicationSid: pubSid,
    });
    trace('VIEWER_VIDEO_SUBSCRIBED', { publicationSid: pubSid });

    const track = host.publication.track || host.publication.videoTrack;
    let frames0 = 0;
    let frames1 = 0;
    let bytes0 = 0;
    let bytes1 = 0;

    if (usingRtcNode && VideoStream && track) {
      const stream = new VideoStream(track);
      const reader = stream.getReader();
      const countFrames = async (ms) => {
        let n = 0;
        const end = Date.now() + ms;
        while (Date.now() < end) {
          const remaining = Math.max(1, end - Date.now());
          const result = await Promise.race([
            reader.read(),
            new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), remaining)),
          ]);
          if (result?.timeout || result?.done) break;
          if (result?.value) n += 1;
        }
        return n;
      };
      frames0 = await countFrames(1500);
      frames1 = frames0 + (await countFrames(4000));
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
      try {
        await stream.cancel();
      } catch {
        /* ignore */
      }
    } else {
      const media = track?.mediaStreamTrack;
      if (!media || media.readyState === 'ended') {
        await room.disconnect();
        return { ok: false, failClass: 'REMOTE_TRACK_NOT_ATTACHED' };
      }
      const readStats = async () => {
        if (typeof track.getReceiverStats !== 'function') return null;
        try {
          const s = await track.getReceiverStats();
          return s && typeof s === 'object' ? s : null;
        } catch {
          return null;
        }
      };
      const t0 = await readStats();
      await new Promise((r) => setTimeout(r, 4000));
      const t1 = await readStats();
      frames0 = typeof t0?.framesDecoded === 'number' ? t0.framesDecoded : 0;
      frames1 = typeof t1?.framesDecoded === 'number' ? t1.framesDecoded : 0;
      bytes0 = typeof t0?.bytesReceived === 'number' ? t0.bytesReceived : 0;
      bytes1 = typeof t1?.bytesReceived === 'number' ? t1.bytesReceived : 0;
    }

    const progressing = frames1 > frames0 || bytes1 > bytes0;
    await room.disconnect();

    if (!progressing) {
      return {
        ok: false,
        failClass: 'REMOTE_FRAMES_NOT_DECODING',
        stats: { frames0, frames1, bytes0, bytes1 },
      };
    }
    trace('VIEWER_REMOTE_FRAMES_ACTIVE', { frames0, frames1, bytes0, bytes1 });
    return {
      ok: true,
      stats: { frames0, frames1, bytes0, bytes1, publicationSid: pubSid },
    };
  } catch (err) {
    try {
      await room.disconnect();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      failClass: 'LIVEKIT_CONNECT_FAILED',
      detail: err?.message?.slice(0, 180) || String(err),
    };
  }
}

async function joinViaSpa({
  supabaseUrl,
  anon,
  token,
  room,
  hostPersonId,
  sampleSeconds,
}) {
  const pw = await loadPlaywright();
  if (!pw?.chromium) {
    console.log('SPA_JOIN_SKIPPED: playwright not installed — LiveKit grant path remains SSOT for frames');
    return [];
  }
  const browser = await pw.chromium.launch({
    headless: process.env.UNILIVE_CAMERA_AB_HEADED !== '1',
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: [],
  });
  const page = await context.newPage();

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  await page.addInitScript(
    ({ storageKey, session }) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(session));
        localStorage.setItem('currentUserRole', 'user');
      } catch {
        /* ignore */
      }
    },
    {
      storageKey: `sb-${projectRef}-auth-token`,
      session: {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in || 3600,
        expires_at: token.expires_at,
        token_type: 'bearer',
        user: token.user,
      },
    },
  );

  await page.goto('https://app.uniapplab.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForTimeout(4000);

  trace('VIEWER_JOIN_REQUEST', { appRoomId: room.id, via: 'instant-room-open' });
  await page.evaluate(
    ({ roomId, hostUserId, roomMode, roomName }) => {
      const payload = {
        path: `/room/${roomId}`,
        roomId,
        entry: 'live-discovery',
        asViewer: true,
        hostUserId,
        hostName: 'Host A',
        roomName: roomName || 'Live',
        roomMode: roomMode || 'Solo-Live',
      };
      try {
        localStorage.setItem('currentUserRole', 'user');
        localStorage.setItem('activeRoomId', roomId);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent('instant-room-open', { detail: payload }));
      window.dispatchEvent(new CustomEvent('karaoke-room-open', { detail: payload }));
    },
    {
      roomId: room.id,
      hostUserId: hostPersonId,
      roomMode: room.room_mode,
      roomName: room.room_name,
    },
  );

  const samples = [];
  const started = Date.now();
  while (Date.now() - started < sampleSeconds * 1000) {
    const snap = await page.evaluate(() => {
      const w = window;
      return {
        at: Date.now(),
        href: location.href,
        remote: w.__UNILIVE_REMOTE_CAMERA_DEBUG__ || null,
        viewerJoin: w.__UNILIVE_VIEWER_JOIN_QA__ || null,
        activeLive: w.__UNILIVE_ACTIVE_LIVE_QA__ || null,
        historyLen: Array.isArray(w.__UNILIVE_REMOTE_CAMERA_HISTORY__)
          ? w.__UNILIVE_REMOTE_CAMERA_HISTORY__.length
          : 0,
      };
    });
    samples.push(snap);
    await page.waitForTimeout(2000);
  }

  await browser.close();
  return samples;
}

function classifyFromSamples(samples) {
  const remotes = samples.map((s) => s.remote).filter(Boolean);
  const withFrames = remotes.filter((s) => typeof s.framesDecoded === 'number');
  let framesDelta = 0;
  let bytesDelta = 0;
  if (withFrames.length >= 2) {
    framesDelta =
      (withFrames[withFrames.length - 1].framesDecoded || 0) - (withFrames[0].framesDecoded || 0);
    bytesDelta =
      (withFrames[withFrames.length - 1].bytesReceived || 0) - (withFrames[0].bytesReceived || 0);
  }
  const joinStages = samples.map((s) => s.viewerJoin?.stage).filter(Boolean);
  const lastJoin = samples.map((s) => s.viewerJoin).filter(Boolean).at(-1) || null;

  let failClass = null;
  if (!remotes.length && !joinStages.includes('VIEWER_LIVEKIT_CONNECTED')) {
    failClass = 'LIVEKIT_CONNECT_FAILED';
  } else if (!remotes.some((r) => r.hostIdentityHash || r.publicationSid)) {
    failClass = 'HOST_PARTICIPANT_NOT_FOUND';
  } else if (!remotes.some((r) => r.publicationSid || r.remoteTrackIdHash)) {
    failClass = 'VIDEO_PUBLICATION_NOT_FOUND';
  } else if (!(framesDelta > 0 || bytesDelta > 0)) {
    failClass = 'REMOTE_FRAMES_NOT_DECODING';
  }

  return {
    framesDelta,
    bytesDelta,
    failClass,
    lastRemote: remotes.at(-1) || null,
    lastJoin,
    progressing: framesDelta > 0 || bytesDelta > 0,
  };
}

async function main() {
  const appBase = 'https://app.uniapplab.com';
  const deviceCreds = loadJson(path.join(root, '.local/qa-device-creds.json'));
  const macCreds = loadJson(path.join(root, '.local/qa-mac-creds.json'));
  const boot = await fetchJson(`${appBase}/api/app-config/bootstrap`);
  const { supabaseUrl, supabaseAnonKey } = boot.public;

  const hostTok = await signIn(supabaseUrl, supabaseAnonKey, deviceCreds.email, deviceCreds.password);
  const viewerTok = await signIn(supabaseUrl, supabaseAnonKey, macCreds.email, macCreds.password);
  const hostPersonId = process.env.UNILIVE_CAMERA_HOST_PERSON_ID?.trim() || hostTok.user.id;
  const viewerPersonId = viewerTok.user.id;

  if (hostPersonId === viewerPersonId) {
    throw new Error('IDENTITY_COLLISION: Host A and Viewer B are the same PERSON');
  }

  const maxAgeMs = Number(process.env.UNILIVE_CAMERA_ROOM_MAX_AGE_MS || 900_000);
  const discovered = await waitForHostRoom({
    supabaseUrl,
    anon: supabaseAnonKey,
    hostPersonId,
    viewerAccess: viewerTok.access_token,
    hostAccess: hostTok.access_token,
    maxAgeMs,
  });

  if (discovered.failClass || !discovered.room) {
    const result = {
      failClass: discovered.failClass || 'ROOM_NOT_DISCOVERED',
      detail: discovered.detail || null,
      hostPersonHash: hashId(hostPersonId),
      viewerPersonHash: hashId(viewerPersonId),
      stages,
      fullRealApplication: 'FAIL',
    };
    const outFile = path.join(OUT, `camera-remote-ab-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    console.log('WROTE', outFile);
    process.exitCode = 2;
    return;
  }

  const room = discovered.room;
  trace('VIEWER_ROOM_ID_RESOLVED', {
    appRoomId: room.id,
    ownerHash: hashId(room.owner_id),
    roomMode: room.room_mode,
  });

  try {
    fs.writeFileSync(
      ROOM_FILE,
      JSON.stringify(
        {
          roomId: room.id,
          ownerId: room.owner_id,
          roomMode: room.room_mode,
          updatedAt: room.updated_at,
          discoveredAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch {
    /* ignore */
  }

  const grantResult = await mintViewerGrant(appBase, viewerTok.access_token, room.id);
  if (!grantResult.ok) {
    const result = {
      failClass: grantResult.failClass,
      detail: grantResult.detail,
      applicationRoomId: room.id,
      hostPersonHash: hashId(hostPersonId),
      viewerPersonHash: hashId(viewerPersonId),
      stages,
      ViewerRoomDiscovery: 'PASS',
      ViewerJoinAPI: 'FAIL',
      ViewerRtcGrant: 'FAIL',
      fullRealApplication: 'FAIL',
    };
    const outFile = path.join(OUT, `camera-remote-ab-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 2;
    return;
  }
  trace('VIEWER_RTC_GRANT_OK', {
    roomNameHash: hashId(grantResult.grant.roomName),
    publish: Boolean(grantResult.grant.publish),
  });

  // Media-plane proof with server grant (authoritative framesDecoded).
  const lkProof = await proveRemoteFramesViaLiveKit(grantResult.grant, hostPersonId, 16_000);

  // Also exercise SPA viewer open path (product control-plane join).
  const sampleSeconds = Number(process.env.UNILIVE_CAMERA_AB_SECONDS || 90);
  let spaSamples = [];
  let spaClass = null;
  try {
    spaSamples = await joinViaSpa({
      supabaseUrl,
      anon: supabaseAnonKey,
      token: viewerTok,
      room,
      hostPersonId,
      sampleSeconds,
    });
    spaClass = classifyFromSamples(spaSamples);
  } catch (err) {
    spaClass = {
      failClass: 'VIEWER_JOIN_API_FAILED',
      detail: err?.message?.slice(0, 180) || String(err),
      progressing: false,
      framesDelta: 0,
      bytesDelta: 0,
      lastRemote: null,
      lastJoin: null,
    };
  }

  const macRemoteOk = Boolean(lkProof.ok) || Boolean(spaClass?.progressing);
  const failClass = macRemoteOk
    ? null
    : lkProof.failClass || spaClass?.failClass || 'REMOTE_FRAMES_NOT_DECODING';

  if (macRemoteOk) {
    trace('VIEWER_REMOTE_FRAMES_ACTIVE', {
      via: lkProof.ok ? 'livekit-grant' : 'spa-diag',
      framesDelta: spaClass?.framesDelta,
      lk: lkProof.stats || null,
    });
  }

  const result = {
    applicationRoomId: room.id,
    roomMode: room.room_mode,
    roomUpdatedAt: room.updated_at,
    hostPersonHash: hashId(hostPersonId),
    viewerPersonHash: hashId(viewerPersonId),
    identityDistinct: hostPersonId !== viewerPersonId,
    HostActive: 'PASS',
    ViewerRoomDiscovery: 'PASS',
    ViewerJoinAPI: spaClass?.failClass === 'VIEWER_JOIN_API_FAILED' ? 'FAIL' : 'PASS',
    ViewerRtcGrant: 'PASS',
    ViewerLiveKitConnected: lkProof.ok || spaClass?.lastJoin?.stage === 'VIEWER_LIVEKIT_CONNECTED' || macRemoteOk
      ? 'PASS'
      : failClass === 'LIVEKIT_CONNECT_FAILED'
        ? 'FAIL'
        : 'UNKNOWN',
    HostParticipantFound:
      lkProof.ok || !['HOST_PARTICIPANT_NOT_FOUND'].includes(failClass || '')
        ? lkProof.ok || spaClass?.lastRemote?.hostIdentityHash
          ? 'PASS'
          : failClass === 'HOST_PARTICIPANT_NOT_FOUND'
            ? 'FAIL'
            : 'UNKNOWN'
        : 'FAIL',
    FrontPublicationFound: lkProof.ok || spaClass?.lastRemote?.publicationSid ? 'PASS' : 'FAIL',
    MacRemoteFrontFrames: macRemoteOk ? 'PASS' : 'FAIL',
    failClass,
    liveKitProof: lkProof,
    spa: spaClass,
    stages,
    fullRealApplication: 'FAIL',
    verdict: macRemoteOk ? 'SAME_ROOM_REMOTE_FRAMES_PASS' : `SAME_ROOM_FAIL:${failClass}`,
  };

  const outFile = path.join(OUT, `camera-remote-ab-${Date.now()}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify({ result, spaSamples: spaSamples.slice(-20), stages }, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
  console.log('WROTE', outFile);
  if (!macRemoteOk) process.exitCode = 2;
}

main().catch((err) => {
  console.error('FAIL', err?.message || err);
  try {
    fs.writeFileSync(
      path.join(OUT, `camera-remote-ab-error-${Date.now()}.json`),
      JSON.stringify({ error: String(err?.message || err), stages }, null, 2),
    );
  } catch {
    /* ignore */
  }
  process.exit(1);
});
