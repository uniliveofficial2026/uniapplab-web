import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Monitor, Loader2, ExternalLink } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { LocalGameRecord } from '../../lib/localGames/types';
import {
  createNativeDownloadUrl,
  resolveWebGameLaunchUrl,
  type WebGameLaunch,
} from '../../lib/localGames/player';

type LocalGamePlayerProps = {
  game: LocalGameRecord;
  onClose: () => void;
  onSessionEnd: (gameId: string, playedMs: number) => void;
};

/** Same-origin UniLive path — used when the :3000 fixed server is offline. */
function resolveInAppEmbedUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

async function tryLocalFixedServer(raw: string | undefined): Promise<string | null> {
  if (!raw?.trim()) return null;
  let url: URL;
  try {
    url = new URL(raw, window.location.origin);
  } catch {
    return null;
  }
  // Only auto-probe the verified local fixed UI host.
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return null;
  try {
    const health = await fetch(new URL('/api/health', url).toString(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!health.ok) return null;
    const body: unknown = await health.json().catch(() => null);
    if (
      !body ||
      typeof body !== 'object' ||
      (body as { status?: string }).status !== 'ok'
    ) {
      return null;
    }
    return url.toString().replace(/\/?$/, '/');
  } catch {
    return null;
  }
}

export function LocalGamePlayer({ game, onClose, onSessionEnd }: LocalGamePlayerProps) {
  const startedAtRef = useRef(Date.now());
  const sessionEndedRef = useRef(false);
  const revokeRef = useRef<(() => void) | undefined>(undefined);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [launch, setLaunch] = useState<WebGameLaunch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [frameHint, setFrameHint] = useState<string | null>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
    sessionEndedRef.current = false;
    let cancelled = false;
    const safetyTimer = window.setTimeout(() => {
      if (cancelled) return;
      setError((prev) => prev ?? 'Game prepare timed out. Close and try Play Now again, or re-import the ZIP.');
      setLoading(false);
    }, 25_000);

    async function prepare() {
      setLoading(true);
      setError(null);
      setLaunch(null);
      setFrameHint(null);
      try {
        if (game.playKind === 'web') {
          // Prefer the verified fixed UI on http://127.0.0.1:3000/ when it is up.
          const localFixed = await tryLocalFixedServer(game.productionAppUrl);
          if (localFixed) {
            setLaunch({ mode: 'sw', url: localFixed });
            return;
          }
          // Production / offline: UniLive embed built from that same remix package.
          const embedUrl =
            resolveInAppEmbedUrl(game.embeddedAppUrl) ||
            resolveInAppEmbedUrl(
              game.productionAppUrl?.startsWith('/') ? game.productionAppUrl : undefined,
            );
          if (embedUrl) {
            setLaunch({ mode: 'sw', url: embedUrl });
            return;
          }
          if (!game.entryPath) {
            throw new Error(
              'This game has no HTML entry point. Re-import a ZIP that includes index.html.',
            );
          }
          const next = await resolveWebGameLaunchUrl(game.id, game.entryPath);
          if (cancelled) {
            next.revoke?.();
            return;
          }
          revokeRef.current = next.revoke;
          setLaunch(next);
        } else {
          const native = await createNativeDownloadUrl(game.id);
          if (cancelled) return;
          if (!native) {
            throw new Error('Game files are missing from local storage. Re-import and try again.');
          }
          setDownloadUrl(native.url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not launch game.');
        }
      } finally {
        window.clearTimeout(safetyTimer);
        if (!cancelled) setLoading(false);
      }
    }

    void prepare();

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
      // Do not revoke here during React Strict Mode remounts mid-prepare;
      // handleClose / final unmount path below covers active sessions.
    };
  }, [game.id, game.entryPath, game.playKind, game.productionAppUrl, game.embeddedAppUrl]);

  useEffect(() => {
    return () => {
      revokeRef.current?.();
      revokeRef.current = undefined;
    };
  }, []);

  const endSession = () => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    const playedMs = Date.now() - startedAtRef.current;
    if (playedMs > 1000) onSessionEnd(game.id, playedMs);
  };

  const handleClose = () => {
    endSession();
    revokeRef.current?.();
    revokeRef.current = undefined;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    onClose();
  };

  const handleFrameLoad = () => {
    const frame = iframeRef.current;
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      const title = doc?.title || '';
      const bodyText = doc?.body?.innerText?.trim() || '';
      // SPA rewrite mistake: our app shell leaked into the game iframe.
      if (/unilive/i.test(title) && doc?.getElementById('root')) {
        setFrameHint(
          'The game URL hit the app shell instead of game files. Re-import the ZIP and try again.',
        );
        return;
      }
      if (!bodyText && !(doc?.querySelector('canvas, iframe, #game, #GameCanvas, body > *'))) {
        setFrameHint('Game frame loaded but looks empty. Try re-importing the ZIP.');
      }
    } catch {
      // Cross-origin (unexpected) — ignore.
    }
  };

  const openInNewTab = () => {
    if (launch?.url) {
      window.open(launch.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (launch?.srcDoc) {
      const w = window.open('', '_blank');
      if (!w) {
        setFrameHint('Popup blocked — allow popups to open the game in a new tab.');
        return;
      }
      w.document.open();
      w.document.write(launch.srcDoc);
      w.document.close();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[5000] bg-black flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-zinc-950 pt-[max(0.75rem,var(--app-safe-top))] shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-black text-white truncate">{game.name}</p>
          <p className="text-[10px] text-white/60 font-semibold truncate">
            {game.playKind === 'web'
              ? `Playing in browser${launch ? ` · ${launch.mode}` : ''}`
              : 'Desktop executable'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {game.playKind === 'web' && launch && (
            <button
              type="button"
              onClick={openInNewTab}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Open in new tab"
              title="Open in new tab"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close game"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative bg-black">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white z-10">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-bold">Preparing game…</p>
          </div>
        )}

        {(error || frameHint) && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white z-10 bg-black/80">
            <p className="text-sm font-bold max-w-md">{error || frameHint}</p>
            <p className="text-[11px] text-white/60 font-semibold max-w-sm">
              Remove the game from My Library, re-import the ZIP, then tap Play Now again.
            </p>
            <div className="flex gap-2">
              {launch && (
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black"
                >
                  Open in new tab
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-white text-black text-xs font-black"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {!loading && !error && game.playKind === 'web' && launch?.srcDoc && (
          <iframe
            ref={iframeRef}
            title={game.name}
            srcDoc={launch.srcDoc}
            className="absolute inset-0 w-full h-full border-0 bg-black"
            allow="fullscreen; gamepad; autoplay; clipboard-read; clipboard-write"
            onLoad={handleFrameLoad}
          />
        )}

        {!loading && !error && game.playKind === 'web' && launch?.url && !launch.srcDoc && (
          <iframe
            ref={iframeRef}
            title={game.name}
            src={launch.url}
            className="absolute inset-0 w-full h-full border-0 bg-black"
            allow="fullscreen; gamepad; autoplay; clipboard-read; clipboard-write"
            onLoad={handleFrameLoad}
          />
        )}

        {!loading && !error && game.playKind === 'native' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center text-white">
            <div className="p-4 rounded-2xl bg-white/10">
              <Monitor className="w-10 h-10" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-lg font-black">Ready for desktop launch</h3>
              <p className="text-xs text-white/70 font-semibold leading-relaxed">
                Browsers cannot run {game.fileName} directly. Download it and open it on your computer.
              </p>
            </div>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={game.fileName}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:opacity-90 transition-opacity"
              >
                <Download className="w-4 h-4" />
                Download &amp; Run
              </a>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
