import React from 'react';
import { Star } from 'lucide-react';

function truncateName(name: string, max = 14): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

/** Host profile chip — same markup as Watch Together / live room chat header. */
export function RoomOwnerProfileChip({
  name,
  avatarUrl,
  starCount,
  isSpeaking = false,
  onClick,
  nameMaxLength = 14,
  className = '',
}: {
  name: string;
  avatarUrl: string;
  starCount: number;
  isSpeaking?: boolean;
  onClick?: () => void;
  nameMaxLength?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex min-w-0 items-center space-x-2 rounded-full border border-white/10 bg-black/50 py-0.5 pl-0.5 pr-3.5 shadow-lg backdrop-blur-2xl transition hover:bg-black/70 disabled:cursor-default ${className}`}
    >
      <div className="relative shrink-0">
        <div className="h-9 w-9 overflow-hidden rounded-full border-2 border-pink-500/40 shadow-[0_0_10px_rgba(236,72,153,0.3)]">
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        </div>
        {isSpeaking && (
          <div className="absolute inset-0 animate-pulse rounded-full border-2 border-cyan-400" />
        )}
      </div>
      <div className="flex min-w-0 flex-col text-left">
        <span className="max-w-[90px] truncate text-[11px] font-black tracking-tight text-white">
          {truncateName(name, nameMaxLength)}
        </span>
        <div className="flex items-center space-x-1 text-[9px] font-bold text-white/90">
          <Star size={9} className="fill-yellow-400 text-yellow-400" />
          <span>{starCount.toLocaleString()}</span>
        </div>
      </div>
    </button>
  );
}

/** Cyan Follow pill — same markup as Watch Together / live room chat header. */
export function RoomOwnerFollowButton({
  isFollowing,
  onToggle,
  className = '',
}: {
  isFollowing: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-[11px] font-black tracking-tighter transition active:scale-95 ${
        isFollowing
          ? 'border-white/20 bg-white/10 text-white'
          : 'border-white/20 bg-[#00f7ff] text-black shadow-[0_0_15px_rgba(0,247,255,0.3)] hover:bg-cyan-300'
      } ${className}`}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}

/** Host chip + Follow row used in live room, room details, and edit room. */
export function RoomOwnerSocialControls({
  name,
  avatarUrl,
  starCount,
  isFollowing,
  onToggleFollow,
  onProfileClick,
  isSpeaking = false,
  nameMaxLength,
  showFollowButton = true,
  className = '',
}: {
  name: string;
  avatarUrl: string;
  starCount: number;
  isFollowing: boolean;
  onToggleFollow: () => void;
  onProfileClick?: () => void;
  isSpeaking?: boolean;
  nameMaxLength?: number;
  showFollowButton?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center space-x-2 ${className}`}>
      <RoomOwnerProfileChip
        name={name}
        avatarUrl={avatarUrl}
        starCount={starCount}
        isSpeaking={isSpeaking}
        onClick={onProfileClick}
        nameMaxLength={nameMaxLength}
      />
      {showFollowButton ? (
        <RoomOwnerFollowButton isFollowing={isFollowing} onToggle={onToggleFollow} />
      ) : null}
    </div>
  );
}
