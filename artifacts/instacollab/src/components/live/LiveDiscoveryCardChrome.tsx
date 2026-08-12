import React from 'react';
import { Lock, Globe2 } from 'lucide-react';
import { safeAvatarUrl } from '../../lib/safe';
import { handleMediaError } from '../../lib/utils';
import { formatViewerCount } from '../../lib/live/formatViewerCount';
import {
  formatRoomPrivacyLabel,
  normalizeRoomPrivacy,
  type RoomPrivacy,
} from '../../smule-rooms/utils/roomPrivacy';
import { countryFlagEmoji } from './LiveFiltersPanel';
import { UniLivesPkRoomCard } from '../discovery/brand';

export type LiveDiscoveryViewerAvatar = {
  id: string;
  avatarUrl?: string | null;
};

type LiveDiscoveryCardChromeProps = {
  viewerCount: number;
  viewerAvatars?: LiveDiscoveryViewerAvatar[];
  caption?: string;
  country?: string;
  /** Public / Private — shown as a top pill separate from room-type caption. */
  privacy?: RoomPrivacy | string | null;
  hostName: string;
  hostAvatarUrl?: string | null;
  title: string;
  subtitle?: string;
  /** Optional pill at bottom (e.g. Join). */
  actionLabel?: string;
  /**
   * PK label only when parent passes authoritative liveKind === 'pk'.
   * Never infer from title/cover.
   */
  pkLabel?: string;
};

/**
 * Discovery card overlay — always above LiveDiscoveryVideoPreview media layer.
 */
export function LiveDiscoveryCardChrome({
  viewerCount,
  viewerAvatars = [],
  caption = 'Live',
  country,
  privacy,
  hostName,
  hostAvatarUrl,
  title,
  subtitle,
  actionLabel,
  pkLabel,
}: LiveDiscoveryCardChromeProps) {
  const privacyMode = normalizeRoomPrivacy(privacy);
  const privacyLabel = formatRoomPrivacyLabel(privacyMode);
  const isPrivate = privacyMode === 'Private';

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/30 to-black/15" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-1 p-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <span className="bg-[color:var(--color-unilives-discovery-live)] text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse motion-reduce:animate-none shadow-sm">
            LIVE
          </span>
          {pkLabel ? <UniLivesPkRoomCard label={pkLabel} /> : null}
          <span
            className={
              isPrivate
                ? 'inline-flex items-center gap-0.5 rounded-md border border-amber-300/40 bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black shadow-sm'
                : 'inline-flex items-center gap-0.5 rounded-md border border-emerald-300/35 bg-emerald-500/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black shadow-sm'
            }
            title={isPrivate ? 'Private room — key required to join' : 'Public room'}
          >
            {isPrivate ? <Lock size={10} strokeWidth={2.5} /> : <Globe2 size={10} strokeWidth={2.5} />}
            {privacyLabel}
          </span>
        </div>
        <span className="bg-black/55 backdrop-blur-sm text-white text-[10px] font-bold pl-1 pr-1.5 py-0.5 rounded-md flex items-center gap-1 border border-white/10 shrink-0 tabular-nums">
          {viewerAvatars.length > 0 ? (
            <span className="flex -space-x-1.5 mr-0.5">
              {viewerAvatars.map((viewer) => (
                <img
                  key={viewer.id}
                  src={safeAvatarUrl(viewer.avatarUrl ?? undefined)}
                  alt=""
                  className="w-4 h-4 rounded-full border border-black/60 object-cover bg-secondary"
                  onError={handleMediaError}
                />
              ))}
            </span>
          ) : null}
          {formatViewerCount(viewerCount)}
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1 p-2.5">
        {(country || caption) && (
          <div className="flex items-center justify-between gap-1">
            {country ? (
              <span className="inline-flex max-w-[60%] items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white/90 border border-white/10">
                <span className="text-[11px] leading-none shrink-0" aria-hidden>
                  {countryFlagEmoji(country)}
                </span>
                <span className="truncate uppercase">{country}</span>
              </span>
            ) : (
              <span />
            )}
            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/85 drop-shadow-sm shrink-0">
              {caption}
            </span>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="w-9 h-9 rounded-full border-2 border-white overflow-hidden shrink-0 shadow-md bg-secondary">
            <img
              src={safeAvatarUrl(hostAvatarUrl ?? undefined)}
              alt=""
              className="w-full h-full object-cover"
              onError={handleMediaError}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white text-sm truncate drop-shadow-md">{hostName}</p>
            <p className="text-[10px] text-white/85 truncate drop-shadow-sm">{title}</p>
            {subtitle ? (
              <p className="text-[10px] text-white/70 truncate drop-shadow-sm">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {actionLabel ? (
          <span className="mt-1 inline-flex w-fit items-center rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-foreground shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition">
            {actionLabel}
          </span>
        ) : null}
      </div>
    </>
  );
}
