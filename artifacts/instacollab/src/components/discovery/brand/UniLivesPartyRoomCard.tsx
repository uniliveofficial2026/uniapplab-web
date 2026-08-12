import React from 'react';

type Props = {
  roomId: string;
  children: React.ReactNode;
  href?: string;
  className?: string;
  asLink?: boolean;
};

/**
 * Party room list card chrome. Parent supplies Link/navigation and room metadata.
 */
export function UniLivesPartyRoomCard({
  roomId,
  children,
  className = 'bg-[color:var(--color-unilives-discovery-surface)] border border-[color:var(--color-unilives-discovery-border)] p-4 rounded-3xl flex justify-between items-center hover:opacity-95 transition cursor-pointer block',
}: Props) {
  return (
    <div className={className} data-room-id={roomId} data-unilives-party-room-card="">
      {children}
    </div>
  );
}
