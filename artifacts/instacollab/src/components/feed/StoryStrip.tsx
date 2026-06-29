import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDB, useDbRevision } from '../../lib/useDB';
import { StoryRing } from './StoryRing';
import {
  buildFeedStoryEntries,
  buildProfileStoryDayEntries,
} from '../../lib/storySegments';
import { resolveUser } from '../../lib/safe';

type StoryStripProps = {
  className?: string;
  /** Tighter layout for profile preview modal */
  compact?: boolean;
  /** Show "Add story" for the signed-in user (own profile / feed only) */
  showAddStory?: boolean;
  /** Profile/preview: only this user's live ring or story (not the full feed list) */
  onlyUserId?: string | null;
  /** Move this user's story to the front (after Add story when shown) */
  highlightUserId?: string | null;
  /** Feed = 24h story rings; profile = permanent archive grouped by day */
  mode?: 'feed' | 'profile';
};

export function StoryStrip({
  className = '',
  compact = false,
  showAddStory = true,
  onlyUserId = null,
  highlightUserId = null,
  mode = 'feed',
}: StoryStripProps) {
  const db = useDB();
  const dbRevision = useDbRevision();
  const currentUser = resolveUser(db.users, db.currentUser);
  const posts = db.posts ?? [];
  const users = db.users ?? [];

  const feedStories = useMemo(
    () =>
      buildFeedStoryEntries(
        posts,
        users,
        db.getFeedStoriesStore(),
        (userId) => db.hasViewedStory(userId, 'feed'),
        currentUser.id
      ),
    [posts, users, db, dbRevision, currentUser.id]
  );

  const profileDayEntries = useMemo(() => {
    if (mode !== 'profile' || !onlyUserId) return [];
    const user = resolveUser(users, { id: onlyUserId }, currentUser);
    const segments = db.getProfileStorySegments(onlyUserId);
    return buildProfileStoryDayEntries(user, segments, (userId, dayKey) =>
      db.hasViewedProfileDay(userId, dayKey)
    );
  }, [mode, onlyUserId, users, currentUser, db, dbRevision]);

  const ordered = useMemo(() => {
    const list = onlyUserId
      ? feedStories.filter((entry) => entry.user.id === onlyUserId)
      : feedStories;
    if (onlyUserId || !highlightUserId || highlightUserId === currentUser.id) {
      return list;
    }
    return [...list].sort((a, b) => {
      if (a.user.id === highlightUserId) return -1;
      if (b.user.id === highlightUserId) return 1;
      return 0;
    });
  }, [feedStories, onlyUserId, highlightUserId, currentUser.id]);

  const [activeStoryUserId, setActiveStoryUserId] = useState<string | null>(null);
  const [activeProfileDayId, setActiveProfileDayId] = useState<string | null>(null);
  const stripScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (mode !== 'profile' || !onlyUserId) return;
    const onOpenLatestDay = (event: Event) => {
      const userId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      if (userId && userId !== onlyUserId) return;
      const firstDay = profileDayEntries[0];
      if (firstDay) setActiveProfileDayId(firstDay.id);
    };
    window.addEventListener('profile-open-latest-story-day', onOpenLatestDay);
    return () => window.removeEventListener('profile-open-latest-story-day', onOpenLatestDay);
  }, [mode, onlyUserId, profileDayEntries]);

  const orderedUserIds = useMemo(() => ordered.map((entry) => entry.user.id), [ordered]);
  const profileDayIds = useMemo(
    () => profileDayEntries.map((entry) => entry.id),
    [profileDayEntries]
  );

  const getAdjacentUserId = (userId: string, direction: 'prev' | 'next') => {
    const idx = orderedUserIds.indexOf(userId);
    if (idx < 0) return null;
    if (direction === 'prev') return orderedUserIds[idx - 1] ?? null;
    return orderedUserIds[idx + 1] ?? null;
  };

  const getAdjacentProfileDayId = (dayId: string, direction: 'prev' | 'next') => {
    const idx = profileDayIds.indexOf(dayId);
    if (idx < 0) return null;
    if (direction === 'prev') return profileDayIds[idx - 1] ?? null;
    return profileDayIds[idx + 1] ?? null;
  };

  const scrollStories = (direction: 'left' | 'right') => {
    const el = stripScrollRef.current;
    if (!el) return;
    const amount = Math.max(220, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  if (mode === 'profile') {
    if (!showAddStory && profileDayEntries.length === 0) return null;
  } else if (onlyUserId && !showAddStory && ordered.length === 0) {
    return null;
  }

  return (
    <div className={`story-strip px-1 ${compact ? 'story-strip--compact' : ''} ${className}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => scrollStories('left')}
          className="hidden md:flex h-8 w-8 shrink-0 self-center items-center justify-center rounded-full border border-border bg-card/90 backdrop-blur text-foreground hover:bg-secondary transition-colors"
          aria-label="Scroll stories left"
          title="Scroll left"
        >
          ←
        </button>
        <div
          ref={stripScrollRef}
          className={`story-strip-scroll no-scrollbar px-1 flex-1 ${
            mode === 'profile'
              ? 'story-strip-scroll--profile-cards gap-2'
              : compact
                ? 'gap-4'
                : 'gap-6'
          }`}
        >
          {showAddStory && (
            <StoryRing
              key={mode === 'profile' ? 'profile-add-story' : 'feed-add-story'}
              story={{ id: 'current', user: currentUser, hasViewed: false }}
              isCurrentUser
              storyScope={mode === 'profile' ? 'profile' : 'feed'}
              presentation={mode === 'profile' ? 'card' : 'ring'}
            />
          )}
          {mode === 'profile'
            ? profileDayEntries.map((entry) => (
                <StoryRing
                  key={entry.id}
                  story={{
                    id: entry.id,
                    user: entry.user,
                    hasViewed: entry.hasViewed,
                  }}
                  storyScope="profile"
                  presentation="card"
                  segmentsOverride={entry.segments}
                  ringSegmentCount={entry.segments.length}
                  ringViewed={entry.hasViewed}
                  ringLabel={entry.label}
                  profileDayKey={entry.dayKey}
                  isOwnProfileArchive={onlyUserId === currentUser.id}
                  isOpen={activeProfileDayId === entry.id}
                  onClose={() => setActiveProfileDayId(null)}
                  prevUserId={getAdjacentProfileDayId(entry.id, 'prev')}
                  nextUserId={getAdjacentProfileDayId(entry.id, 'next')}
                  onRequestOpenUser={(dayId) => setActiveProfileDayId(dayId)}
                />
              ))
            : ordered.map((story) => (
                <StoryRing
                  key={story.id}
                  story={story}
                  storyScope="feed"
                  presentation="ring"
                  isOpen={activeStoryUserId === story.user.id}
                  onClose={() => setActiveStoryUserId(null)}
                  prevUserId={getAdjacentUserId(story.user.id, 'prev')}
                  nextUserId={getAdjacentUserId(story.user.id, 'next')}
                  onRequestOpenUser={(userId) => setActiveStoryUserId(userId)}
                />
              ))}
        </div>
        <button
          type="button"
          onClick={() => scrollStories('right')}
          className="hidden md:flex h-8 w-8 shrink-0 self-center items-center justify-center rounded-full border border-border bg-card/90 backdrop-blur text-foreground hover:bg-secondary transition-colors"
          aria-label="Scroll stories right"
          title="Scroll right"
        >
          →
        </button>
      </div>
    </div>
  );
}
