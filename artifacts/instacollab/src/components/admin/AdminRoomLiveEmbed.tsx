import React, { useMemo, useState } from 'react';
import { ExternalLink, Maximize2, Radio, X } from 'lucide-react';
import { LiveDiscoveryVideoPreview } from '../live/LiveDiscoveryVideoPreview';
import { appBasePath } from '../../lib/appShellRoutes';
import { safeAvatarUrl } from '../../lib/safe';
import { isLiveKitConfigured } from '../../lib/livekit/livekitConfig';
import { isTencentWebARConfigured } from '../../lib/webar/webarConfig';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { getStoredOwnerPartyRoomId } from '../../smule-rooms/utils/ownerPartyRoomId';

export type AdminRoomLiveEmbedProps = {
  roomId?: string | null;
  roomMode?: string | null;
  hostUserId?: string | null;
  streamId?: string | null;
  posterUrl?: string | null;
  compact?: boolean;
  /** Near full-viewport height — identical in-app room UI for admin watch */
  fullViewport?: boolean;
  title?: string;
};

export function AdminRoomLiveEmbed({
  roomId,
  roomMode,
  hostUserId,
  streamId,
  posterUrl,
  compact = false,
  fullViewport = false,
  title,
}: AdminRoomLiveEmbedProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const resolvedRoomId = roomId ?? (hostUserId ? getStoredOwnerPartyRoomId(hostUserId) : null);

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

  return (
    <>
      <div className="rounded-2xl border border-border overflow-hidden bg-black/95">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-secondary/20">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground truncate">
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

        <div className={`relative w-full bg-black ${inlineHeight}`}>
          {embedSrc ? (
            <iframe
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

        <div className="px-3 py-2 border-t border-border/60 bg-secondary/10 flex flex-wrap gap-1.5">
          <ServiceChip label="Supabase" ok={isSupabaseConfigured()} />
          <ServiceChip label="LiveKit" ok={liveReady} />
          <ServiceChip label="TRTC Beauty" ok={isTencentWebARConfigured()} />
          <span className="text-[10px] text-muted-foreground self-center ml-auto">
            {roomMode ? `${roomMode} · ` : ''}Same in-app room UI · real-time stream
          </span>
        </div>
      </div>

      {fullscreen ? (
        <AdminRoomLiveWatchOverlay
          embedSrc={embedSrc}
          hostUserId={hostUserId}
          streamId={streamId}
          posterUrl={posterUrl}
          title={title}
          onClose={() => setFullscreen(false)}
        />
      ) : null}
    </>
  );
}

function AdminRoomLiveWatchOverlay({
  embedSrc,
  hostUserId,
  streamId,
  posterUrl,
  title,
  onClose,
}: {
  embedSrc: string | null;
  hostUserId?: string | null;
  streamId?: string | null;
  posterUrl?: string | null;
  title?: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[4000] bg-black" data-app-overlay-root>
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="min-w-0">
          <div className="text-sm font-black text-white truncate">{title ?? 'Live watch'}</div>
          <div className="text-[11px] text-white/70">Fullscreen · identical in-app room</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute inset-0">
        {embedSrc ? (
          <iframe
            src={embedSrc}
            title={title ?? 'Live watch fullscreen'}
            className="w-full h-full border-0"
            allow="camera; microphone; autoplay; fullscreen; display-capture; encrypted-media"
          />
        ) : (
          <LiveDiscoveryVideoPreview
            posterUrl={safeAvatarUrl(posterUrl ?? undefined)}
            hostUserId={hostUserId ?? undefined}
            streamId={streamId ?? undefined}
            className="w-full h-full"
          />
        )}
      </div>
    </div>
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
