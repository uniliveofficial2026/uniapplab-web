import { DEFAULT_FOLLOW_GRAPH, POSTS, USERS } from '../../data';
import { CLOUD_SYNC_COLLECTION_KEYS } from '../../cloudSync/collectionKeys';
import {
  type CommentLike,
  countCommentThread,
  patchCommentTreeForUser,
} from '../../entityResolve';
import { postUserId, reelUserId, resolveUser } from '../../safe';
import type { StoryDraftMedia } from '../../../components/stories/storyDraft';
import type {
  AppNotification,
  LiveKind,
  Post,
  Reel,
  StoriesByUserStore,
  User,
} from '../../../types';
import type { WorkspaceTask } from '../../dbTypes';
import { scheduleSupabaseProfileSync } from '../../supabase/syncProfile';
import type { AuthPostsLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

const ACCOUNT_SNAPSHOT_STORE = 'account_local_snapshots';

const ACCOUNT_RESTORE_SKIP_KEYS = new Set([
  'isLoggedIn',
  'currentUserId',
  ACCOUNT_SNAPSHOT_STORE,
]);

const ACCOUNT_SNAPSHOT_KEYS = [
  ...CLOUD_SYNC_COLLECTION_KEYS,
  'profile_stories_migrated',
  'dev_stories_seeded_once',
] as const;

export function WithAuthPosts<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, AuthPostsLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    get posts(): Post[] {
      const raw = this.load<Post[]>('posts', POSTS) || POSTS;
      return this.asLocalDB().filterItemsByBlockedAuthors(raw);
    }
    get users(): User[] {
      return this.load<User[]>('users', USERS) || USERS;
    }
    get isLoggedIn() { return this.load('isLoggedIn', false); }
    get currentUserId() {
      if (!this.isLoggedIn) return '';
      return this.load('currentUserId', 'u1');
    }
    get currentUser() {
      try {
        if (!this.isLoggedIn) return USERS[0];
        const users = this.users || [];
        const id = this.currentUserId;
        if (!Array.isArray(users) || users.length === 0) return USERS[0];
        return users.find((u) => u && u.id === id) || users[0] || USERS[0];
      } catch {
        return USERS[0];
      }
    }

    private isLegacySeedUserId(userId: string): boolean {
      return /^u\d+$/.test(userId);
    }

    /**
     * After cloud first-session wipe or empty IDB, restore bundled demo feed for u1/u2…
     * so dev `?as=u1` and local demo accounts stay usable.
     */
    restoreLegacyDemoContentIfEmpty(userId: string) {
      if (!this.isLegacySeedUserId(userId)) return;

      const postsRaw = this.load<Post[] | null>('posts', null as unknown as Post[]);
      if (!Array.isArray(postsRaw) || postsRaw.length === 0) {
        this.save('posts', POSTS);
      }

      const reelsRaw = this.load<Reel[] | null>('reels', null as unknown as Reel[]);
      if (!Array.isArray(reelsRaw) || reelsRaw.length === 0) {
        delete this.cache['reels'];
        this.save('reels', this.asLocalDB().reels);
      }

      const usersRaw = this.load<User[] | null>('users', null as unknown as User[]);
      if (!Array.isArray(usersRaw) || usersRaw.length < 3) {
        this.save('users', USERS);
      }

      const followRaw = this.load<{ following?: Record<string, string[]> } | null>(
        'follow_graph',
        null as unknown as { following?: Record<string, string[]> }
      );
      const followingKeys = followRaw?.following ? Object.keys(followRaw.following) : [];
      if (followingKeys.length === 0) {
        this.save('follow_graph', DEFAULT_FOLLOW_GRAPH);
      }

      const tasksRaw = this.load<WorkspaceTask[] | null>(
        'workspace_tasks',
        null as unknown as WorkspaceTask[]
      );
      if (!Array.isArray(tasksRaw) || tasksRaw.length === 0) {
        this.save('workspace_tasks', [
          {
            id: 101,
            title: 'Update Marketing Assets',
            team: 'Design',
            due: 'Today',
            user: 1,
            completed: false,
          },
          {
            id: 102,
            title: 'Setup Secure Payment Gateway',
            team: 'Engineering',
            due: 'Tomorrow',
            user: 3,
            completed: false,
          },
          {
            id: 103,
            title: 'Weekly Analytics Review',
            team: 'Management',
            due: 'In 2 days',
            user: 0,
            completed: true,
          },
        ]);
      }

      const storiesRaw = this.load<Record<string, unknown> | null>(
        'stories',
        null as unknown as Record<string, unknown>
      );
      const storyKeys =
        storiesRaw && typeof storiesRaw === 'object' ? Object.keys(storiesRaw) : [];

      const host = this.asLocalDB();
      host.ensureDemoMessagesIfEmpty();
      host.ensureDemoNotifications();
      host.ensureDemoProfileVisitors();

      if (storyKeys.length === 0) {
        void host.applyDemoStoryStrip({ resetViews: false });
      }
    }

    login(userId: string) {
      const prevId = this.isLoggedIn ? this.currentUserId : '';
      if (prevId && prevId !== userId) {
        this.snapshotAccountState(prevId);
      }
      if (!prevId || prevId !== userId) {
        const restored = this.restoreAccountState(userId);
        if (!restored) {
          this.restoreLegacyDemoContentIfEmpty(userId);
        }
      }
      this.save('currentUserId', userId);
      this.save('isLoggedIn', true);
    }

    deleteAccountSnapshot(userId: string) {
      const snapshots =
        this.load<Record<string, Record<string, unknown>>>(ACCOUNT_SNAPSHOT_STORE, {}) || {};
      if (!snapshots[userId]) return;
      const next = { ...snapshots };
      delete next[userId];
      this.save(ACCOUNT_SNAPSHOT_STORE, next);
    }

    private snapshotAccountState(userId: string) {
      const snapshots =
        this.load<Record<string, Record<string, unknown>>>(ACCOUNT_SNAPSHOT_STORE, {}) || {};
      const state: Record<string, unknown> = {};
      for (const key of ACCOUNT_SNAPSHOT_KEYS) {
        const value =
          Object.prototype.hasOwnProperty.call(this.cache, key)
            ? this.cache[key]
            : this.load(key, undefined);
        if (value !== undefined) state[key] = value;
      }
      this.save(ACCOUNT_SNAPSHOT_STORE, { ...snapshots, [userId]: state });
    }

    private restoreAccountState(userId: string): boolean {
      const snapshots =
        this.load<Record<string, Record<string, unknown>>>(ACCOUNT_SNAPSHOT_STORE, {}) || {};
      const state = snapshots[userId];
      if (!state) return false;
      for (const [key, value] of Object.entries(state)) {
        if (ACCOUNT_RESTORE_SKIP_KEYS.has(key)) continue;
        this.save(key, value);
      }
      return true;
    }

    logout() {
      this.save('isLoggedIn', false);
      this.save('currentUserId', null);
    }

    /** Merge Supabase-authenticated user into local store and set session. */
    syncAuthUser(user: User) {
      const users = this.users.filter((u) => u.id !== user.id);
      this.save('users', [...users, user]);
      this.login(user.id);
      this.syncUserRefsInContent(user.id);
    }

    registerUser(user: User) {
      const added = [...this.users, user];
      this.save('users', added);
      this.login(user.id);
      this.syncUserRefsInContent(user.id);
    }

    cacheDiscoveredUsers(incoming: User[]) {
      if (!Array.isArray(incoming) || incoming.length === 0) return;
      const byId = new Map(this.users.map((u) => [u.id, u]));
      let changed = false;
      for (const user of incoming) {
        if (!user?.id) continue;
        const existing = byId.get(user.id);
        if (!existing) {
          byId.set(user.id, user);
          changed = true;
          continue;
        }
        const merged: User = {
          ...existing,
          ...user,
          isFollowing: existing.isFollowing,
          followers: existing.followers ?? user.followers,
          following: existing.following ?? user.following,
        };
        if (
          merged.username !== existing.username ||
          merged.displayName !== existing.displayName ||
          merged.avatarUrl !== existing.avatarUrl ||
          merged.bio !== existing.bio ||
          merged.publicUserId !== existing.publicUserId
        ) {
          byId.set(user.id, merged);
          changed = true;
        }
      }
      if (!changed) return;
      this.save('users', Array.from(byId.values()));
    }

    addPost(post: Partial<Post> & { user?: User }) {
      const author = resolveUser(this.users, post.user, this.currentUser);
      const newPost = {
        likes: 0,
        comments: 0,
        isLiked: false,
        isSaved: false,
        createdAt: new Date().toISOString(),
        ...post,
        user: author,
        id: post.id || `p_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      };
      this.save('posts', this.cappedList([newPost, ...this.posts], 'posts'));
    }

    updatePost(id: string, updateFn: (post: Post) => Post) {
      const before = this.posts.find((p) => p.id === id);
      const updated = this.posts.map((p) => (p.id === id ? updateFn(p) : p));
      this.save('posts', updated);
      const after = updated.find((p) => p.id === id);
      if (
        before &&
        after &&
        (before.imageUrl !== after.imageUrl || before.videoUrl !== after.videoUrl)
      ) {
        this.syncPostMediaInNotifications(after);
      }
    }

    deletePost(id: string) {
      const updated = this.posts.filter((p) => p.id !== id);
      this.save('posts', updated);
    }

    /** Archive or unarchive a post (owner only in UI). Returns new archived state. */
    togglePostArchive(postId: string): boolean {
      let nextArchived = false;
      this.updatePost(postId, (p) => {
        nextArchived = !p.isArchived;
        return { ...p, isArchived: nextArchived };
      });
      return nextArchived;
    }

    updateUser(id: string, updateFn: (user: User) => User) {
      const prior = this.users.find((u: User) => u?.id === id);
      const updated = this.users.map((u) => (u.id === id ? updateFn(u) : u));
      this.save('users', updated);
      const next = updated.find((u: User) => u?.id === id);
      if (prior && next && prior.status !== 'live' && next.status === 'live') {
        this.asLocalDB().notifyLiveStarted(id, next.liveKind);
      }
      if (prior && next && this.userContentSurfaceChanged(prior, next)) {
        this.syncUserRefsInContent(id);
      }
      if (next) {
        scheduleSupabaseProfileSync(next);
      }
    }

    /** Fields embedded in posts/reels/comments — skip full content sync on premium-only updates. */
    private userContentSurfaceChanged(before: User, after: User): boolean {
      return (
        before.displayName !== after.displayName ||
        before.username !== after.username ||
        before.bio !== after.bio ||
        before.avatarUrl !== after.avatarUrl ||
        before.status !== after.status ||
        before.liveKind !== after.liveKind ||
        before.isVerified !== after.isVerified
      );
    }

    /** Start or end a live stream for a user (updates ring + notifies followers). */
    setUserLiveStatus(
      userId: string,
      isLive: boolean,
      liveKind: LiveKind = 'solo'
    ): boolean {
      const prior = this.users.find((u: User) => u?.id === userId);
      if (!prior) return false;
      const hasStory = (this.asLocalDB().stories[userId] ?? []).length > 0;
      this.updateUser(userId, (u) => ({
        ...u,
        status: isLive ? 'live' : hasStory ? 'story' : 'none',
        liveKind: isLive ? liveKind : undefined,
      }));
      return true;
    }

    private mergeUserIntoEmbedded(embedded: Partial<User>, fresh: User) {
      if (!embedded?.id || embedded.id !== fresh.id) return embedded;
      return { ...embedded, ...fresh, id: fresh.id };
    }

    /** Keep embedded user snapshots in content + comments in sync after profile changes. */
    private syncUserRefsInContent(userId: string) {
      const fresh = this.users.find((u) => u?.id === userId);
      if (!fresh) return;
      const merge = (embedded: Partial<User>) => this.mergeUserIntoEmbedded(embedded, fresh);

      const posts = this.posts.map((p) =>
        p?.user?.id === userId ? { ...p, user: merge(p.user) } : p
      );
      if (posts.some((p, i) => p !== this.posts[i])) {
        this.save('posts', posts);
      }

      const reelsSource = this.asLocalDB().reels;
      const reels = reelsSource.map((r) =>
        r?.user?.id === userId ? { ...r, user: merge(r.user) } : r
      );
      if (reels.some((r, i) => r !== reelsSource[i])) {
        this.save('reels', reels);
      }

      this.asLocalDB().syncUserRefsInNotificationInboxes(userId, fresh);

      const allStories = this.asLocalDB().stories;
      if (allStories && typeof allStories === 'object') {
        let storiesChanged = false;
        const nextStories: StoriesByUserStore = { ...allStories };
        for (const [key, segments] of Object.entries(allStories)) {
          if (!Array.isArray(segments)) continue;
          const updated = segments.map((seg) => {
            const withUser = seg as StoryDraftMedia & { user?: Partial<User> };
            return withUser?.user?.id === userId
              ? { ...withUser, user: merge(withUser.user) }
              : seg;
          });
          if (updated.some((seg, i) => seg !== segments[i])) {
            nextStories[key] = updated;
            storiesChanged = true;
          }
        }
        if (storiesChanged) this.save('stories', nextStories);
      }

      const allProfileStories = this.asLocalDB().profileStories;
      if (allProfileStories && typeof allProfileStories === 'object') {
        let profileStoriesChanged = false;
        const nextProfileStories: StoriesByUserStore = { ...allProfileStories };
        for (const [key, segments] of Object.entries(allProfileStories)) {
          if (!Array.isArray(segments)) continue;
          const updated = segments.map((seg) => {
            const withUser = seg as StoryDraftMedia & { user?: Partial<User> };
            return withUser?.user?.id === userId
              ? { ...withUser, user: merge(withUser.user) }
              : seg;
          });
          if (updated.some((seg, i) => seg !== segments[i])) {
            nextProfileStories[key] = updated;
            profileStoriesChanged = true;
          }
        }
        if (profileStoriesChanged) this.save('profile_stories', nextProfileStories);
      }

      this.syncUserRefsInComments(userId, fresh);
    }

    private syncUserRefsInComments(userId: string, fresh: User) {
      const pComments = this.asLocalDB().postComments || {};
      let postCommentsChanged = false;
      const nextPostComments: Record<string, CommentLike[]> = { ...pComments };
      for (const [postId, list] of Object.entries(pComments)) {
        if (!Array.isArray(list)) continue;
        const updated = patchCommentTreeForUser(list as CommentLike[], fresh);
        if (updated.some((c, i) => c !== list[i])) {
          nextPostComments[postId] = updated;
          postCommentsChanged = true;
        }
      }
      if (postCommentsChanged) this.save('post_comments', nextPostComments);

      const rComments = this.asLocalDB().reelComments || {};
      let reelCommentsChanged = false;
      const nextReelComments: Record<string, CommentLike[]> = { ...rComments };
      for (const [reelId, list] of Object.entries(rComments)) {
        if (!Array.isArray(list)) continue;
        const updated = patchCommentTreeForUser(list as CommentLike[], fresh);
        if (updated.some((c, i) => c !== list[i])) {
          nextReelComments[reelId] = updated;
          reelCommentsChanged = true;
        }
      }
      if (reelCommentsChanged) this.save('reel_comments', nextReelComments);
    }

    syncPostCommentCount(postId: string) {
      const total = countCommentThread(this.asLocalDB().postComments[postId] || []);
      const posts = this.posts.map((p) =>
        p.id === postId ? { ...p, comments: total } : p
      );
      this.save('posts', posts);
    }

    syncReelCommentCount(reelId: string) {
      const total = countCommentThread(this.asLocalDB().reelComments[reelId] || []);
      const reels = this.asLocalDB().reels.map((r) =>
        r.id === reelId ? { ...r, comments: total } : r
      );
      this.save('reels', reels);
    }

    private syncPostMediaInNotifications(post: Post) {
      const thumb = post.imageUrl || post.videoUrl;
      const postId = post?.id;
      if (!thumb && !postId) return;
      const store = this.asLocalDB().getNotificationInboxStore();
      let changed = false;
      const next: Record<string, AppNotification[]> = {};
      for (const ownerId of Object.keys(store)) {
        const list = store[ownerId].map((n) => {
          if (postId && n.postId === postId) {
            changed = true;
            return { ...n, postImage: thumb ?? n.postImage };
          }
          if (n?.user?.id === post.user?.id && n.postImage) {
            changed = true;
            return { ...n, postImage: thumb };
          }
          return n;
        });
        next[ownerId] = list;
      }
      if (changed) this.asLocalDB().saveNotificationInboxStore(next);
    }

    enrichCommentPayload(comment: Partial<CommentLike>): CommentLike {
      const me = this.currentUser;
      return {
        ...comment,
        userId: comment.userId ?? me?.id,
        username: comment.username ?? me?.username ?? 'you',
        avatarUrl: comment.avatarUrl ?? me?.avatarUrl,
      };
    }

    togglePostLike(postId: string): boolean {
      const meId = this.currentUserId;
      const post = this.posts.find((p: Post) => p?.id === postId);
      const ownerId = postUserId(post);
      let nextLiked = false;
      this.updatePost(postId, (p) => {
        nextLiked = !p.isLiked;
        const likes = Math.max(0, (Number(p.likes) || 0) + (nextLiked ? 1 : -1));
        return { ...p, isLiked: nextLiked, likes };
      });
      if (nextLiked && meId && ownerId && ownerId !== meId) {
        this.asLocalDB().pushNotificationForUser(ownerId, {
          type: 'like',
          actorUserId: meId,
          postId,
          postImage: post?.imageUrl || post?.videoUrl,
        });
      }
      return nextLiked;
    }

    togglePostSave(postId: string): boolean {
      const meId = this.currentUserId;
      const post = this.posts.find((p: Post) => p?.id === postId);
      const ownerId = postUserId(post);
      let nextSaved = false;
      this.updatePost(postId, (p) => {
        nextSaved = !p.isSaved;
        return { ...p, isSaved: nextSaved };
      });
      if (nextSaved && meId && ownerId && ownerId !== meId) {
        this.asLocalDB().pushNotificationForUser(ownerId, {
          type: 'activity',
          actorUserId: meId,
          postId,
          postImage: post?.imageUrl || post?.videoUrl,
          title: 'Post saved',
          text: 'saved your post to their collection',
          targetTab: 'home',
        });
      }
      return nextSaved;
    }

    toggleReelLike(reelId: string): boolean {
      const meId = this.currentUserId;
      const reel = this.asLocalDB().reels.find((r: Reel) => r?.id === reelId);
      const ownerId = reelUserId(reel);
      let nextLiked = false;
      this.asLocalDB().updateReel(reelId, (r) => {
        nextLiked = !r.isLiked;
        const likes = Math.max(0, (Number(r.likes) || 0) + (nextLiked ? 1 : -1));
        return { ...r, isLiked: nextLiked, likes };
      });
      if (nextLiked && meId && ownerId && ownerId !== meId) {
        this.asLocalDB().pushNotificationForUser(ownerId, {
          type: 'like',
          actorUserId: meId,
          reelId,
          postImage: reel?.videoUrl,
        });
      }
      return nextLiked;
    }

    toggleReelSave(reelId: string): boolean {
      let nextSaved = false;
      this.asLocalDB().updateReel(reelId, (r) => {
        nextSaved = !r.isSaved;
        return { ...r, isSaved: nextSaved };
      });
      return nextSaved;
    }
  } as unknown as MixinCtor<T, AuthPostsLayer>;
}
