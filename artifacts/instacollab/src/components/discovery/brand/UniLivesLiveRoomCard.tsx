import React from 'react';

type Props = {
  roomId?: string;
  children: React.ReactNode;
  onClick?: () => void;
  onPointerDown?: () => void;
  className?: string;
  /** Authoritative liveKind label from parent (e.g. PK / Audio) — display only. */
  liveKindLabel?: string;
};

/**
 * Live room card shell. Parent owns openLiveUserRoom + preview media.
 * Room/user IDs must come from authoritative discovery records.
 */
export function UniLivesLiveRoomCard({
  roomId,
  children,
  onClick,
  onPointerDown,
  className = 'relative aspect-[3/4] rounded-2xl overflow-hidden group border border-[color:var(--color-unilives-discovery-border)] bg-[color:var(--color-unilives-discovery-surface)] text-left',
  liveKindLabel,
}: Props) {
  return (
    <button
      type="button"
      data-room-id={roomId}
      data-live-kind={liveKindLabel || undefined}
      data-unilives-live-room-card=""
      onPointerDown={onPointerDown}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}
