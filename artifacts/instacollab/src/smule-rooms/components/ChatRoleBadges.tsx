import React from 'react';
import { Crown, Shield, Star } from 'lucide-react';
import type { ChatRoleFlags } from '../utils/roomRoleUsers';

const BADGE_BASE =
  'party-chat-role inline-flex items-center gap-0.5 shrink-0 rounded px-1.5 py-0.5 text-[8px] sm:text-[9px] leading-none font-black uppercase tracking-wide';

export { BADGE_BASE };

export function ChatRoleBadges({ isOwner, isCoOwner, isAdmin }: ChatRoleFlags) {
  if (!isOwner && !isCoOwner && !isAdmin) return null;

  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      {isOwner ? (
        <span
          className={`${BADGE_BASE} bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-[0_0_8px_rgba(168,85,247,0.35)]`}
        >
          <Crown size={8} className="shrink-0" strokeWidth={2.5} aria-hidden />
          <span>Owner</span>
        </span>
      ) : null}
      {isCoOwner && !isOwner ? (
        <span
          className={`${BADGE_BASE} border border-cyan-500/35 bg-cyan-500/15 text-cyan-200 shadow-sm`}
        >
          <Star size={8} className="shrink-0 fill-cyan-300/80 text-cyan-300" aria-hidden />
          <span>Co-owner</span>
        </span>
      ) : null}
      {isAdmin && !isOwner && !isCoOwner ? (
        <span
          className={`${BADGE_BASE} border border-yellow-500/35 bg-yellow-500/15 text-yellow-200 shadow-sm`}
        >
          <Shield size={8} className="shrink-0" strokeWidth={2.5} aria-hidden />
          <span>Admin</span>
        </span>
      ) : null}
    </div>
  );
}
