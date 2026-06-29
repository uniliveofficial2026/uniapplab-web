const DB_NAME = 'InstaCollabLocalGames';
const STORE = 'bundles';
const MARKER = '/__local_game__/';

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

async function getBundle(gameId) {
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

function findFile(bundle, filePath) {
  if (!bundle || !bundle.files) return undefined;
  const normalized = filePath.replace(/^\.?\//, '');
  return bundle.files.find((file) => file.path.replace(/^\.?\//, '') === normalized);
}

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
        const segments = rest.split('/').filter(Boolean);
        const gameId = segments.shift();
        if (!gameId) return new Response('Missing game id', { status: 404 });

        const filePath = decodeURIComponent(segments.join('/'));
        const bundle = await getBundle(gameId);
        const file = findFile(bundle, filePath);
        if (!file) {
          return new Response('Game asset not found', { status: 404 });
        }

        return new Response(file.data, {
          headers: {
            'Content-Type': file.mime || mimeForPath(file.path),
            'Cache-Control': 'no-store',
          },
        });
      } catch (err) {
        return new Response(`Local game error: ${err?.message || err}`, { status: 500 });
      }
    })()
  );
});
