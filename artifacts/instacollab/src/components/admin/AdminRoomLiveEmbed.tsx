import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban, Calendar, Clock, ExternalLink, Eye, Maximize2, Minimize2, Radio, Sofa, Square, X } from 'lucide-react';
import { LiveDiscoveryVideoPreview } from '../live/LiveDiscoveryVideoPreview';
import { appBasePath } from '../../lib/appShellRoutes';
import { useAppPortalRoot } from '../../lib/appPortalRoot';
import { safeAvatarUrl } from '../../lib/safe';
import { isLiveKitConfigured } from '../../lib/livekit/livekitConfig';
import { isTencentWebARConfigured } from '../../lib/webar/webarConfig';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { getStoredOwnerPartyRoomId } from '../../smule-rooms/utils/ownerPartyRoomId';
import {
  adminBanPartyRoom,
  adminBanStream,
  adminEndPartyRoom,
  adminStopStream,
} from '../../lib/adminApi';
import {
  postPlatformAdminModeration,
  type PlatformAdminModAction,
} from '../../lib/admin/platformAdminModerationBridge';

export type AdminRoomLiveEmbedProps = {
  roomId?: string | null;
  roomMode?: string | null;
  hostUserId?: string | null;
  streamId?: string | null;
  posterUrl?: string | null;
  /** ISO / epoch start of the live session (stream started_at or party created_at). */
  startedAt?: string | number | null;
  compact?: boolean;
  /** Near full-viewport height — identical in-app room UI for admin watch */
  fullViewport?: boolean;
  title?: string;
  /** Called after Stop / Ban host succeeds so the Control Center list can refresh. */
  onModerationComplete?: () => void;
};

const FULLSCREEN_BODY_CLASS = 'admin-live-watch-fullscreen';

function parseStartedMs(value?: string | number | null): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

function formatStreamDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatStreamTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatLiveDuration(startedMs: number, nowMs: number): string {
  const totalSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

async function enterBrowserFullscreen(el: HTMLElement): Promise<void> {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return;
    }
    if (anyEl.webkitRequestFullscreen) {
      await anyEl.webkitRequestFullscreen();
      return;
    }
    if (anyEl.msRequestFullscreen) {
      await anyEl.msRequestFullscreen();
    }
  } catch {
    /* browser may deny — fixed portal still covers the app shell */
  }
}

async function exitBrowserFullscreen(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }
    if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
      return;
    }
    if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }
  } catch {
    /* ignore */
  }
}

