import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserX, X } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { Avatar } from '../common/Avatar';
import { ProfileNameLines } from '../common/ProfileNameLines';
import { getProfileMentionLabel } from '../../lib/profileDisplay';

export function BlockedUsersModal({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');

  const blockedUsers = useMemo(() => {
    return db
      .getBlockedUsers()
      .sort((a, b) =>
        (a.username || '').localeCompare(b.username || '', undefined, { sensitivity: 'base' })
      );
  }, [db, db.users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return blockedUsers;
    return blockedUsers.filter(
      (u) =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q)
    );
  }, [blockedUsers, query]);

  const openProfile = (userId: string) => {
    onClose();
    window.dispatchEvent(
      new CustomEvent('navigate', { detail: { tab: 'profile', userId } })
    );
  };

  const handleUnblock = (userId: string, username: string) => {
    if (!db.unblockUser(userId)) return;
    showToast(`Unblocked @${username}`);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[260] flex flex-col bg-background animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocked-users-title"
    >
      <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 pt-safe border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <UserX className="w-5 h-5 text-foreground shrink-0" />
            <h2
              id="blocked-users-title"
              className="font-bold text-base text-foreground truncate"
            >
              Blocked accounts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary text-foreground/70 hover:text-foreground transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="px-4 pt-2 pb-3 text-sm text-foreground/70 text-center shrink-0 bg-muted/40">
          <span className="font-bold text-foreground">{blockedUsers.length}</span>{' '}
          {blockedUsers.length === 1 ? 'account blocked' : 'accounts blocked'}
        </p>

        <div className="px-4 pb-3 shrink-0">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blocked accounts"
            className="w-full rounded-lg px-4 py-2 text-sm text-foreground outline-none placeholder:text-foreground/45 bg-secondary border border-border focus:border-ring transition-colors"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ul
            role="list"
            className="m-0 list-none flex-1 overflow-y-auto overflow-x-hidden no-scrollbar divide-y divide-border pb-safe"
          >
            {filtered.length === 0 ? (
              <li className="py-16 px-6 text-center text-foreground/65 text-sm font-medium">
                {query.trim() ? (
                  'No blocked accounts match your search.'
                ) : (
                  <>
                    <p className="font-semibold text-foreground/80 mb-1">No blocked accounts</p>
                    <p className="text-xs leading-relaxed">
                      When you block someone from followers, following, or messages, they appear
                      here. You can unblock them anytime.
                    </p>
                  </>
                )}
              </li>
            ) : (
              filtered.map((user) => (
                <li
                  key={user.id}
                  role="listitem"
                  className="flex items-center gap-3 px-4 py-3 min-h-[4.5rem] hover:bg-secondary/80 transition-colors"
                >
                  <Avatar
                    user={user}
                    size="sm"
                    containGlow
                    className="w-11 h-11 shrink-0 opacity-80"
                    onClick={(e) => {
                      e.stopPropagation();
                      openProfile(user.id);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => openProfile(user.id)}
                    className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5 py-0.5 text-left text-foreground"
                  >
                    <ProfileNameLines
                      user={user}
                      primaryClassName="w-full truncate text-sm font-bold leading-tight"
                      secondaryClassName="w-full truncate text-sm leading-tight text-foreground/65"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnblock(user.id, getProfileMentionLabel(user))}
                    className="shrink-0 min-w-[6.5rem] px-3 py-1.5 rounded-lg text-sm font-bold border text-center bg-secondary text-foreground border-border hover:bg-primary hover:text-primary-foreground hover:border-transparent transition-colors"
                  >
                    Unblock
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
}
