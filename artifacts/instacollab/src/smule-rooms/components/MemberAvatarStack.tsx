import React from 'react';
import { resolveRoomMemberIdentity } from '../utils/roomMemberProfile';

export type MemberAvatarEntry = {
  userId?: string;
  name: string;
};

export function MemberAvatarStack({
  members,
  names,
  roomId,
  mediaVersion = 0,
  max = 3,
  size = 'md',
}: {
  members?: MemberAvatarEntry[];
  /** @deprecated Prefer `members` with user ids for correct avatar resolution. */
  names?: string[];
  roomId: string;
  mediaVersion?: number;
  max?: number;
  size?: 'sm' | 'md';
}) {
  const entries: MemberAvatarEntry[] =
    members ??
    names?.map((name) => ({ name })) ??
    [];

  if (entries.length === 0) {
    return <span className="text-xs italic text-muted-foreground/70">Not set</span>;
  }

  const avatarSize = size === 'sm' ? 64 : 80;
  const visible = entries.slice(0, max);
  const overflow = entries.length - visible.length;
  const avatarClass =
    size === 'sm'
      ? 'h-8 w-8 rounded-full border border-border object-cover shadow-sm'
      : 'h-10 w-10 rounded-full border-2 border-border object-cover shadow-sm';

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((entry) => {
        const identity = resolveRoomMemberIdentity(
          entry.userId,
          entry.name,
          roomId,
          avatarSize,
        );
        const key = identity.userId ?? entry.name;
        return (
          <img
            key={`${key}-${mediaVersion}`}
            src={identity.avatarUrl}
            className={avatarClass}
            alt={identity.name}
            title={identity.name}
          />
        );
      })}
      {overflow > 0 ? (
        <span className="ml-2 text-xs font-bold text-muted-foreground">+{overflow}</span>
      ) : null}
    </div>
  );
}
