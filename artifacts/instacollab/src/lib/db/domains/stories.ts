import {
  DEMO_LIVE_KIND_PATCHES,
  DEMO_STORY_SEGMENTS,
  DEMO_USER_STATUS_PATCHES,
  USERS,
} from '../../data';
import { recordCollectionSave } from '../../devActivity';
import type { StoryDraftMedia } from '../../../components/stories/storyDraft';
import type { StoriesByUserStore, User } from '../../../types';
import {
  isFeedActiveStorySegment,
  segmentCreatedAtMs,
} from '../../storySegments';
import { normalizeEditorColorFields } from '../../themeText';
import type { StoriesLayer, StoryViewEntry } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

function normalizeStorySegments(list: unknown[]): StoryDraftMedia[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((seg) => normalizeEditorColorFields(seg as StoryDraftMedia))
    .sort((a, b) => segmentCreatedAtMs(a) - segmentCreatedAtMs(b));
}

export function WithStories<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, StoriesLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    get stories(): StoriesByUserStore {
      return this.load<StoriesByUserStore>('stories', {}) || {};
    }

    get profileStories(): StoriesByUserStore {
      this.ensureProfileStoriesMigrated();
      return this.load<StoriesByUserStore>('profile_stories', {}) || {};
    }

    private ensureProfileStoriesMigrated() {
      if (this.load('profile_stories_migrated', false)) return;

      const feed = this.load<StoriesByUserStore>('stories', {}) || {};
      const profile = this.load<StoriesByUserStore>('profile_stories', {}) || {};
      const next: StoriesByUserStore = { ...profile };
      let changed = false;

      for (const [userId, segments] of Object.entries(feed)) {
        if (!Array.isArray(segments) || segments.length === 0) continue;
        const existing = next[userId] || [];
        next[userId] = [...segments, ...existing];
        changed = true;
      }

      if (changed) {
        this.save('profile_stories', next);
      }
      this.save('profile_stories_migrated', true);
    }

    private pruneExpiredFeedStories() {
      const all = this.load<StoriesByUserStore>('stories', {}) || {};
      const now = Date.now();
      let changed = false;
      const next: StoriesByUserStore = {};

      for (const [userId, list] of Object.entries(all)) {
        if (!Array.isArray(list)) continue;
        const filtered = list.filter((segment) =>
          isFeedActiveStorySegment(segment as StoryDraftMedia, now),
        );
        if (filtered.length > 0) next[userId] = filtered;
        if (filtered.length !== list.length) changed = true;
      }

      if (changed) this.save('stories', next);
    }

    getFeedStorySegments(userId: string): StoryDraftMedia[] {
      this.pruneExpiredFeedStories();
      const list = this.stories[userId];
      if (!Array.isArray(list)) return [];
      return normalizeStorySegments(
        list.filter((segment) => isFeedActiveStorySegment(segment)),
      );
    }

    getProfileStorySegments(userId: string): StoryDraftMedia[] {
      this.ensureProfileStoriesMigrated();
      const list = this.profileStories[userId];
      return normalizeStorySegments(list ?? []);
    }

    getFeedStoriesStore(): StoriesByUserStore {
      this.pruneExpiredFeedStories();
      const all = this.stories;
      const next: StoriesByUserStore = {};

      for (const [userId, list] of Object.entries(all)) {
        if (!Array.isArray(list)) continue;
        const active = list.filter((segment) =>
          isFeedActiveStorySegment(segment as StoryDraftMedia),
        );
        if (active.length > 0) next[userId] = active;
      }

      return next;
    }

    /**
     * Demo LIVE + story rings on the home feed (and profile when that user has segments).
     * In DEV, re-applies on each load; use applyDemoStoryStrip() from the dev panel anytime.
     */
    async applyDemoStoryStrip(options?: { resetViews?: boolean }) {
      await this.whenReady();

      const nextStories: StoriesByUserStore = { ...this.stories };
      const nextProfile: StoriesByUserStore = { ...this.profileStories };
      Object.entries(DEMO_STORY_SEGMENTS).forEach(([userId, segments]) => {
        const stamped = segments.map((s, idx) => ({
          ...s,
          createdAt:
            (s as StoryDraftMedia).createdAt ??
            Date.now() - (segments.length - idx) * 3_600_000,
        }));
        nextStories[userId] = stamped;
        if (options?.resetViews) {
          nextProfile[userId] = stamped;
        } else {
          const existing = nextProfile[userId] || [];
          nextProfile[userId] = existing.length > 0 ? existing : stamped;
        }
      });
      this.cache['stories'] = nextStories;
      this.cache['profile_stories'] = nextProfile;

      const statusPatches = DEMO_USER_STATUS_PATCHES;
      const liveKindPatches = DEMO_LIVE_KIND_PATCHES;
      const userById = new Map<string, User>(
        this.asLocalDB().users.map((u) => [u.id, u] as const)
      );
      USERS.forEach((template) => {
        if (template?.id && !userById.has(template.id)) {
          userById.set(template.id, { ...template });
        }
      });
      const updatedUsers = Array.from(userById.values()).map((u) => {
        const nextStatus = statusPatches[u?.id];
        if (nextStatus === undefined) return u;
        const liveKind =
          nextStatus === 'live' ? liveKindPatches[u?.id] ?? 'solo' : undefined;
        if (u.status === nextStatus && u.liveKind === liveKind) return u;
        if (nextStatus === 'live' && u.status !== 'live' && u?.id) {
          this.asLocalDB().notifyLiveStarted(u.id, liveKind);
        }
        return { ...u, status: nextStatus, liveKind };
      });
      this.cache['users'] = updatedUsers;

      const views = { ...this.storyViews };
      let viewsChanged = false;
      if (options?.resetViews !== false) {
        Object.keys(DEMO_STORY_SEGMENTS).forEach((userId) => {
          if (views[userId]) {
            delete views[userId];
            viewsChanged = true;
          }
        });
        if (viewsChanged) this.cache['story_views'] = views;
      }

      this.cache['demo_stories_seeded'] = true;
      this.cache['profile_stories_migrated'] = true;

      await this.saveToIDB('stories', nextStories);
      await this.saveToIDB('profile_stories', nextProfile);
      await this.saveToIDB('users', updatedUsers);
      if (viewsChanged) await this.saveToIDB('story_views', views);
      await this.saveToIDB('demo_stories_seeded', true);
      await this.saveToIDB('profile_stories_migrated', true);

      try {
        localStorage.setItem('users', JSON.stringify(updatedUsers));
      } catch {
        /* ignore */
      }

      if (import.meta.env.DEV) {
        recordCollectionSave('stories', nextStories);
        recordCollectionSave('profile_stories', nextProfile);
        recordCollectionSave('users', updatedUsers);
      }

      this.notifyListeners();

      return {
        storyUsers: Object.keys(DEMO_STORY_SEGMENTS).length,
        storyOnlyUsers: Object.keys(DEMO_STORY_SEGMENTS).filter(
          (id) => statusPatches[id] === 'story'
        ),
        liveUsers: Object.entries(statusPatches)

          .filter(([, s]) => s === 'live')
          .map(([id]) => id),
        liveKinds: Object.entries(liveKindPatches).map(
          ([id, kind]) => `${id}:${kind}`
        ),
      };
    }

    private async seedDemoStoriesIfNeeded() {
      if (import.meta.env.DEV) {
        const demoSeeded = this.load('dev_stories_seeded_once', false);
        const hasFeedStories = Object.values(this.stories).some(
          (list) => Array.isArray(list) && list.length > 0,
        );
        if (!demoSeeded && !hasFeedStories) {
          await this.applyDemoStoryStrip({ resetViews: false });
          this.save('dev_stories_seeded_once', true);
        }
        return;
      }

      if (this.load('demo_stories_seeded', false)) return;

      const existing = this.stories;
      const hasAny = Object.values(existing).some(
        (list) => Array.isArray(list) && list.length > 0
      );
      if (hasAny) {
        this.save('demo_stories_seeded', true);
        return;
      }

      await this.applyDemoStoryStrip({ resetViews: false });
    }

    addStorySegment(userId: string, segment: StoryDraftMedia) {
      const stamped: StoryDraftMedia = {
        ...segment,
        createdAt: segment.createdAt ?? Date.now(),
      };

      const allFeed = this.stories;
      const feedSegs = allFeed[userId] || [];
      this.save('stories', {
        ...allFeed,
        [userId]: this.cappedList([stamped, ...feedSegs], 'stories'),
      });

      this.ensureProfileStoriesMigrated();
      const allProfile = this.profileStories;
      const profileSegs = allProfile[userId] || [];
      this.save('profile_stories', {
        ...allProfile,
        [userId]: this.cappedList([stamped, ...profileSegs], 'profile_stories'),
      });
    }

    get storyViews() {
      return this.load('story_views', {}) as Record<string, boolean | StoryViewEntry>;
    }

    private normalizeStoryViews(): Record<string, StoryViewEntry> {
      const raw = this.storyViews;
      const next: Record<string, StoryViewEntry> = {};
      for (const [userId, value] of Object.entries(raw)) {
        if (typeof value === 'boolean') {
          next[userId] = value ? { feed: true } : {};
        } else if (value && typeof value === 'object') {
          next[userId] = {
            feed: value.feed,
            profile: value.profile,
            profileDays: value.profileDays ? { ...value.profileDays } : undefined,
          };
        }
      }
      return next;
    }

    hasViewedStory(userId: string, scope: 'feed' | 'profile' = 'feed') {
      return !!this.normalizeStoryViews()[userId]?.[scope];
    }

    hasViewedProfileDay(userId: string, dayKey: string) {
      const entry = this.normalizeStoryViews()[userId];
      if (!entry) return false;
      return !!entry.profileDays?.[dayKey];
    }

    markStoryViewed(userId: string, scope: 'feed' | 'profile' = 'feed') {
      const views = this.normalizeStoryViews();
      this.save('story_views', {
        ...views,
        [userId]: { ...views[userId], [scope]: true },
      });
    }

    markProfileDayViewed(userId: string, dayKey: string) {
      const views = this.normalizeStoryViews();
      const entry = views[userId] ?? {};
      this.save('story_views', {
        ...views,
        [userId]: {
          ...entry,
          profileDays: { ...entry.profileDays, [dayKey]: true },
        },
      });
    }

  } as unknown as MixinCtor<T, StoriesLayer>;
}
