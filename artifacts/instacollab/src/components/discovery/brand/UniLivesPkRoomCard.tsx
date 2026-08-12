import React from 'react';

type Props = {
  /** Authoritative label from liveKind / room metadata — never inferred from title. */
  label: string;
  className?: string;
};

/**
 * PK / team-PK visual pill. Parent must pass label only when authoritative metadata says so.
 */
export function UniLivesPkRoomCard({
  label,
  className = 'inline-flex items-center rounded-md bg-[color:var(--color-unilives-discovery-pk)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white',
}: Props) {
  return (
    <span className={className} data-unilives-pk-label="">
      {label}
    </span>
  );
}
