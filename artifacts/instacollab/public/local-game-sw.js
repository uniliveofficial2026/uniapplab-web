const DB_NAME = 'InstaCollabLocalGames';
const STORE = 'bundles';
const MARKER = '/__local_game__/';

/** In-memory mounts from the page (avoids IDB races / stale paths). */
const memoryBundles = new Map();

function mimeForPath(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'text/javascript';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.wasm')) return 'application/wasm';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  return 'application/octet-stream';
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function getBundleFromIdb(gameId) {
  const db = await openDb();
  const bundle = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(gameId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return bundle;
}

async function getBundle(gameId) {
  return memoryBundles.get(gameId) || (await getBundleFromIdb(gameId));
}

function normalizePath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\.?\//, '');
}

function dirnamePath(path) {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(0, idx + 1) : '';
}

function findFile(bundle, filePath) {
  if (!bundle || !bundle.files) return undefined;
  const normalized = normalizePath(filePath);
  const exact = bundle.files.find((file) => normalizePath(file.path) === normalized);
  if (exact) return exact;
  // Tolerate leading folder mismatches from older imports.
  const base = normalized.split('/').pop();
  if (!base) return undefined;
  const matches = bundle.files.filter((file) => normalizePath(file.path).split('/').pop() === base);
  if (matches.length === 1) return matches[0];
  return matches.find((file) => normalizePath(file.path).endsWith('/' + normalized));
}

function injectBaseHref(html, baseHref) {
  if (/<base\b/i.test(html)) return html;
  const tag = `<base href="${baseHref}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}\n    ${tag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}\n<head>${tag}</head>`);
  }
  return `<!DOCTYPE html><html><head>${tag}</head><body>${html}</body></html>`;
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'MOUNT_GAME' && data.gameId && data.bundle) {
    memoryBundles.set(data.gameId, data.bundle);
    event.ports?.[0]?.postMessage({ ok: true });
  }
  if (data.type === 'UNMOUNT_GAME' && data.gameId) {
    memoryBundles.delete(data.gameId);
    event.ports?.[0]?.postMessage({ ok: true });
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const markerIndex = url.pathname.indexOf(MARKER);
  if (markerIndex < 0) return;

  event.respondWith(
    (async () => {
      try {
        const rest = url.pathname.slice(markerIndex + MARKER.length);
        const segments = rest.split('/').filter(Boolean).map((part) => {
          try {
            return decodeURIComponent(part);
          } catch {
            return part;
          }
        });
        const gameId = segments.shift();
        if (!gameId) {
          return new Response('Missing game id', {
            status: 404,
            headers: { 'X-Local-Game': '1' },
          });
        }

        const filePath = segments.join('/');
        const bundle = await getBundle(gameId);
        if (!bundle) {
          return new Response('Game not found in local storage', {
            status: 404,
            headers: { 'X-Local-Game': '1' },
          });
        }

        const file = findFile(bundle, filePath || bundle.entryPath);
        if (!file) {
          return new Response(`Game asset not found: ${filePath}`, {
            status: 404,
            headers: { 'X-Local-Game': '1' },
          });
        }

        const mime = file.mime || mimeForPath(file.path);
        let body = file.data;
        if (/text\/html/i.test(mime)) {
          const entryDir = dirnamePath(file.path);
          const baseHref = `${url.origin}${url.pathname.slice(0, markerIndex + MARKER.length)}${gameId}/${entryDir}`;
          const html = injectBaseHref(new TextDecoder().decode(file.data), baseHref);
          body = new TextEncoder().encode(html);
        }

        return new Response(body, {
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'no-store',
            'X-Local-Game': '1',
          },
        });
      } catch (err) {
        return new Response(`Local game error: ${err?.message || err}`, {
          status: 500,
          headers: { 'X-Local-Game': '1' },
        });
      }
    })()
  );
});
