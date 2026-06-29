import React, { useMemo, useRef, useState } from 'react';
import { useDB, useDbRevision } from '../../lib/useDB';
import { StoryRing } from './StoryRing';
import { buildFeedStoryEntries } from '../../lib/storySegments';
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
};

export function StoryStrip({
  className = '',
  compact = false,
  showAddStory = true,
  onlyUserId = null,
  highlightUserId = null,
}: StoryStripProps) {
  const db = useDB();
  const dbRevision = useDbRevision();
  const currentUser = resolveUser(db.users, db.currentUser);
  const posts = db.posts ?? [];
  const users = db.users ?? [];

  const stories = useMemo(
    () =>
      buildFeedStoryEntries(
        posts,
        users,
        db.stories ?? {},
        (userId) => db.hasViewedStory(userId),
        currentUser.id
      ),
    [posts, users, db.stories, dbRevision, currentUser.id]
  );

  const ordered = useMemo(() => {
    const list = onlyUserId
      ? stories.filter((entry) => entry.user.id === onlyUserId)
      : stories;
    if (onlyUserId || !highlightUserId || highlightUserId === currentUser.id) {
      return list;
    }
    return [...list].sort((a, b) => {
      if (a.user.id === highlightUserId) return -1;
      if (b.user.id === highlightUserId) return 1;
      return 0;
    });
  }, [stories, onlyUserId, highlightUserId, currentUser.id]);
  const [activeStoryUserId, setActiveStoryUserId] = useState<string | null>(null);
  const stripScrollRef = useRef<HTMLDivElement | null>(null);

  const orderedUserIds = useMemo(() => ordered.map((entry) => entry.user.id), [ordered]);

  const getAdjacentUserId = (userId: string, direction: 'prev' | 'next') => {
    const idx = orderedUserIds.indexOf(userId);
    if (idx < 0) return null;
    if (direction === 'prev') return orderedUserIds[idx - 1] ?? null;
    return orderedUserIds[idx + 1] ?? null;
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

  if (onlyUserId && !showAddStory && ordered.length === 0) {
    return null;
  }

  return (
    <div className={`story-strip px-1 ${compact ? 'story-strip--compact' : ''} ${className}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => scrollStories('left')}
          className="hidden md:flex h-8 w-8 shrink-0 self-start mt-7 items-center justify-center rounded-full border border-border bg-card/90 backdrop-blur text-foreground hover:bg-secondary transition-colors"
          aria-label="Scroll stories left"
          title="Scroll left"
        >
          ←
        </button>
        <div
          ref={stripScrollRef}
          className={`story-strip-scroll no-scrollbar px-1 flex-1 ${
            compact ? 'gap-4' : 'gap-6'
          }`}
        >
          {showAddStory && (
            <StoryRing
              story={{ id: 'current', user: currentUser, hasViewed: false }}
              isCurrentUser
            />
          )}
          {ordered.map((story) => (
            <StoryRing
              key={story.id}
              story={story}
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
          className="hidden md:flex h-8 w-8 shrink-0 self-start mt-7 items-center justify-center rounded-full border border-border bg-card/90 backdrop-blur text-foreground hover:bg-secondary transition-colors"
          aria-label="Scroll stories right"
          title="Scroll right"
        >
          →
        </button>
      </div>
    </div>
  );
}
