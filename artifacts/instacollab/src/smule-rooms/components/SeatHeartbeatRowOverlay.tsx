import React from 'react';

export const SEAT_HEARTBEAT_BUMP_ACTIVE =
  'M 0 20 L 12 20 L 14 24 L 17 4 L 20 34 L 23 12 L 25 20 L 36 20';
export const SEAT_HEARTBEAT_BUMP_FLAT = 'M 0 20 L 36 20';

export type SeatHeartbeatLink = {
  left: string;
  right: string;
  relKey: string;
  color: string;
  glowColor: string;
};

type SeatHeartbeatRowOverlayProps = {
  segments: ReadonlyArray<SeatHeartbeatLink>;
  mutuallyFollowing: Record<string, boolean>;
  activeSeats: Record<string, unknown | null | undefined>;
  onToggle: (left: string, right: string) => void;
  slotClassPrefix?: 'party-heartbeat-slot' | 'watch-together-heartbeat-slot';
};

export function SeatHeartbeatRowOverlay({
  segments,
  mutuallyFollowing,
  activeSeats,
  onToggle,
  slotClassPrefix = 'party-heartbeat-slot',
}: SeatHeartbeatRowOverlayProps) {
  return (
    <div className="party-heartbeat-row pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      {segments.map((segment, index) => {
        const bothSeated = Boolean(activeSeats[segment.left] && activeSeats[segment.right]);
        if (!bothSeated) {
          return null;
        }

        const lit = !!mutuallyFollowing[segment.relKey];
        return (
          <div
            key={segment.relKey}
            className={`${slotClassPrefix} ${slotClassPrefix}-${index} pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer`}
            onClick={() => onToggle(segment.left, segment.right)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onToggle(segment.left, segment.right);
              }
            }}
          >
            <svg viewBox="0 0 36 40" preserveAspectRatio="none" className="party-heartbeat-segment">
              {lit && (
                <path
                  d={SEAT_HEARTBEAT_BUMP_ACTIVE}
                  fill="none"
                  stroke={segment.glowColor}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className="animate-heart-rate"
                  style={{ filter: `drop-shadow(0px 0px 4px ${segment.color})` }}
                />
              )}
              <path
                d={lit ? SEAT_HEARTBEAT_BUMP_ACTIVE : SEAT_HEARTBEAT_BUMP_FLAT}
                fill="none"
                stroke={lit ? segment.color : '#d1d5db'}
                strokeWidth={lit ? '2.2' : '1.2'}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className={lit ? 'animate-heart-rate' : 'animate-flatline'}
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
