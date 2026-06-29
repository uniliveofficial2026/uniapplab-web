import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Eye,
  Grid3X3,
  PlaySquare,
  Radio,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { Avatar } from '../common/Avatar';
import {
  formatAudienceInsight,
  formatVisitActionLine,
  formatVisitSurfaceLabel,
  PROFILE_VISIT_SURFACE_LABELS,
  PROFILE_VISIT_SURFACES,
} from '../../lib/profileVisits';
import type { ProfileVisitSurface } from '../../types';
import { handleMediaError } from '../../lib/utils';
import { LIVE_KIND_LABELS } from '../../lib/liveRing';

export function formatVisitTime(ts: number, now = Date.now()): string {
  if (!Number.isFinite(ts) || ts <= 0) return 'Recently';
  const deltaSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (deltaSec < 60) return 'Just now';
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
  if (deltaSec < 604800) return `${Math.floor(deltaSec / 86400)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const SURFACE_ICONS: Record<
  ProfileVisitSurface,
  React.ComponentType<{ className?: string }>
> = {
  profile: UserRound,
  posts: Grid3X3,
  reels: PlaySquare,
  story: Sparkles,
  live: Radio,
};

type SurfaceFilter = 'all' | ProfileVisitSurface;
type AudienceFilter = 'all' | 'following_you' | 'you_follow' | 'mutual' | 'verified';

function FilterPill({
  label,
  count,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-secondary/80 text-foreground/75 hover:bg-secondary hover:text-foreground'
      }`}
    >
      {Icon ? <Icon className="w-3 h-3 shrink-0" /> : null}
      {label}
      {count != null && count > 0 ? (
        <span className={active ? 'text-primary/80' : 'text-foreground/45'}>{count}</span>
      ) : null}
    </button>
  );
}

function SurfaceStatChip({
  surface,
  count,
}: {
  surface: ProfileVisitSurface;
  count: number;
}) {
  if (count <= 0) return null;
  const Icon = SURFACE_ICONS[surface];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/80 px-2.5 py-1 text-xs font-semibold text-foreground/75">
      <Icon className="w-3 h-3 shrink-0" />
      {PROFILE_VISIT_SURFACE_LABELS[surface]} · {count}
    </span>
  );
}

function matchesAudienceFilter(
  row: { user: { id: string; isFollowing?: boolean; isVerified?: boolean } },
  filter: AudienceFilter,
  ownerFollowingIds: Set<string>
): boolean {
  if (filter === 'all') return true;
  const theyFollowYou = !!row.user.isFollowing;
  const youFollow = ownerFollowingIds.has(row.user.id);
  switch (filter) {
    case 'following_you':
      return theyFollowYou;
    case 'you_follow':
      return youFollow;
    case 'mutual':
      return theyFollowYou && youFollow;
    case 'verified':
      return !!row.user.isVerified;
    default:
      return true;
  }
}

