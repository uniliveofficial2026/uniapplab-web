import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, X } from 'lucide-react';
import {
  getOptionsMenuItemClass,
  optionsMenuItemPointerHandlers,
  useOptionsMenuHover,
} from '../../lib/optionsMenu';
import { useDB, useUserById } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { Avatar } from '../common/Avatar';
import { ProfilePremiumBadgeForUser } from '../common/ProfilePremiumBadge';
import { resolveUser } from '../../lib/safe';

export function FollowListModal({
  profileUserId,
  mode,
  onClose,
}: {
  profileUserId: string;
  mode: 'followers' | 'following';
  onClose: () => void;
}) {
  const db = useDB();
  const { showToast } = useToast();
  const profileUser = useUserById(profileUserId);
  const meId = db.currentUser?.id;
  const [query, setQuery] = useState('');
  const [hoverFollowId, setHoverFollowId] = useState<string | null>(null);
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const { hoveredMenuItem, setHoveredMenuItem } = useOptionsMenuHover(!!menuUserId);

  const memberIds =
    mode === 'followers'
      ? db.getFollowerIds(profileUserId)
      : db.getFollowingIds(profileUserId);

  const members = useMemo(() => {
    return db
      .getUsersByIds(memberIds)
      .map((u) => resolveUser(db.users, u))
      .filter((u) => !db.isUserBlocked(u.id))
      .sort((a, b) =>
        (a.username || '').localeCompare(b.username || '', undefined, { sensitivity: 'base' })
      );
  }, [db, memberIds, db.users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (u) =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q)
    );
  }, [members, query]);

  const displayCount =
    mode === 'followers' ? profileUser.followers ?? 0 : profileUser.following ?? 0;
  const countLabel = displayCount.toLocaleString();
  const title = mode === 'followers' ? 'Followers' : 'Following';

  const handleFollowToggle = (userId: string, username: string) => {
    const next = db.toggleFollow(userId);
    if (next === null) return;
    showToast(next ? `Following ${username}` : `Unfollowed ${username}`);
    setHoverFollowId(null);
  };

  const openProfile = (userId: string) => {
    onClose();
    window.dispatchEvent(
      new CustomEvent('navigate', { detail: { tab: 'profile', userId } })
    );
  };

  const handleBlockUser = (userId: string, username: string) => {
    if (!db.blockUser(userId)) return;
    showToast(`Blocked @${username}`);
    setMenuUserId(null);
    setHoverFollowId(null);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex flex-col bg-background animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-list-title"
    >
      <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 pt-safe border-b border-border bg-background shrink-0">
          <h2 id="follow-list-title" className="font-bold text-base text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary text-foreground/70 hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="px-4 pt-2 pb-3 text-sm text-foreground/70 text-center shrink-0 bg-muted/40">
          <span className="font-bold text-foreground">{countLabel}</span>{' '}
          {mode === 'followers' ? 'followers' : 'following'}
        </p>

        <div className="px-4 pb-3 shrink-0">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full rounded-lg px-4 py-2 text-sm text-foreground outline-none placeholder:text-foreground/45 bg-secondary border border-border focus:border-ring transition-colors"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ul
            role="list"
            className="m-0 list-none flex-1 overflow-y-auto overflow-x-hidden no-scrollbar divide-y divide-border pb-safe"
          >
            {filtered.length === 0 ? (
              <li className="py-16 px-4 text-center text-foreground/65 text-sm font-medium list-none">
                {query.trim()
                  ? 'No accounts match your search.'
                  : mode === 'followers'
                    ? 'No followers yet.'
                    : 'Not following anyone yet.'}
              </li>
            ) : (
              filtered.map((user) => {
                const isSelf = user.id === meId;
                const isFollowing = !!user.isFollowing;
                const showHover = hoverFollowId === user.id;
                return (
                  <li
                    key={user.id}
                    role="listitem"
                    className="flex items-center gap-3 px-4 py-3 min-h-[4.5rem] hover:bg-secondary/80 transition-colors"
                  >
                    <Avatar
                      user={user}
                      size="sm"
                      containGlow
                      className="w-11 h-11 shrink-0"
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
                      <span className="w-full truncate text-sm font-bold leading-tight flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{user.username}</span>
                        <ProfilePremiumBadgeForUser user={user} size="sm" />
                      </span>
                      {user.displayName ? (
                        <span className="w-full truncate text-sm leading-tight text-foreground/65">
                          {user.displayName}
                        </span>
                      ) : null}
                    </button>
                    {!isSelf ? (
                      <div className="relative flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleFollowToggle(user.id, user.username)}
                          onMouseEnter={() => setHoverFollowId(user.id)}
                          onMouseLeave={() => setHoverFollowId(null)}
                          aria-pressed={isFollowing}
                          className={`min-w-[5.5rem] px-3 py-1.5 rounded-lg text-sm font-bold border text-center transition-colors ${
                            isFollowing
                              ? showHover
                                ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40'
                                : 'bg-secondary text-foreground border-border hover:bg-secondary/80'
                              : 'bg-primary text-primary-foreground border-transparent hover:bg-primary/90 shadow-sm'
                          }`}
                        >
                          {isFollowing ? (showHover ? 'Unfollow' : 'Following') : 'Follow'}
                        </button>
                        <button
                          type="button"
                          aria-label={`More actions for ${user.username}`}
                          aria-expanded={menuUserId === user.id}
                          onClick={() =>
                            setMenuUserId((prev) => (prev === user.id ? null : user.id))
                          }
                          className="p-2 rounded-full text-foreground/70 hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {menuUserId === user.id ? (
                          <>
                            <button
                              type="button"
                              aria-label="Close menu"
                              className="fixed inset-0 z-[241] cursor-default"
                              onClick={() => {
                                setMenuUserId(null);
                                setHoveredMenuItem(null);
                              }}
                            />
                            <div
                              role="menu"
                              className="absolute right-0 top-full z-[242] mt-1 min-w-[11rem] rounded-xl border border-border bg-background p-1.5 shadow-xl"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className={getOptionsMenuItemClass(
                                  'block-user',
                                  'danger',
                                  hoveredMenuItem,
                                  'surface'
                                )}
                                {...optionsMenuItemPointerHandlers(
                                  'block-user',
                                  setHoveredMenuItem
                                )}
                                onClick={() => handleBlockUser(user.id, user.username)}
                              >
                                Block @{user.username}
                              </button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : (
                      <span className="shrink-0 min-w-[6.5rem] text-center text-xs font-semibold text-foreground/50">
                        You
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
}
