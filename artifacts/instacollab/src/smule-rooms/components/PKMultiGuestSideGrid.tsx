import type { CSSProperties } from 'react';
import { safeAvatarUrl } from '../../lib/safe';
import { useSeatTileTap } from '../hooks/useSeatTileTap';
import {
  formatMultiGuestSeatLabel,
  getMultiGuestVideoGridClass,
  getMultiGuestVideoLayout,
  resolveMergedHostTileSeats,
  type MultiGuestSeatCount,
  type MultiGuestVideoLayoutItem,
  type PartySeatMap,
} from '../utils/roomSeats';

type PKMultiGuestSideGridProps = {
  side: 'a' | 'b';
  seatCount: MultiGuestSeatCount;
  seats: PartySeatMap;
  className?: string;
  onSeatGiftClick?: (guest: { name: string; userId?: string; avatar?: string }) => void;
  onSeatFullscreen?: (guest: {
    seatKey: string;
    name: string;
    userId?: string;
    avatar?: string;
  }) => void;
};

function PKMultiGuestTile({
  layoutItem,
  seats,
  seatCount,
  accent,
  onSeatGiftClick,
  onSeatFullscreen,
  onSeatTileTap,
}: {
  layoutItem: MultiGuestVideoLayoutItem;
  seats: PartySeatMap;
  seatCount: MultiGuestSeatCount;
  accent: 'fuchsia' | 'cyan';
  onSeatGiftClick?: (guest: { name: string; userId?: string; avatar?: string }) => void;
  onSeatFullscreen?: (guest: {
    seatKey: string;
    name: string;
    userId?: string;
    avatar?: string;
  }) => void;
  onSeatTileTap: ReturnType<typeof useSeatTileTap>;
}) {
  const { seatKey: key, colSpan = 1, rowSpan = 1, gridColumn, gridRow, foldedSeatKeys } = layoutItem;
  const merged = foldedSeatKeys ? resolveMergedHostTileSeats(foldedSeatKeys, seats) : null;
  const displayKey = merged?.primaryKey ?? key;
  const guest = merged?.primaryGuest ?? seats[key];
  const label = formatMultiGuestSeatLabel(key, seatCount, { uppercase: true });
  const isHostExpanded = key === 'host' && (colSpan >= 2 || gridColumn === '1 / 4');
  const ring =
    accent === 'fuchsia'
      ? 'from-fuchsia-500/35 via-pink-500/15 to-transparent'
      : 'from-cyan-500/35 via-blue-500/15 to-transparent';
  const scoreClass = accent === 'fuchsia' ? 'text-fuchsia-300' : 'text-cyan-300';
  const tileClassName = [
    'multi-guest-video-tile pk-multi-guest-video-tile',
    !gridColumn && colSpan === 2 ? 'multi-guest-video-tile--col-span-2' : '',
    !gridRow && rowSpan === 2 ? 'multi-guest-video-tile--row-span-2' : '',
    isHostExpanded ? 'multi-guest-video-tile--host-expanded' : '',
    isHostExpanded && gridColumn === '1 / 4' ? 'multi-guest-video-tile--host-mega' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const tilePlacementStyle: CSSProperties | undefined =
    gridColumn || gridRow
      ? {
          ...(gridColumn ? { gridColumn } : {}),
          ...(gridRow ? { gridRow } : {}),
        }
      : undefined;

  return (
    <button
      key={foldedSeatKeys ? `${key}-mega` : key}
      type="button"
      onClick={() => {
        if (!guest || !onSeatGiftClick) return;
        onSeatTileTap(
          () =>
            onSeatGiftClick({
              name: guest.name,
              userId: guest.userId,
              avatar: guest.avatar,
            }),
          onSeatFullscreen
            ? () =>
                onSeatFullscreen({
                  seatKey: displayKey,
                  name: guest.name,
                  userId: guest.userId,
                  avatar: guest.avatar,
                })
            : undefined,
        );
      }}
      disabled={!guest || !onSeatGiftClick}
      className={`${tileClassName} ${guest && onSeatGiftClick ? 'cursor-pointer' : 'cursor-default'}`}
      style={tilePlacementStyle}
      aria-label={guest ? `Send gift to ${guest.name}` : `Open ${label}`}
    >
      {guest ? (
        <>
          {safeAvatarUrl(guest.avatar) ? (
            <img
              src={safeAvatarUrl(guest.avatar)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />
          )}
          {merged && merged.extraGuests.length > 0 ? (
            <div className="multi-guest-video-tile-folded-pips" aria-hidden>
              {merged.extraGuests.map(({ seatKey, guest: extraGuest }) => (
                <img
                  key={seatKey}
                  src={safeAvatarUrl(extraGuest.avatar)}
                  alt=""
                  className="multi-guest-video-tile-folded-pip"
                  title={formatMultiGuestSeatLabel(seatKey, seatCount)}
                />
              ))}
            </div>
          ) : null}
          <div className="multi-guest-video-tile-overlay" />
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${ring}`} />
          <div className="pk-multi-guest-video-tile-chrome">
            <p className="truncate text-center text-[8px] font-black uppercase tracking-wide text-white/90">
              {label}
            </p>
            <p className="truncate text-center text-[10px] font-black text-white">{guest.name}</p>
            <p className={`text-center text-xs font-black ${scoreClass}`}>{guest.stars}</p>
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-black/55" />
          <div className="multi-guest-video-tile-empty-marker" aria-hidden />
          <div className="pk-multi-guest-video-tile-chrome pk-multi-guest-video-tile-chrome--empty">
            <p className="text-center text-[9px] font-black uppercase tracking-widest text-white/35">
              {label}
            </p>
          </div>
        </>
      )}
    </button>
  );
}

export function PKMultiGuestSideGrid({
  side,
  seatCount,
  seats,
  className = '',
  onSeatGiftClick,
  onSeatFullscreen,
}: PKMultiGuestSideGridProps) {
  const accent = side === 'a' ? 'fuchsia' : 'cyan';
  const layout = getMultiGuestVideoLayout(seatCount);
  const gridClass = getMultiGuestVideoGridClass(seatCount);
  const handleSeatTileTap = useSeatTileTap();

  return (
    <div className={`pk-multi-guest-side-grid multi-guest-video-grid ${gridClass} ${className}`}>
      {layout.map((item) => (
        <PKMultiGuestTile
          key={item.foldedSeatKeys ? `${item.seatKey}-mega` : item.seatKey}
          layoutItem={item}
          seats={seats}
          seatCount={seatCount}
          accent={accent}
          onSeatGiftClick={onSeatGiftClick}
          onSeatFullscreen={onSeatFullscreen}
          onSeatTileTap={handleSeatTileTap}
        />
      ))}
    </div>
  );
}
