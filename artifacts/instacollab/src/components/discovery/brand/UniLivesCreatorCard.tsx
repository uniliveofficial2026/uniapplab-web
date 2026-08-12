import React from 'react';
import { UserPlus } from 'lucide-react';
import { handleAvatarError } from '../../../lib/utils';

type Props = {
  userId: string;
  username: string;
  avatarUrl: string;
  following: boolean;
  onFollowClick: () => void;
  className?: string;
};

/**
 * Creator card chrome. Parent supplies identity + follow handler.
 * Stable key must be userId at the list level.
 */
export function UniLivesCreatorCard({
  userId,
  username,
  avatarUrl,
  following,
  onFollowClick,
  className = 'shrink-0 w-28 rounded-2xl border border-[color:var(--color-unilives-discovery-border)] bg-[color:var(--color-unilives-discovery-surface)]/80 p-3 flex flex-col items-center text-center',
}: Props) {
  return (
    <div className={className} data-user-id={userId} data-unilives-creator-card="">
      <div className="h-14 w-14 rounded-full overflow-hidden mb-2 bg-[color:var(--color-unilives-discovery-border)]">
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={handleAvatarError}
        />
      </div>
      <span className="text-xs font-bold truncate w-full text-[color:var(--color-unilives-discovery-text)]">
        {username}
      </span>
      <button
        type="button"
        onClick={onFollowClick}
        className={`mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 ${
          following
            ? 'bg-[color:var(--color-unilives-discovery-surface)] text-[color:var(--color-unilives-discovery-text)] border border-[color:var(--color-unilives-discovery-border)]'
            : 'bg-[color:var(--color-unilives-discovery-selected)] text-white'
        }`}
      >
        <UserPlus className="h-3 w-3" />
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}
