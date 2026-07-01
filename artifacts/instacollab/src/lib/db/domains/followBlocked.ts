import { DEFAULT_FOLLOW_GRAPH } from '../../data';
import { resolveUser } from '../../safe';
import type { User } from '../../../types';
import type { FollowBlockedLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

type FollowRequestsStore = {
  /** profileOwnerId → requester user ids */
  pending: Record<string, string[]>;
};

const EMPTY_FOLLOW_REQUESTS: FollowRequestsStore = { pending: {} };

export function WithFollowBlocked<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, FollowBlockedLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    private knownUserIds(): Set<string> {
      return new Set(
        this.asLocalDB()
          .users.map((u) => u?.id)
          .filter((id): id is string => Boolean(id)),
      );
    }

    /** Drop follow/blocked edges that point at users missing from the local roster. */
    private reconcileSocialGraph(): void {
      const known = this.knownUserIds();
      if (known.size === 0) return;

      const graph = this.load<{ following?: Record<string, string[]> } | null>('follow_graph', null);
      if (graph?.following && typeof graph.following === 'object') {
        let graphChanged = false;
        const nextFollowing: Record<string, string[]> = {};
        for (const [followerId, list] of Object.entries(graph.following)) {
          if (!known.has(followerId)) {
            graphChanged = true;
            continue;
          }
          const raw = Array.isArray(list) ? list : [];
          const pruned = raw.filter((id) => known.has(id));
          if (pruned.length !== raw.length) graphChanged = true;
          if (pruned.length > 0) {
            nextFollowing[followerId] = [...new Set(pruned)];
          }
        }
        if (graphChanged) {
          this.save('follow_graph', { following: nextFollowing });
          this.syncIsFollowingFromGraph();
        }
      }

      const meId = this.asLocalDB().currentUserId;
      if (!meId) return;
      const store = this.getBlockedUsersStore();
      const myBlocked = store[meId];
      if (!Array.isArray(myBlocked)) return;
      const prunedBlocked = myBlocked.filter((id) => known.has(id));
      if (prunedBlocked.length !== myBlocked.length) {
        this.saveBlockedUsersStore({ ...store, [meId]: prunedBlocked });
      }
    }

    private ensureFollowGraph() {
      if (this.followGraphEnsured) return;
      // Mark complete before sync — sync reads the graph via getFollowingIds → getFollowGraph.
      this.followGraphEnsured = true;
      const existing = this.load('follow_graph', null as { following?: Record<string, string[]> } | null);
      if (!existing?.following || typeof existing.following !== 'object') {
        this.save('follow_graph', DEFAULT_FOLLOW_GRAPH);
      }
      this.reconcileSocialGraph();
      this.syncIsFollowingFromGraph();
    }

    getFollowGraph(): { following: Record<string, string[]> } {
      this.ensureFollowGraph();
      this.reconcileSocialGraph();
      return this.load('follow_graph', DEFAULT_FOLLOW_GRAPH) || DEFAULT_FOLLOW_GRAPH;
    }

    getFollowingIds(userId: string): string[] {
      const id = String(userId || '').trim();
      if (!id) return [];
      const list = this.getFollowGraph().following[id];
      return Array.isArray(list) ? [...new Set(list.filter(Boolean))] : [];
    }

    getFollowerIds(userId: string): string[] {
      const id = String(userId || '').trim();
      if (!id) return [];
      const graph = this.getFollowGraph();
      const followers: string[] = [];
      Object.entries(graph.following).forEach(([followerId, list]) => {
        if (followerId !== id && Array.isArray(list) && list.includes(id)) {
          followers.push(followerId);
        }
      });
      return [...new Set(followers)];
    }

    isFollowingUser(targetUserId: string): boolean {
      const meId = this.asLocalDB().currentUserId;
      if (!targetUserId || targetUserId === meId) return false;
      return this.getFollowingIds(meId).includes(targetUserId);
    }

    getUsersByIds(userIds: string[]) {
      const users = this.asLocalDB().users;
      const seen = new Set<string>();
      const result: typeof users = [];
      userIds.forEach((id) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        const u = users.find((row) => row?.id === id);
        if (u) result.push(u);
      });
      return result;
    }

    getFollowListMembers(profileUserId: string, mode: 'followers' | 'following'): User[] {
      const memberIds =
        mode === 'followers'
          ? this.getFollowerIds(profileUserId)
          : this.getFollowingIds(profileUserId);
      return this.getUsersByIds(memberIds)
        .map((u) => resolveUser(this.asLocalDB().users, u))
        .filter((u) => !this.isUserBlocked(u.id))
        .sort((a, b) =>
          (a.username || '').localeCompare(b.username || '', undefined, { sensitivity: 'base' }),
        );
    }

    /** Keep `isFollowing` on user rows aligned with the graph for the logged-in viewer. */
    private syncIsFollowingFromGraph() {
      const meId = this.asLocalDB().currentUserId;
      const following = new Set(this.getFollowingIds(meId));
      const users = this.asLocalDB().users;
      let changed = false;
      const updated = users.map((u) => {
        if (!u?.id || u.id === meId) {
          if (!('isFollowing' in u)) return u;
          changed = true;
          const { isFollowing: _removed, ...rest } = u;
          return rest;
        }
        const shouldFollow = following.has(u.id);
        if (u.isFollowing === shouldFollow) return u;
        changed = true;
        return { ...u, isFollowing: shouldFollow };
      });
      if (!changed) return;
      this.save('users', updated);
    }

    private setUserFollows(followerId: string, followingIds: string[]) {
      const graph = this.getFollowGraph();
      const next = {
        following: {
          ...graph.following,
          [followerId]: [...new Set(followingIds.filter(Boolean))],
        },
      };
      this.save('follow_graph', next);
      if (followerId === this.asLocalDB().currentUserId) {
        this.syncIsFollowingFromGraph();
      }
    }

    private getFollowRequestsStore(): FollowRequestsStore {
      const raw = this.load<FollowRequestsStore>('follow_requests', EMPTY_FOLLOW_REQUESTS);
      if (!raw?.pending || typeof raw.pending !== 'object') return EMPTY_FOLLOW_REQUESTS;
      return raw;
    }

    private saveFollowRequestsStore(store: FollowRequestsStore) {
      this.save('follow_requests', store);
    }

    private addFollowRequest(profileOwnerId: string, requesterId: string) {
      const ownerId = String(profileOwnerId || '').trim();
      const fromId = String(requesterId || '').trim();
      if (!ownerId || !fromId || ownerId === fromId) return;
      const store = this.getFollowRequestsStore();
      const list = store.pending[ownerId] ?? [];
      if (list.includes(fromId)) return;
      this.saveFollowRequestsStore({
        pending: { ...store.pending, [ownerId]: [...list, fromId] },
      });
    }

    private removeFollowRequest(profileOwnerId: string, requesterId: string) {
      const ownerId = String(profileOwnerId || '').trim();
      const fromId = String(requesterId || '').trim();
      if (!ownerId || !fromId) return;
      const store = this.getFollowRequestsStore();
      const list = store.pending[ownerId] ?? [];
      if (!list.includes(fromId)) return;
      const next = list.filter((id) => id !== fromId);
      const pending = { ...store.pending };
      if (next.length === 0) delete pending[ownerId];
      else pending[ownerId] = next;
      this.saveFollowRequestsStore({ pending });
    }

    /** Whether `userId` has a private account (posts hidden until approved follower). */
    isAccountPrivate(userId: string): boolean {
      const id = String(userId || '').trim();
      if (!id) return false;
      const user = this.asLocalDB().users.find((u) => u?.id === id);
      if (!user) return false;
      if (id === this.asLocalDB().currentUserId) {
        return !!(user.isPrivate ?? this.asLocalDB().settings.isPrivate);
      }
      return !!user.isPrivate;
    }

    setAccountPrivate(enabled: boolean) {
      const meId = this.asLocalDB().currentUserId;
      if (!meId) return;
      const next = !!enabled;
      this.asLocalDB().updateUser(meId, (u) => ({ ...u, isPrivate: next }));
      this.asLocalDB().updateSettings({ isPrivate: next });
    }

    /** Logged-in viewer sent a follow request to a private account. */
    hasPendingFollowRequest(targetUserId: string): boolean {
      const meId = this.asLocalDB().currentUserId;
      const ownerId = String(targetUserId || '').trim();
      if (!meId || !ownerId) return false;
      const list = this.getFollowRequestsStore().pending[ownerId] ?? [];
      return list.includes(meId);
    }

    /** `requesterId` asked to follow the logged-in user. */
    hasIncomingFollowRequest(requesterId: string): boolean {
      const meId = this.asLocalDB().currentUserId;
      const fromId = String(requesterId || '').trim();
      if (!meId || !fromId) return false;
      const list = this.getFollowRequestsStore().pending[meId] ?? [];
      return list.includes(fromId);
    }

    getPendingFollowRequesterIds(profileUserId?: string): string[] {
      const ownerId = String(profileUserId || this.asLocalDB().currentUserId || '').trim();
      if (!ownerId) return [];
      return [...new Set((this.getFollowRequestsStore().pending[ownerId] ?? []).filter(Boolean))];
    }

    canViewUserContent(targetUserId: string): boolean {
      const meId = this.asLocalDB().currentUserId;
      const id = String(targetUserId || '').trim();
      if (!id || id === meId) return true;
      if (!this.isAccountPrivate(id)) return true;
      return this.isFollowingUser(id);
    }

    getFollowActionState(targetUserId: string): {
      isFollowing: boolean;
      isRequested: boolean;
      canViewContent: boolean;
      isPrivate: boolean;
    } {
      const id = String(targetUserId || '').trim();
      return {
        isFollowing: id ? this.isFollowingUser(id) : false,
        isRequested: id ? this.hasPendingFollowRequest(id) : false,
        canViewContent: id ? this.canViewUserContent(id) : true,
        isPrivate: id ? this.isAccountPrivate(id) : false,
      };
    }

    approveFollowRequest(requesterId: string): boolean {
      const meId = this.asLocalDB().currentUserId;
      const fromId = String(requesterId || '').trim();
      if (!meId || !fromId || fromId === meId) return false;
      if (!this.hasIncomingFollowRequest(fromId)) return false;

      this.removeFollowRequest(meId, fromId);
      this.asLocalDB().removeNotificationMatches(meId, {
        type: 'follow_request',
        actorUserId: fromId,
      });

      const requesterFollowing = this.getFollowingIds(fromId);
      if (!requesterFollowing.includes(meId)) {
        this.setUserFollows(fromId, [...requesterFollowing, meId]);
        this.asLocalDB().updateUser(meId, (u) => ({
          ...u,
          followers: Math.max(0, (Number(u.followers) || 0) + 1),
        }));
        this.asLocalDB().updateUser(fromId, (u) => ({
          ...u,
          following: Math.max(0, (Number(u.following) || 0) + 1),
          isFollowing: true,
        }));
        this.asLocalDB().pushNotificationForUser(fromId, {
          type: 'follow',
          actorUserId: meId,
          text: 'accepted your follow request.',
        });
      }
      return true;
    }

    rejectFollowRequest(requesterId: string): boolean {
      const meId = this.asLocalDB().currentUserId;
      const fromId = String(requesterId || '').trim();
      if (!meId || !fromId) return false;
      if (!this.hasIncomingFollowRequest(fromId)) return false;
      this.removeFollowRequest(meId, fromId);
      this.asLocalDB().removeNotificationMatches(meId, {
        type: 'follow_request',
        actorUserId: fromId,
      });
      return true;
    }

    private applyFollowGraph(meId: string, targetUserId: string, nextFollowing: boolean) {
      const delta = nextFollowing ? 1 : -1;
      const myFollowing = this.getFollowingIds(meId);
      const nextList = nextFollowing
        ? [...myFollowing, targetUserId]
        : myFollowing.filter((id) => id !== targetUserId);
      this.setUserFollows(meId, nextList);

      this.asLocalDB().updateUser(targetUserId, (u) => ({
        ...u,
        isFollowing: nextFollowing,
        followers: Math.max(0, (Number(u.followers) || 0) + delta),
      }));

      this.asLocalDB().updateUser(meId, (u) => ({
        ...u,
        following: Math.max(0, (Number(u.following) || 0) + delta),
      }));

      if (nextFollowing) {
        this.asLocalDB().pushNotificationForUser(targetUserId, {
          type: 'follow',
          actorUserId: meId,
        });
      } else {
        this.asLocalDB().removeNotificationMatches(targetUserId, {
          type: 'follow',
          actorUserId: meId,
        });
        this.removeFollowRequest(targetUserId, meId);
        this.asLocalDB().removeNotificationMatches(targetUserId, {
          type: 'follow_request',
          actorUserId: meId,
        });
      }
    }

    /**
     * Idempotently add a directed follow edge (follower → following).
     * Demo/dev seeds only — no notifications or privacy checks.
     */
    ensureUserFollows(followerId: string, followingId: string): void {
      const follower = String(followerId || '').trim();
      const following = String(followingId || '').trim();
      if (!follower || !following || follower === following) return;
      const list = this.getFollowingIds(follower);
      if (list.includes(following)) return;
      this.setUserFollows(follower, [...list, following]);
    }

    /**
     * Toggle whether the logged-in user follows `targetUserId`.
     * Private accounts require an approved follow request before content is visible.
     * @returns new following state, or null if invalid.
     */
    toggleFollow(targetUserId: string): boolean | null {
      const meId = this.asLocalDB().currentUserId;
      if (!targetUserId || targetUserId === meId) return null;

      const target = this.asLocalDB().users.find((u) => u?.id === targetUserId);
      if (!target) return null;

      const currentlyFollowing = this.isFollowingUser(targetUserId);

      if (!currentlyFollowing && this.isAccountPrivate(targetUserId)) {
        if (this.hasPendingFollowRequest(targetUserId)) {
          this.removeFollowRequest(targetUserId, meId);
          this.asLocalDB().removeNotificationMatches(targetUserId, {
            type: 'follow_request',
            actorUserId: meId,
          });
          return false;
        }
        this.addFollowRequest(targetUserId, meId);
        this.asLocalDB().pushNotificationForUser(targetUserId, {
          type: 'follow_request',
          actorUserId: meId,
        });
        return false;
      }

      const nextFollowing = !currentlyFollowing;
      this.applyFollowGraph(meId, targetUserId, nextFollowing);
      return nextFollowing;
    }

    filterPostsByPrivateAuthors<T extends { user?: { id?: string } }>(items: T[]): T[] {
      const meId = this.asLocalDB().currentUserId;
      return items.filter((item) => {
        const authorId = item?.user?.id;
        if (!authorId || authorId === meId) return true;
        return this.canViewUserContent(authorId);
      });
    }

    private getBlockedUsersStore(): Record<string, string[]> {
      const raw = this.load<unknown>('blocked_users', {});
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      return raw as Record<string, string[]>;
    }

    private saveBlockedUsersStore(store: Record<string, string[]>) {
      this.save('blocked_users', store);
    }

    /** User ids the logged-in viewer has blocked. */
    getBlockedUserIds(): string[] {
      const meId = this.asLocalDB().currentUserId;
      const list = this.getBlockedUsersStore()[meId];
      return Array.isArray(list) ? [...new Set(list.filter(Boolean))] : [];
    }

    isUserBlocked(targetUserId: string): boolean {
      const id = String(targetUserId || '').trim();
      if (!id) return false;
      return this.getBlockedUserIds().includes(id);
    }

    filterItemsByBlockedAuthors<T extends { user?: { id?: string } }>(items: T[]): T[] {
      const blocked = new Set(this.getBlockedUserIds());
      if (blocked.size === 0) return items;
      return items.filter((item) => {
        const authorId = item?.user?.id;
        return !authorId || !blocked.has(authorId);
      });
    }

    /**
     * Block a user for the logged-in viewer. Unfollows if needed and hides their posts/reels.
     * @returns true when the user is blocked after the call.
     */
    blockUser(targetUserId: string): boolean {
      const meId = this.asLocalDB().currentUserId;
      const id = String(targetUserId || '').trim();
      if (!id || id === meId) return false;
      if (!this.asLocalDB().users.some((u: User) => u?.id === id)) return false;
      if (this.isUserBlocked(id)) return true;

      const store = this.getBlockedUsersStore();
      const list = this.getBlockedUserIds();
      this.saveBlockedUsersStore({ ...store, [meId]: [...list, id] });

      if (this.isFollowingUser(id)) {
        this.toggleFollow(id);
      }

      return true;
    }

    /** Resolved user rows for accounts the logged-in viewer has blocked. */
    getBlockedUsers(): User[] {
      return this.getUsersByIds(this.getBlockedUserIds()).map((u) =>
        resolveUser(this.asLocalDB().users, u)
      );
    }

    /** Remove a user from the logged-in viewer's block list. */
    unblockUser(targetUserId: string): boolean {
      const meId = this.asLocalDB().currentUserId;
      const id = String(targetUserId || '').trim();
      if (!id || id === meId) return false;

      const store = this.getBlockedUsersStore();
      const list = this.getBlockedUserIds();
      if (!list.includes(id)) return false;

      this.saveBlockedUsersStore({
        ...store,
        [meId]: list.filter((blockedId) => blockedId !== id),
      });
      return true;
    }

  } as unknown as MixinCtor<T, FollowBlockedLayer>;
}
