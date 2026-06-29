import React from 'react';
import {
  formatRoomHostMeta,
  resolveRoomHostDisplay,
  type RoomHostDisplay,
} from '../utils/roomHostDisplay';

type RoomHostLabelProps = {
  roomId: string;
  storedHostName?: string | null;
  className?: string;
  /** When true, show @handle on a second line instead of inline meta. */
  stacked?: boolean;
  primaryClassName?: string;
  secondaryClassName?: string;
};

export function resolveRoomHostLabel(
  roomId: string,
  storedHostName?: string | null,
): RoomHostDisplay {
  return resolveRoomHostDisplay(roomId, storedHostName);
}

export function RoomHostLabel({
  roomId,
  storedHostName,
  className = '',
  stacked = false,
  primaryClassName = 'font-medium truncate',
  secondaryClassName = 'text-[10px] text-muted-foreground truncate',
}: RoomHostLabelProps) {
  const host = resolveRoomHostDisplay(roomId, storedHostName);

  if (stacked && host.handle) {
    return (
      <span className={`flex min-w-0 flex-col ${className}`}>
        <span className={primaryClassName}>{host.displayName}</span>
        <span className={secondaryClassName}>{host.handle}</span>
      </span>
    );
  }

  return <span className={`truncate ${className || primaryClassName}`}>{formatRoomHostMeta(host)}</span>;
}
