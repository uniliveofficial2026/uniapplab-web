import {
  LEGACY_NOTIFICATIONS_KEY,
  NOTIFICATION_INBOX_KEY,
  NOTIFICATIONS_CAP,
} from '../constants';
import { LIVE_KIND_LABELS } from '../../liveRing';
import { notificationDedupeKey } from '../../notifications';
import { postUserId, resolveUser, safeUserId, userAtModuloIndex } from '../../safe';
import type {
  AppNotification,
  AppNotificationType,
  LiveKind,
  Post,
  User,
} from '../../../types';
import type { NotificationsLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

export function WithNotifications<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, NotificationsLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    private getNotificationInboxStore(): Record<string, AppNotification[]> {
      const raw = this.load<Record<string, AppNotification[]>>(
        NOTIFICATION_INBOX_KEY,
        {}
      );
      return raw && typeof raw === 'object' ? raw : {};
    }

    private saveNotificationInboxStore(store: Record<string, AppNotification[]>) {
      this.save(NOTIFICATION_INBOX_KEY, store);
    }

    private migrateLegacyNotificationsInbox() {
      const legacy = this.load<AppNotification[]>(LEGACY_NOTIFICATIONS_KEY, []);
      if (!Array.isArray(legacy) || legacy.length === 0) return;
      const meId = this.asLocalDB().currentUserId;
      if (!meId) return;
      const store = this.getNotificationInboxStore();
      if (Array.isArray(store[meId]) && store[meId].length > 0) return;
      const normalized = legacy.map((n) => this.normalizeNotificationRow(n));
      this.saveNotificationInboxStore({ ...store, [meId]: normalized });
    }

    private normalizeNotificationRow(raw: Partial<AppNotification>): AppNotification {
      const type = (raw.type ?? 'system') as AppNotificationType;
      const actorUserId =
        raw.actorUserId ?? raw.user?.id ?? undefined;
      const actor = actorUserId
        ? this.asLocalDB().users.find((u: User) => u?.id === actorUserId)
        : raw.user;
      return {
        id: raw.id ?? `n_${Math.random().toString(36).slice(2, 11)}`,
        type,
        createdAt:
          typeof raw.createdAt === 'number' && raw.createdAt > 0
            ? raw.createdAt
            : Date.now() - 3600_000,
        read: !!raw.read,
        actorUserId,
        user: actor ? resolveUser(this.asLocalDB().users, actor) : undefined,
        title: raw.title,
        text: raw.text,
        postId: raw.postId,
        reelId: raw.reelId,
        postImage: raw.postImage,
        orderId: raw.orderId,
        link: raw.link,
        taskId: raw.taskId,
        targetTab: raw.targetTab,
        liveKind: raw.liveKind,
      };
    }

    private notifyLiveStarted(hostUserId: string, liveKind?: LiveKind) {
      const hostId = safeUserId(hostUserId);
      if (!hostId) return;
      const kind = liveKind ?? 'solo';
      const label = LIVE_KIND_LABELS[kind] ?? 'Live';
      const followers = this.asLocalDB().getFollowerIds(hostId);
      for (const followerId of followers) {
        if (!followerId || followerId === hostId) continue;
        this.asLocalDB().pushNotificationForUser(followerId, {
          type: 'live',
          actorUserId: hostId,
          liveKind: kind,
          title: 'Live now',
          text: `started a ${label} live — tap to watch`,
          targetTab: 'live',
          link: `live:${hostId}`,
        });
      }
    }

    private notifyLiveJoined(
      hostUserId: string,
      viewerUserId: string,

      liveKind?: LiveKind
    ) {
      const hostId = safeUserId(hostUserId);
      const viewerId = safeUserId(viewerUserId);
      if (!hostId || !viewerId || hostId === viewerId) return;
      const kind = liveKind ?? 'solo';
      const label = LIVE_KIND_LABELS[kind] ?? 'Live';
      this.asLocalDB().pushNotificationForUser(hostId, {
        type: 'live',
        actorUserId: viewerId,
        liveKind: kind,
        title: 'Live viewer',
        text: `joined your ${label} live`,
        targetTab: 'live',
        link: `live:${hostId}`,
      });
    }

    private syncUserRefsInNotificationInboxes(userId: string, fresh: User) {
      const store = this.getNotificationInboxStore();
      let changed = false;
      const next: Record<string, AppNotification[]> = {};
      for (const ownerId of Object.keys(store)) {
        const list = store[ownerId].map((n) => {
          if (n.actorUserId !== userId && n.user?.id !== userId) return n;
          changed = true;
          return {
            ...n,
            actorUserId: n.actorUserId ?? userId,
            user: resolveUser(this.asLocalDB().users, fresh),
          };
        });
        next[ownerId] = list;
      }
      if (changed) this.saveNotificationInboxStore(next);
    }

    getNotificationsForUser(ownerUserId: string): AppNotification[] {
      const ownerId = String(ownerUserId || '').trim();
      if (!ownerId) return [];
      const list = this.getNotificationInboxStore()[ownerId] ?? [];
      return [...list]
        .map((n) => this.normalizeNotificationRow(n))
        .sort((a, b) => b.createdAt - a.createdAt);
    }

    get notifications(): AppNotification[] {
      const meId = this.asLocalDB().currentUserId;
      return meId ? this.asLocalDB().getNotificationsForUser(meId) : [];
    }

    getUnreadNotificationCount(ownerUserId?: string): number {
      const ownerId = String(ownerUserId || this.asLocalDB().currentUserId || '').trim();
      if (!ownerId) return 0;
      return this.asLocalDB().getNotificationsForUser(ownerId).filter((n) => !n.read).length;
    }

    private notificationsDeliveryEnabled(): boolean {
      return this.asLocalDB().settings.notificationsEnabled !== false;
    }

    private resolveTaskAssigneeUserId(task: { user?: unknown }): string | null {
      const assignee = userAtModuloIndex(this.asLocalDB().users, task?.user, this.asLocalDB().currentUser);
      return safeUserId(assignee?.id);
    }

    private notifyWorkspaceTeam(
      payload: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'user'> & {
        type: 'activity';
      },
      excludeUserId?: string
    ) {
      const actorId = safeUserId(excludeUserId ?? payload.actorUserId);
      for (const user of this.asLocalDB().users) {
        const userId = safeUserId(user?.id);
        if (!userId || (actorId && userId === actorId)) continue;
        this.asLocalDB().pushNotificationForUser(userId, payload);
      }
    }

    pushNotificationForUser(
      ownerUserId: string,
      payload: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'user'> & {
        type: AppNotificationType;
      }
    ): AppNotification | null {
      if (!this.notificationsDeliveryEnabled()) return null;
      const ownerId = String(ownerUserId || '').trim();
      if (!ownerId) return null;

      const row = this.normalizeNotificationRow({
        ...payload,
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        read: false,
      });

      const store = this.getNotificationInboxStore();
      const list = store[ownerId] ?? [];
      const key = notificationDedupeKey(row);
      const filtered = list.filter((n) => notificationDedupeKey(n) !== key);
      const next = [row, ...filtered].slice(0, NOTIFICATIONS_CAP);
      this.saveNotificationInboxStore({ ...store, [ownerId]: next });

      if (ownerId === this.asLocalDB().currentUserId) {
        this.asLocalDB().setHasUnreadNotifications(true);
      }
      this.notifyListeners();
      return row;
    }

    addNotification(notification: Partial<AppNotification> & { type: AppNotificationType }) {
      const meId = this.asLocalDB().currentUserId;
      if (!meId) return null;
      const actorUserId =
        notification.actorUserId ??
        notification.user?.id ??
        undefined;
      return this.asLocalDB().pushNotificationForUser(meId, {
        ...notification,
        actorUserId,
        type: notification.type,
      });
    }

    removeNotificationMatches(
      ownerUserId: string,
      match: {
        type?: AppNotificationType;
        actorUserId?: string;
        postId?: string;
      }
    ) {
      const ownerId = String(ownerUserId || '').trim();
      if (!ownerId) return;
      const store = this.getNotificationInboxStore();
      const list = store[ownerId] ?? [];
      const next = list.filter((n) => {
        if (match.type && n.type !== match.type) return true;
        if (match.actorUserId && n.actorUserId !== match.actorUserId) return true;
        if (match.postId && n.postId !== match.postId) return true;
        return false;
      });
      if (next.length === list.length) return;
      this.saveNotificationInboxStore({ ...store, [ownerId]: next });
      this.notifyListeners();
    }

    markNotificationRead(notificationId: string, ownerUserId?: string) {
      const ownerId = String(ownerUserId || this.asLocalDB().currentUserId || '').trim();
      if (!ownerId || !notificationId) return;
      const store = this.getNotificationInboxStore();
      const list = store[ownerId] ?? [];
      const next = list.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      this.saveNotificationInboxStore({ ...store, [ownerId]: next });
      if (ownerId === this.asLocalDB().currentUserId) {
        const unread = next.filter((n) => !n.read).length;
        this.asLocalDB().setHasUnreadNotifications(unread > 0);
      }
      this.notifyListeners();
    }

    markAllNotificationsRead(ownerUserId?: string) {
      const ownerId = String(ownerUserId || this.asLocalDB().currentUserId || '').trim();
      if (!ownerId) return;
      const store = this.getNotificationInboxStore();
      const next = (store[ownerId] ?? []).map((n) => ({ ...n, read: true }));
      this.saveNotificationInboxStore({ ...store, [ownerId]: next });
      if (ownerId === this.asLocalDB().currentUserId) {
        this.asLocalDB().setHasUnreadNotifications(false);
      }
      this.notifyListeners();
    }

    removeNotification(notificationId: string, ownerUserId?: string) {
      const ownerId = String(ownerUserId || this.asLocalDB().currentUserId || '').trim();
      if (!ownerId || !notificationId) return;
      const store = this.getNotificationInboxStore();
      const list = store[ownerId] ?? [];
      const next = list.filter((n) => n.id !== notificationId);
      this.saveNotificationInboxStore({ ...store, [ownerId]: next });
      this.notifyListeners();
    }

    private compactNotificationInboxForCurrentUser() {
      const meId = this.asLocalDB().currentUserId;
      if (!meId) return;
      const store = this.getNotificationInboxStore();
      const list = store[meId] ?? [];
      if (list.length === 0) return;
      const seen = new Set<string>();
      const next: AppNotification[] = [];
      const sorted = [...list].sort(
        (a, b) =>
          (b.createdAt ?? 0) - (a.createdAt ?? 0) ||
          String(b.id).localeCompare(String(a.id))
      );
      for (const n of sorted) {
        const key = notificationDedupeKey(this.normalizeNotificationRow(n));
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(this.normalizeNotificationRow(n));
      }
      if (next.length !== list.length) {
        this.saveNotificationInboxStore({ ...store, [meId]: next });
      }
    }

    private ensureDemoNotifications() {
      const meId = this.asLocalDB().currentUserId;
      if (!meId) return;
      const existing = this.asLocalDB().getNotificationsForUser(meId);
      if (existing.length > 0) return;

      const now = Date.now();
      const myPosts = (this.asLocalDB().posts ?? []).filter((p: Post) => postUserId(p) === meId);
      const firstPost = myPosts[0];
      const followers = this.asLocalDB().getFollowerIds(meId).slice(0, 3);

      type Seed = Omit<AppNotification, 'id' | 'read' | 'user'> & { createdAt: number };
      const seeds: Seed[] = [];

      followers.forEach((actorId, i) => {
        seeds.push({
          type: 'follow',
          actorUserId: actorId,
          createdAt: now - (i + 1) * 90_000,
        });
      });

      if (firstPost && followers[0]) {
        seeds.push({
          type: 'like',
          actorUserId: followers[0],
          postId: firstPost.id,
          postImage: firstPost.imageUrl || firstPost.videoUrl,
          createdAt: now - 45 * 60_000,
        });
      }

      if (followers[1] && firstPost) {
        seeds.push({
          type: 'comment',
          actorUserId: followers[1],
          postId: firstPost.id,
          postImage: firstPost.imageUrl || firstPost.videoUrl,
          text: 'This looks amazing! 🔥',
          createdAt: now - 20 * 60_000,
        });
      }

      if (followers[2] && firstPost) {
        seeds.push({
          type: 'mention',
          actorUserId: followers[2],
          postId: firstPost.id,
          postImage: firstPost.imageUrl || firstPost.videoUrl,
          text: `mentioned you: "@${this.asLocalDB().currentUser?.username ?? 'you'} check this out"`,
          createdAt: now - 12 * 60_000,
        });
      }

      seeds.push({
        type: 'order',
        title: 'Order confirmed',
        text: 'Order ord1779081254922 confirmed — $42.50',
        orderId: 'ord1779081254922',
        createdAt: now - 3 * 3600_000,
      });

      seeds.push({
        type: 'task',
        actorUserId: followers[0] ?? meId,
        taskId: 101,
        title: 'Task assigned',
        text: '"Update Marketing Assets" · Design · Due Today',
        targetTab: 'workspace',
        createdAt: now - 2 * 3600_000,
      });

      seeds.push({
        type: 'activity',
        title: 'Workspace activity',
        text: 'Sarah updated "Stripe Integration"',
        targetTab: 'workspace',
        createdAt: now - 90 * 60_000,
      });

      if (followers[1]) {
        seeds.push({
          type: 'message',
          actorUserId: followers[1],
          text: 'Shared a post with you',
          targetTab: 'messages',
          createdAt: now - 6 * 3600_000,
        });
      }

      const liveHostId = followers[0] ?? followers[1];
      if (liveHostId) {
        seeds.push({
          type: 'live',
          actorUserId: liveHostId,
          liveKind: 'audio-room',
          title: 'Live now',
          text: 'started an Audio live — tap to watch',
          targetTab: 'live',
          link: `live:${liveHostId}`,
          createdAt: now - 18 * 60_000,
        });
      }

      seeds.push({
        type: 'live',
        actorUserId: followers[2] ?? followers[1] ?? meId,
        liveKind: 'solo',
        title: 'Live viewer',
        text: 'joined your Solo live',
        targetTab: 'live',
        link: `live:${meId}`,
        createdAt: now - 8 * 60_000,
      });

      const store = this.getNotificationInboxStore();
      const rows = seeds
        .map((s) =>
          this.normalizeNotificationRow({
            ...s,
            id: `demo_${Math.random().toString(36).slice(2, 9)}`,
            read: false,
          })
        )
        .sort((a, b) => b.createdAt - a.createdAt);
      this.saveNotificationInboxStore({ ...store, [meId]: rows });
      this.asLocalDB().setHasUnreadNotifications(true);
    }
  } as unknown as MixinCtor<T, NotificationsLayer>;
}