export function ProfileVisitorsModal({
  profileUserId,
  onClose,
}: {
  profileUserId: string;
  onClose: () => void;
}) {
  const db = useDB();
  const { showToast } = useToast();
  const meId = db.currentUser?.id;
  const [query, setQuery] = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState<SurfaceFilter>('all');
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('all');
  const [hoverFollowId, setHoverFollowId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const ownerFollowingIds = useMemo(
    () => new Set(db.getFollowingIds(profileUserId)),
    [db, profileUserId, db.users]
  );

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const trackingEnabled = db.profileVisitorTrackingEnabled(profileUserId);
  const stats = useMemo(
    () => db.getProfileVisitorStats(profileUserId),
    [db, profileUserId, db.users]
  );
  const audience = useMemo(
    () => db.getProfileVisitorAudienceSummary(profileUserId),
    [db, profileUserId, db.users]
  );

  const visitors = useMemo(
    () => (trackingEnabled ? db.getProfileVisitors(profileUserId) : []),
    [db, profileUserId, db.users, trackingEnabled]
  );

  const audienceCounts = useMemo(() => {
    let followingYou = 0;
    let youFollow = 0;
    let mutual = 0;
    let verified = 0;
    for (const row of visitors) {
      const theyFollowYou = !!row.user.isFollowing;
      const youFollowThem = ownerFollowingIds.has(row.user.id);
      if (theyFollowYou) followingYou += 1;
      if (youFollowThem) youFollow += 1;
      if (theyFollowYou && youFollowThem) mutual += 1;
      if (row.user.isVerified) verified += 1;
    }
    return { followingYou, youFollow, mutual, verified };
  }, [visitors, ownerFollowingIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visitors.filter((row) => {
      const surface = row.lastSurface ?? 'profile';
      if (surfaceFilter !== 'all' && surface !== surfaceFilter) return false;
      if (!matchesAudienceFilter(row, audienceFilter, ownerFollowingIds)) return false;
      if (!q) return true;
      return (
        (row.user.username || '').toLowerCase().includes(q) ||
        (row.user.displayName || '').toLowerCase().includes(q) ||
        formatVisitActionLine(row).toLowerCase().includes(q) ||
        formatVisitSurfaceLabel(row).toLowerCase().includes(q)
      );
    });
  }, [visitors, query, surfaceFilter, audienceFilter, ownerFollowingIds]);

  const hasActiveFilters = surfaceFilter !== 'all' || audienceFilter !== 'all';
  const clearFilters = () => {
    setSurfaceFilter('all');
    setAudienceFilter('all');
  };

  const audienceLine = formatAudienceInsight(
    {
      followingYou: audience.followingYou,
      youFollowThem: audience.youFollowThem,
      mutual: audience.mutual,
      verified: audience.verified,
      notFollowingYou: audience.notFollowingYou,
    },
    audience.total
  );

  const openProfile = (userId: string) => {
    onClose();
    window.dispatchEvent(
      new CustomEvent('navigate', { detail: { tab: 'profile', userId } })
    );
  };

  const handleFollowToggle = (userId: string, username: string) => {
    const next = db.toggleFollow(userId);
    if (next === null) return;
    showToast(next ? `Following ${username}` : `Unfollowed ${username}`);
    setHoverFollowId(null);
  };

  const handleRemoveVisitor = (visitorUserId: string) => {
    if (!db.removeProfileVisitor(profileUserId, visitorUserId)) return;
    showToast('Removed from visitors');
  };

  const visitorCount = stats.visibleCount;
  const summaryLabel =
    hasActiveFilters && filtered.length !== visitorCount
      ? `Showing ${filtered.length.toLocaleString()} of ${visitorCount.toLocaleString()} visitors`
      : `${visitorCount.toLocaleString()} ${visitorCount === 1 ? 'visitor' : 'visitors'}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[245] flex flex-col bg-background animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-visitors-title"
    >
      <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 pt-safe border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-5 h-5 text-foreground shrink-0" />
            <h2 id="profile-visitors-title" className="font-bold text-base text-foreground truncate">
              Profile visitors
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

        <div className="px-4 pt-2 pb-2 shrink-0 bg-muted/40 border-b border-border/60 space-y-2">
          <p className="text-sm text-foreground/70 text-center">{summaryLabel}</p>
          {visitorCount > 0 && audienceLine ? (
            <p className="text-xs text-center text-foreground/55 font-medium leading-relaxed">
              {audienceLine}
            </p>
          ) : null}
          {visitorCount > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
              {PROFILE_VISIT_SURFACES.map((surface) => (
                <SurfaceStatChip
                  key={surface}
                  surface={surface}
                  count={stats.surfaceCounts[surface] ?? 0}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="px-4 pb-3 pt-3 shrink-0 space-y-2.5 border-b border-border/60">
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search visitors"
              className="min-w-0 flex-1 rounded-lg px-4 py-2 text-sm text-foreground outline-none placeholder:text-foreground/45 bg-secondary border border-border focus:border-ring transition-colors"
            />
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors"
              >
                Reset
              </button>
            ) : null}
          </div>

          {visitorCount > 0 ? (
            <>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <FilterPill
                  label="All"
                  count={visitors.length}
                  active={surfaceFilter === 'all'}
                  onClick={() => setSurfaceFilter('all')}
                />
                {PROFILE_VISIT_SURFACES.map((surface) => {
                  const count = stats.surfaceCounts[surface] ?? 0;
                  if (count <= 0) return null;
                  const Icon = SURFACE_ICONS[surface];
                  return (
                    <FilterPill
                      key={surface}
                      label={PROFILE_VISIT_SURFACE_LABELS[surface]}
                      count={count}
                      active={surfaceFilter === surface}
                      onClick={() =>
                        setSurfaceFilter((prev) => (prev === surface ? 'all' : surface))
                      }
                      icon={Icon}
                    />
                  );
                })}
              </div>
              {(audienceCounts.followingYou > 0 ||
                audienceCounts.youFollow > 0 ||
                audienceCounts.mutual > 0 ||
                audienceCounts.verified > 0) && (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  <FilterPill
                    label="Everyone"
                    active={audienceFilter === 'all'}
                    onClick={() => setAudienceFilter('all')}
                  />
                  {audienceCounts.followingYou > 0 ? (
                    <FilterPill
                      label="Follows you"
                      count={audienceCounts.followingYou}
                      active={audienceFilter === 'following_you'}
                      onClick={() =>
                        setAudienceFilter((prev) =>
                          prev === 'following_you' ? 'all' : 'following_you'
                        )
                      }
                    />
                  ) : null}
                  {audienceCounts.youFollow > 0 ? (
                    <FilterPill
                      label="You follow"
                      count={audienceCounts.youFollow}
                      active={audienceFilter === 'you_follow'}
                      onClick={() =>
                        setAudienceFilter((prev) =>
                          prev === 'you_follow' ? 'all' : 'you_follow'
                        )
                      }
                    />
                  ) : null}
                  {audienceCounts.mutual > 0 ? (
                    <FilterPill
                      label="Mutual"
                      count={audienceCounts.mutual}
                      active={audienceFilter === 'mutual'}
                      onClick={() =>
                        setAudienceFilter((prev) => (prev === 'mutual' ? 'all' : 'mutual'))
                      }
                    />
                  ) : null}
                  {audienceCounts.verified > 0 ? (
                    <FilterPill
                      label="Verified"
                      count={audienceCounts.verified}
                      active={audienceFilter === 'verified'}
                      onClick={() =>
                        setAudienceFilter((prev) =>
                          prev === 'verified' ? 'all' : 'verified'
                        )
                      }
                    />
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ul
            role="list"
            className="m-0 list-none flex-1 overflow-y-auto overflow-x-hidden no-scrollbar divide-y divide-border pb-safe"
          >
            {filtered.length === 0 ? (
              <li className="py-16 px-6 text-center text-foreground/65 text-sm font-medium">
                {query.trim() || hasActiveFilters ? (
                  <>
                    <p className="font-semibold text-foreground/80 mb-1">No matching visitors</p>
                    <p className="text-xs leading-relaxed max-w-sm mx-auto">
                      {query.trim() && hasActiveFilters
                        ? 'Try a different search or reset filters.'
                        : query.trim()
                          ? 'Try another name or username.'
                          : 'No visitors match the selected filters.'}
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-3 text-xs font-bold text-primary hover:underline"
                      >
                        Reset filters
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-foreground/80 mb-1">No profile visitors yet</p>
                    <p className="text-xs leading-relaxed max-w-sm mx-auto">
                      When someone opens your profile, posts, reels, story, or live, they appear
                      here with a preview of what they viewed. Visitors using leave no trace are
                      not recorded.
                    </p>
                  </>
                )}
              </li>
            ) : (
              filtered.map((row) => {
                const { user } = row;
                const isSelf = user.id === meId;
                const isFollowing = !!user.isFollowing;
                const showHover = hoverFollowId === user.id;
                const actionLine = formatVisitActionLine(row);
                const surfaceLabel = formatVisitSurfaceLabel(row);
                const timeLabel = formatVisitTime(row.lastVisitedAt, now);
                const visitMeta =
                  row.visitCount > 1
                    ? `${timeLabel} · ${row.visitCount} visits`
                    : timeLabel;
                const previewUrl = row.lastPreviewUrl;
                const SurfaceIcon = SURFACE_ICONS[row.lastSurface ?? 'profile'];

                return (
                  <li
                    key={user.id}
                    role="listitem"
                    className="flex items-center gap-3 px-4 py-3 min-h-[4.75rem] transition-colors hover:bg-secondary/80"
                  >
                    <div className="relative shrink-0">
                      {previewUrl && (row.lastSurface === 'posts' || row.lastSurface === 'reels') ? (
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-secondary ring-1 ring-border">
                          {row.lastSurface === 'reels' ? (
                            <video
                              src={previewUrl}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                              onError={handleMediaError}
                            />
                          ) : (
                            <img
                              src={previewUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={handleMediaError}
                            />
                          )}
                        </div>
                      ) : (
                        <Avatar
                          user={user}
                          size="sm"
                          containGlow
                          className="w-11 h-11"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProfile(user.id);
                          }}
                        />
                      )}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm"
                        title={surfaceLabel}
                      >
                        <SurfaceIcon className="w-2.5 h-2.5" />
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openProfile(user.id)}
                      className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5 py-0.5 text-left text-foreground"
                    >
                      <span className="w-full truncate text-sm font-bold leading-tight flex items-center gap-1.5">
                        <span className="truncate">{user.username}</span>
                        {user.isVerified ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        ) : null}
                      </span>
                      {user.displayName ? (
                        <span className="w-full truncate text-sm leading-tight text-foreground/65">
                          {user.displayName}
                        </span>
                      ) : null}
                      <span className="w-full truncate text-xs font-semibold text-foreground/70">
                        {actionLine}
                        {row.lastSurface === 'live' && row.lastLiveKind
                          ? ` · ${LIVE_KIND_LABELS[row.lastLiveKind]}`
                          : ''}
                      </span>
                      <span className="w-full truncate text-xs text-foreground/45 font-medium">
                        {visitMeta}
                      </span>
                    </button>
                    {!isSelf ? (
                      <div className="flex shrink-0 items-center gap-1">
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
                          onClick={() => handleRemoveVisitor(user.id)}
                          className="p-2 rounded-full text-foreground/50 hover:text-foreground hover:bg-secondary transition-colors"
                          aria-label={`Remove ${user.username} from visitors`}
                          title="Remove from list"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-foreground/50">You</span>
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
