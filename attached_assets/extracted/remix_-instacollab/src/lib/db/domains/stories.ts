import {
  DEMO_LIVE_KIND_PATCHES,
  DEMO_STORY_SEGMENTS,
  DEMO_USER_STATUS_PATCHES,
  USERS,
} from '../../data';
import { recordCollectionSave } from '../../devActivity';
import type { StoryDraftMedia } from '../../../components/stories/storyDraft';
import type { StoriesByUserStore, User } from '../../../types';
import type { StoriesLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

export function WithStories<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, StoriesLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    get stories(): StoriesByUserStore {
      return this.load<StoriesByUserStore>('stories', {}) || {};
    }

    /**
     * Demo LIVE + story rings on the home feed (and profile when that user has segments).
     * In DEV, re-applies on each load; use applyDemoStoryStrip() from the dev panel anytime.
     */
    async applyDemoStoryStrip(options?: { resetViews?: boolean }) {
      await this.whenReady();

      const nextStories: StoriesByUserStore = { ...this.stories };
      Object.entries(DEMO_STORY_SEGMENTS).forEach(([userId, segments]) => {
        nextStories[userId] = segments.map((s) => ({ ...s }));
      });
      this.cache['stories'] = nextStories;

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

      await this.saveToIDB('stories', nextStories);
      await this.saveToIDB('users', updatedUsers);
      if (viewsChanged) await this.saveToIDB('story_views', views);
      await this.saveToIDB('demo_stories_seeded', true);

      try {
        localStorage.setItem('users', JSON.stringify(updatedUsers));
      } catch {
        /* ignore */
      }

      if (import.meta.env.DEV) {
        recordCollectionSave('stories', nextStories);
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
        await this.applyDemoStoryStrip({ resetViews: false });
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
      const all = this.stories;
      const userSegs = all[userId] || [];
      this.save('stories', { ...all, [userId]: this.cappedList([segment, ...userSegs], 'stories') });
    }

    get storyViews() {
      return this.load('story_views', {}) as Record<string, boolean>;
    }

    hasViewedStory(userId: string) {
      return !!this.storyViews[userId];
    }

    markStoryViewed(userId: string) {
      this.save('story_views', { ...this.storyViews, [userId]: true });
    }

  } as unknown as MixinCtor<T, StoriesLayer>;
}