export function AdminRoomLiveEmbed({
  roomId,
  roomMode,
  hostUserId,
  streamId,
  posterUrl,
  startedAt,
  compact = false,
  fullViewport = false,
  title,
  onModerationComplete,
}: AdminRoomLiveEmbedProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [moderationBusy, setModerationBusy] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement | null>(null);
  const resolvedRoomId = roomId ?? (hostUserId ? getStoredOwnerPartyRoomId(hostUserId) : null);
  const startedMs = useMemo(() => parseStartedMs(startedAt), [startedAt]);

  useEffect(() => {
    if (startedMs == null) return undefined;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedMs]);

  const embedSrc = useMemo(() => {
    if (!resolvedRoomId) return null;
    const base = appBasePath();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}${base}/admin-embed/room/${encodeURIComponent(String(resolvedRoomId))}?fidelity=full&watch=1`;
  }, [resolvedRoomId]);

  const liveReady = isSupabaseConfigured() && isLiveKitConfigured();
  const inlineHeight = fullViewport
    ? 'min-h-[min(92dvh,960px)]'
    : compact
      ? 'min-h-[420px]'
      : 'min-h-[75vh]';

  const streamDateLabel = startedMs != null ? formatStreamDate(startedMs) : null;
  const streamTimeLabel = startedMs != null ? formatStreamTime(startedMs) : null;
  const liveForLabel = startedMs != null ? formatLiveDuration(startedMs, nowMs) : null;

  const runStopLive = async () => {
    if (moderationBusy) return;
    setModerationError(null);
    setModerationBusy(true);
    try {
      const hostOpts = hostUserId ? { hostUserId: String(hostUserId) } : undefined;
      // Prefer party-room end when we have a room id — silent watch embeds party rooms.
      if (resolvedRoomId) {
        await adminEndPartyRoom(String(resolvedRoomId), hostOpts);
        if (streamId) {
          await adminStopStream(String(streamId), {
            partyRoomId: String(resolvedRoomId),
            hostUserId: hostUserId ? String(hostUserId) : undefined,
          }).catch(() => undefined);
        }
      } else if (streamId) {
        await adminStopStream(String(streamId), hostOpts);
      } else {
        throw new Error('No stream or room id to stop');
      }
      onModerationComplete?.();
    } catch (error) {
      setModerationError(error instanceof Error ? error.message : 'Stop live failed');
    } finally {
      setModerationBusy(false);
    }
  };

  const runBanHost = async () => {
    if (moderationBusy) return;
    if (
      !window.confirm(
        'Stop this live and ban the host? They cannot go live until unbanned.',
      )
    ) {
      return;
    }
    setModerationError(null);
    setModerationBusy(true);
    try {
      const hostOpts = hostUserId ? { hostUserId: String(hostUserId) } : undefined;
      if (resolvedRoomId) {
        await adminBanPartyRoom(
          String(resolvedRoomId),
          'Live room banned by platform admin',
          hostOpts,
        );
        if (streamId) {
          await adminBanStream(String(streamId), 'Live stream banned by platform admin', {
            partyRoomId: String(resolvedRoomId),
            hostUserId: hostUserId ? String(hostUserId) : undefined,
          }).catch(() => undefined);
        }
      } else if (streamId) {
        await adminBanStream(
          String(streamId),
          'Live stream banned by platform admin',
          hostOpts,
        );
      } else {
        throw new Error('No stream or room id to ban');
      }
      onModerationComplete?.();
    } catch (error) {
      setModerationError(error instanceof Error ? error.message : 'Ban host failed');
    } finally {
      setModerationBusy(false);
    }
  };

  const sendRoomModeration = (action: PlatformAdminModAction) => {
    const ok =
      postPlatformAdminModeration(fullscreenIframeRef.current, action, resolvedRoomId) ||
      postPlatformAdminModeration(iframeRef.current, action, resolvedRoomId);
    if (!ok) {
      setModerationError('Room watch not ready — wait for the preview to load.');
    } else {
      setModerationError(null);
    }
  };

  const moderationBar = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={moderationBusy || (!streamId && !resolvedRoomId)}
          onClick={() => void runStopLive()}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-red-500/45 bg-red-500/15 px-3.5 py-2 text-xs font-black text-red-300 transition enabled:hover:bg-red-500/25 disabled:opacity-40"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          Stop Live
        </button>
        <button
          type="button"
          disabled={moderationBusy || (!streamId && !resolvedRoomId)}
          onClick={() => void runBanHost()}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-black text-white shadow-lg shadow-red-600/25 transition enabled:hover:bg-red-500 disabled:opacity-40"
        >
          <Ban className="h-3.5 w-3.5" />
          Ban Host
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!embedSrc}
          onClick={() => sendRoomModeration('seats')}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-[11px] font-black text-foreground transition enabled:hover:bg-secondary disabled:opacity-40"
        >
          <Sofa className="h-3.5 w-3.5 text-purple-500" />
          Seats
        </button>
        <button
          type="button"
          disabled={!embedSrc}
          onClick={() => sendRoomModeration('ban-seats')}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-[11px] font-black text-orange-600 transition enabled:hover:bg-orange-500/20 disabled:opacity-40"
        >
          <Ban className="h-3.5 w-3.5" />
          Ban seats
        </button>
        <button
          type="button"
          disabled={!embedSrc}
          onClick={() => sendRoomModeration('viewers')}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-[11px] font-black text-foreground transition enabled:hover:bg-secondary disabled:opacity-40"
        >
          <Eye className="h-3.5 w-3.5 text-cyan-600" />
          Viewers
        </button>
        {moderationError ? (
          <span className="text-[10px] font-bold text-red-400">{moderationError}</span>
        ) : (
          <span className="text-[10px] font-semibold text-muted-foreground">
            Outside the room · does not cover taps
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="rounded-2xl border border-border overflow-hidden bg-black/95">
        <div className="flex flex-col gap-1.5 px-3 py-2 border-b border-border/60 bg-secondary/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground truncate min-w-0">
              {title ?? (resolvedRoomId ? `Room ${resolvedRoomId}` : 'Live stream')}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                <Radio className="w-3 h-3" /> Live watch
              </span>
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-primary px-2 py-0.5 rounded-full border border-primary/30 min-h-[28px]"
              >
                <Maximize2 className="w-3 h-3" /> Fullscreen
              </button>
              {embedSrc ? (
                <a
                  href={embedSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground px-2 py-0.5 rounded-full border border-border min-h-[28px]"
                >
                  <ExternalLink className="w-3 h-3" /> Tab
                </a>
              ) : null}
            </div>
          </div>

          {startedMs != null ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-muted-foreground">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Calendar className="w-3 h-3 shrink-0 text-foreground/70" aria-hidden />
                <span className="text-foreground/90">{streamDateLabel}</span>
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="w-3 h-3 shrink-0 text-foreground/70" aria-hidden />
                <span className="text-foreground/90">Started {streamTimeLabel}</span>
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums text-red-500/90">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
                Live {liveForLabel}
              </span>
            </div>
          ) : null}
        </div>

        <div className={`relative w-full bg-black ${inlineHeight}`}>
          {embedSrc ? (
            <iframe
              ref={iframeRef}
              src={embedSrc}
              title={title ?? `Room ${resolvedRoomId} live preview`}
              className="absolute inset-0 w-full h-full border-0"
              allow="camera; microphone; autoplay; fullscreen; display-capture; encrypted-media"
              loading={fullViewport ? 'eager' : 'lazy'}
            />
          ) : (
            <LiveDiscoveryVideoPreview
              posterUrl={safeAvatarUrl(posterUrl ?? undefined)}
              hostUserId={hostUserId ?? undefined}
              streamId={streamId ?? undefined}
              className="absolute inset-0 w-full h-full"
            />
          )}
        </div>

        <div className="px-3 py-2.5 border-t border-border/60 bg-secondary/10 space-y-2">
          {moderationBar}
          <div className="flex flex-wrap gap-1.5">
            <ServiceChip label="Supabase" ok={isSupabaseConfigured()} />
            <ServiceChip label="LiveKit" ok={liveReady} />
            <ServiceChip label="TRTC Beauty" ok={isTencentWebARConfigured()} />
            <span className="text-[10px] text-muted-foreground self-center ml-auto">
              {roomMode ? `${roomMode} · ` : ''}Admin silent watch · host not notified
            </span>
          </div>
        </div>
      </div>

      {fullscreen ? (
        <AdminRoomLiveWatchOverlay
          embedSrc={embedSrc}
          hostUserId={hostUserId}
          streamId={streamId}
          posterUrl={posterUrl}
          title={title}
          moderationBar={moderationBar}
          iframeRef={fullscreenIframeRef}
          onClose={() => setFullscreen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * True live-room fullscreen: portaled to document.body, covers shell nav,
 * edge-to-edge iframe (no chrome overlay on the room UI).
 */
function AdminRoomLiveWatchOverlay({
  embedSrc,
  hostUserId,
  streamId,
  posterUrl,
  title,
  moderationBar,
  iframeRef,
  onClose,
}: {
  embedSrc: string | null;
  hostUserId?: string | null;
  streamId?: string | null;
  posterUrl?: string | null;
  title?: string;
  moderationBar?: React.ReactNode;
  iframeRef?: React.MutableRefObject<HTMLIFrameElement | null>;
  onClose: () => void;
}) {
  const portalRoot = useAppPortalRoot();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.classList.add(FULLSCREEN_BODY_CLASS);
    document.documentElement.classList.add(FULLSCREEN_BODY_CLASS);
    document.body.style.overflow = 'hidden';

    const stage = stageRef.current;
    if (stage) {
      void enterBrowserFullscreen(stage);
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      document.body.classList.remove(FULLSCREEN_BODY_CLASS);
      document.documentElement.classList.remove(FULLSCREEN_BODY_CLASS);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      void exitBrowserFullscreen();
    };
  }, []);

  const handleClose = () => {
    void exitBrowserFullscreen().finally(() => onCloseRef.current());
  };

  if (!portalRoot) return null;

  return createPortal(
    <div
      ref={stageRef}
      className="fixed inset-0 z-[10000] flex flex-col bg-black"
      data-app-overlay-root
      data-admin-live-watch-fullscreen="true"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Live room fullscreen'}
    >
      {/* Room fills remaining space — tools sit in a separate bottom bar (no overlay on taps) */}
      <div className="relative min-h-0 flex-1">
        {embedSrc ? (
          <iframe
            ref={iframeRef}
            src={embedSrc}
            title={title ?? 'Live watch fullscreen'}
            className="absolute inset-0 h-full w-full border-0"
            allow="camera; microphone; autoplay; fullscreen; display-capture; encrypted-media"
          />
        ) : (
          <LiveDiscoveryVideoPreview
            posterUrl={safeAvatarUrl(posterUrl ?? undefined)}
            hostUserId={hostUserId ?? undefined}
            streamId={streamId ?? undefined}
            className="absolute inset-0 h-full w-full"
          />
        )}
      </div>

      <div
        className="shrink-0 space-y-2 border-t border-white/10 bg-zinc-950 px-3 py-2.5"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
            Platform admin tools
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/10"
          >
            <Minimize2 className="h-3.5 w-3.5" aria-hidden />
            Exit
            <X className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </button>
        </div>
        {moderationBar}
      </div>
    </div>,
    portalRoot,
  );
}

function ServiceChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${
        ok ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-secondary text-muted-foreground border-border'
      }`}
    >
      {label}
    </span>
  );
}
