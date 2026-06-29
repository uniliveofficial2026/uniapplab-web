import { PROFILE_VISITS_CAP, PROFILE_VISITS_KEY } from '../constants';
import {
  buildCreatorProgress,
  type CreatorActivityStats,
  type CreatorProgress,
} from '../../creatorXP';
import {
  consolidateProfilePremiumSubscriptions,
  getPackageDurationMs,
  getProfilePremiumAccessStatus,
  getPremiumSubscriptionStatus,
  normalizePremiumSubscriptions,
  userHasPremiumPackage,
  userHasProfilePremium,
} from '../../premium';
import {
  isProfilePremiumPackageId,
  isProfilePremiumTierId,
  PREMIUM_PACKAGES,
  PROFILE_PREMIUM_ENTITLEMENT_ID,
  type PremiumPackageId,
  type ProfilePremiumTierId,
} from '../../premiumPackages';
import {
  buildVisitEvent,
  emptySurfaceCounts,
  type ProfileVisitContext,
  visitContextKey,
} from '../../profileVisits';
import { postUserId, reelUserId, resolveUser } from '../../safe';
import type {
  LiveKind,
  Post,
  PremiumSubscription,
  ProfileVisitEntry,
  ProfileVisitSurface,
  ProfileVisitorRow,
  ProfileVisitorStats,
  Reel,
  User,
} from '../../../types';
import type { ProfileLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

export function WithProfile<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, ProfileLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    private getProfileVisitsStore(): Record<string, ProfileVisitEntry[]> {
      const raw = this.load<Record<string, ProfileVisitEntry[]>>(
        PROFILE_VISITS_KEY,
        {}
      );
      return raw && typeof raw === 'object' ? raw : {};
    }

    private saveProfileVisitsStore(store: Record<string, ProfileVisitEntry[]>) {
      this.save(PROFILE_VISITS_KEY, store);
    }

    private getProfileVisitList(profileUserId: string): ProfileVisitEntry[] {
      const id = String(profileUserId || '').trim();
      if (!id) return [];
      const list = this.getProfileVisitsStore()[id];
      return Array.isArray(list) ? list.filter((v) => v?.visitorUserId) : [];
    }

    /** Seed demo visitors for the default account when empty (local dev). */
    /** Whether this profile owner accepts visit tracking (owner's privacy setting). */
    profileVisitorTrackingEnabled(profileUserId: string): boolean {
      const ownerId = String(profileUserId || '').trim();
      if (!ownerId) return false;
      if (ownerId === this.asLocalDB().currentUserId) {
        return this.asLocalDB().settings.profileVisitorsEnabled !== false;
      }
      const owner = this.asLocalDB().users.find((u: User) => u?.id === ownerId);
      return owner?.profileVisitorsEnabled !== false;
    }

    /** Premium-only: browse without recording a profile visit (leave no trace). */
    viewerUsesHiddenVisit(): boolean {
      return (
        this.asLocalDB().hasProfilePremium() && this.asLocalDB().settings.hiddenProfileViews === true
      );
    }

    /** Remove this viewer from every profile's visitor list (hidden / leave-no-trace mode). */
    private scrubViewerTracesFromAllProfiles(visitorId: string): void {
      const id = String(visitorId || '').trim();
      if (!id) return;
      const store = this.getProfileVisitsStore();
      let changed = false;
      const next: Record<string, ProfileVisitEntry[]> = { ...store };
      for (const ownerId of Object.keys(next)) {
        const list = next[ownerId];
        if (!Array.isArray(list)) continue;
        const filtered = list.filter((v) => v?.visitorUserId !== id);
        if (filtered.length !== list.length) {
          next[ownerId] = filtered;
          changed = true;
        }
      }
      if (changed) {
        this.saveProfileVisitsStore(next);
        this.notifyListeners();
      }
    }

    /** Leave no trace toggle requires active Profile Premium. */
    canUseHiddenVisitorMode(): boolean {
      return this.asLocalDB().hasProfilePremium();
    }

    hasPurchasedPremium(packageId: PremiumPackageId): boolean {
      this.enforcePremiumExpiryForCurrentUser();
      return userHasPremiumPackage(this.asLocalDB().currentUser, packageId);
    }

    getPremiumSubscriptionStatus(packageId: PremiumPackageId) {
      this.enforcePremiumExpiryForCurrentUser();
      return getPremiumSubscriptionStatus(this.asLocalDB().currentUser, packageId);
    }

    getProfilePremiumAccessStatus(now = Date.now()) {
      this.enforcePremiumExpiryForCurrentUser();
      return getProfilePremiumAccessStatus(this.asLocalDB().currentUser, now);
    }


    userHasProfilePremium(userId?: string): boolean {
      const id = String(userId || this.asLocalDB().currentUserId || '').trim();
      if (!id) return false;
      if (id === this.asLocalDB().currentUserId) {
        this.enforcePremiumExpiryForCurrentUser();
      }
      const user = this.asLocalDB().users.find((u: User) => u?.id === id);
      return userHasProfilePremium(user);
    }

    hasProfilePremium(): boolean {
      this.enforcePremiumExpiryForCurrentUser();
      return userHasProfilePremium(this.asLocalDB().currentUser);
    }

    /** Drop expired subscriptions; disable leave-no-trace when premium lapses. */
    private enforcePremiumExpiryForCurrentUser(): void {
      const meId = this.asLocalDB().currentUserId;
      if (!meId) return;
      const me = this.asLocalDB().users.find((u: User) => u?.id === meId);
      if (!me) return;

      const now = Date.now();
      const subs = normalizePremiumSubscriptions(me, now);
      const consolidated = consolidateProfilePremiumSubscriptions(subs, now);
      const active = consolidated.filter((s) => s.expiresAt > now);
      const hadActive = userHasProfilePremium(me, now);
      const hasActive = active.some(
        (s) => s.packageId === PROFILE_PREMIUM_ENTITLEMENT_ID
      );

      const stored = me.premiumSubscriptions;
      const legacy = me.purchasedPremiumPackages;
      const activeSerialized = JSON.stringify(active);
      const storedSerialized = JSON.stringify(
        Array.isArray(stored) ? stored.filter((s) => s.expiresAt > now) : []
      );
      const needsPersist =
        activeSerialized !== storedSerialized ||
        (Array.isArray(legacy) && legacy.length > 0) ||
        (!hasActive && hadActive);

      if (!needsPersist) return;

      this.asLocalDB().updateUser(meId, (u) => {
        const next: Partial<User> = {
          premiumSubscriptions: active,
          purchasedPremiumPackages: undefined,
        };
        return { ...u, ...next };
      });

      if (hadActive && !hasActive && this.asLocalDB().settings.hiddenProfileViews) {
        this.asLocalDB().updateSettings({ hiddenProfileViews: false });
      }
    }

    /** Purchase or extend a profile premium tier (local wallet simulation). */
    purchasePremiumPackage(packageId: PremiumPackageId): {
      ok: boolean;
      reason?: string;
      extended?: boolean;
      expiresAt?: number;
      tierId?: ProfilePremiumTierId;
    } {
      if (!isProfilePremiumTierId(packageId)) {
        return { ok: false, reason: 'Unknown package' };
      }
      const pkg = PREMIUM_PACKAGES[packageId];

      const meId = this.asLocalDB().currentUserId;
      const now = Date.now();
      const durationMs = getPackageDurationMs(packageId);
      let expiresAt = now + durationMs;
      let extended = false;

      this.asLocalDB().updateUser(meId, (u) => {
        const subs = normalizePremiumSubscriptions(u, now);
        const premiumRows = subs.filter((s) =>
          isProfilePremiumPackageId(s.packageId)
        );
        const prevExpiry = premiumRows.reduce(
          (max, s) => Math.max(max, s.expiresAt),
          0
        );
        extended = prevExpiry > now;
        const base = Math.max(now, prevExpiry);
        expiresAt = base + durationMs;

        const other = subs.filter(
          (s) => !isProfilePremiumPackageId(s.packageId)
        );
        const merged: PremiumSubscription = {
          packageId: PROFILE_PREMIUM_ENTITLEMENT_ID,
          purchasedAt: now,
          expiresAt,
          lastTierId: packageId,
        };
        const nextSubs = consolidateProfilePremiumSubscriptions(
          [...other, merged],
          now
        ).filter((s) => s.expiresAt > now);

        const { purchasedPremiumPackages: _legacy, ...rest } = u;
        return {
          ...rest,
          premiumSubscriptions: nextSubs,
          purchasedPremiumPackages: undefined,
        };
      });

      this.notifyListeners();
      const orderId = `ord${Date.now()}`;
      this.asLocalDB().pushNotificationForUser(meId, {
        type: 'order',
        title: 'Order confirmed',
        text: `Order ${orderId} confirmed — $${pkg.price.toFixed(2)}`,
        orderId,
      });

      return { ok: true, extended, expiresAt, tierId: packageId };
    }

    /** Drop legacy hidden rows; leave no trace now skips recording entirely. */
    private purgeHiddenProfileVisitEntries() {
      const store = this.getProfileVisitsStore();
      let changed = false;
      const next: Record<string, ProfileVisitEntry[]> = {};
      for (const ownerId of Object.keys(store)) {
        const list = store[ownerId];
        if (!Array.isArray(list)) continue;
        const filtered = list.filter((v) => v?.visitorUserId && !v.isHidden);
        if (filtered.length !== list.length) changed = true;
        if (filtered.length > 0) next[ownerId] = filtered;
      }
      if (changed) this.saveProfileVisitsStore(next);
    }

    private ownerContentPreview(
      ownerId: string,
      surface: ProfileVisitSurface,
      index: number
    ): { contentId?: string; previewUrl?: string } {
      if (surface === 'posts') {
        const posts = (this.asLocalDB().posts ?? []).filter(
          (p: Post) => p?.user?.id === ownerId && !p.isArchived
        );
        const post = posts[index % Math.max(posts.length, 1)];
        if (!post) return {};
        return {
          contentId: post.id,
          previewUrl: post.imageUrl || post.videoUrl,
        };
      }
      if (surface === 'reels') {
        const reels = (this.asLocalDB().reels ?? []).filter(
          (r: Reel) => r?.user?.id === ownerId
        );
        const reel = reels[index % Math.max(reels.length, 1)];
        if (!reel) return {};
        return { contentId: reel.id, previewUrl: reel.videoUrl };
      }
      return {};
    }

    private resolveVisitPreviewUrl(
      ownerId: string,
      entry: ProfileVisitEntry
    ): string | undefined {
      if (entry.lastPreviewUrl) return entry.lastPreviewUrl;
      const surface = entry.lastSurface;
      const contentId = entry.lastContentId;
      if (!contentId) return undefined;
      if (surface === 'posts') {
        const post = (this.asLocalDB().posts ?? []).find((p: Post) => p.id === contentId);
        if (post?.user?.id === ownerId) return post.imageUrl || post.videoUrl;
      }
      if (surface === 'reels') {
        const reel = (this.asLocalDB().reels ?? []).find((r: Reel) => r.id === contentId);
        if (reel?.user?.id === ownerId) return reel.videoUrl;
      }
      return undefined;
    }

    /** Add surface + preview to demo rows created before visit-context tracking. */
    private backfillProfileVisitorSurfaces() {
      const ownerId = this.asLocalDB().currentUserId;
      if (!ownerId) return;
      const list = this.getProfileVisitList(ownerId);
      if (list.length === 0 || list.some((e) => e.lastSurface)) return;

      const surfaces: ProfileVisitSurface[] = [
        'profile',
        'posts',
        'reels',
        'story',
        'live',
      ];
      const liveKinds: LiveKind[] = ['solo', 'audio-room', 'pk', 'commerce'];
      const next = list.map((entry, i) => {
        const surface = surfaces[i % surfaces.length];
        const content =
          surface === 'posts' || surface === 'reels'
            ? this.ownerContentPreview(ownerId, surface, i)
            : {};
        const liveKind =
          surface === 'live' ? liveKinds[i % liveKinds.length] : undefined;
        return {
          ...entry,
          lastSurface: surface,
          lastContentId: content.contentId,
          lastPreviewUrl: content.previewUrl,
          lastLiveKind: liveKind,
          recentEvents: [
            buildVisitEvent(entry.lastVisitedAt, {
              surface,
              ...content,
              liveKind,
            }),
          ],
        };
      });
      const store = this.getProfileVisitsStore();
      this.saveProfileVisitsStore({ ...store, [ownerId]: next });
    }

    private ensureDemoProfileVisitors() {
      const ownerId = this.asLocalDB().currentUserId;
      if (!ownerId || !this.profileVisitorTrackingEnabled(ownerId)) return;
      if (this.getProfileVisitList(ownerId).length > 0) return;

      const demoVisitorIds = this.asLocalDB().getFollowerIds(ownerId).slice(0, 8);
      if (demoVisitorIds.length === 0) return;

      const surfaces: ProfileVisitSurface[] = [
        'profile',
        'posts',
        'reels',
        'story',
        'live',
      ];
      const liveKinds: LiveKind[] = ['solo', 'audio-room', 'pk', 'commerce'];
      const now = Date.now();
      const entries: ProfileVisitEntry[] = demoVisitorIds.map((visitorUserId, i) => {
        const surface = surfaces[i % surfaces.length];
        const at = now - (i + 1) * 45 * 60 * 1000;
        const content =
          surface === 'posts' || surface === 'reels'
            ? this.ownerContentPreview(ownerId, surface, i)
            : {};
        const liveKind =
          surface === 'live' ? liveKinds[i % liveKinds.length] : undefined;
        const event = buildVisitEvent(at, {
          surface,
          ...content,
          liveKind,
        });
        return {
          visitorUserId,
          lastVisitedAt: at,
          visitCount: 1 + (i % 3),
          lastSurface: surface,
          lastContentId: content.contentId,
          lastPreviewUrl: content.previewUrl,
          lastLiveKind: liveKind,
          recentEvents: [event],
        };
      });

      const store = this.getProfileVisitsStore();
      this.saveProfileVisitsStore({ ...store, [ownerId]: entries });
    }

    /**
     * Record that the logged-in viewer opened someone's profile or a section on it.
     * Skips self, blocked users, and duplicate rapid revisits to the same place.
     */
    recordProfileVisit(
      profileUserId: string,
      context?: ProfileVisitContext
    ): boolean {
      const ownerId = String(profileUserId || '').trim();
      const visitorId = this.asLocalDB().currentUserId;
      if (!ownerId || !visitorId || ownerId === visitorId) return false;
      if (!this.profileVisitorTrackingEnabled(ownerId)) return false;
      if (this.viewerUsesHiddenVisit()) return false;
      if (this.asLocalDB().isUserBlocked(ownerId) || this.asLocalDB().isUserBlocked(visitorId)) return false;

      const ctx: ProfileVisitContext = {
        surface: context?.surface ?? 'profile',
        contentId: context?.contentId,
        previewUrl: context?.previewUrl,
        liveKind: context?.liveKind,
      };

      const store = this.getProfileVisitsStore();
      const list = [...this.getProfileVisitList(ownerId)];
      const now = Date.now();
      const idx = list.findIndex((v) => v.visitorUserId === visitorId);
      const prev = idx >= 0 ? list[idx] : undefined;
      const prevCtx: ProfileVisitContext = {
        surface: prev?.lastSurface ?? 'profile',
        contentId: prev?.lastContentId,
        liveKind: prev?.lastLiveKind,
      };

      if (
        prev &&
        now - prev.lastVisitedAt < 60_000 &&
        visitContextKey(prevCtx) === visitContextKey(ctx)
      ) {
        return false;
      }

      const incrementCount = !prev || now - prev.lastVisitedAt >= 60_000;
      const event = buildVisitEvent(now, ctx);
      const recentEvents = [...(prev?.recentEvents ?? []), event].slice(-8);

      const nextEntry: ProfileVisitEntry = {
        visitorUserId: visitorId,
        lastVisitedAt: now,
        visitCount: incrementCount
          ? (prev?.visitCount || 0) + 1
          : prev?.visitCount || 1,
        lastSurface: ctx.surface,
        lastContentId: ctx.contentId,
        lastPreviewUrl: ctx.previewUrl,
        lastLiveKind: ctx.liveKind,
        recentEvents,
        isHidden: false,
      };

      if (idx >= 0) {
        list[idx] = nextEntry;
      } else {
        list.push(nextEntry);
      }

      list.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
      const capped = list.slice(0, PROFILE_VISITS_CAP);
      this.saveProfileVisitsStore({ ...store, [ownerId]: capped });
      if (ctx.surface === 'live') {
        this.asLocalDB().notifyLiveJoined(ownerId, visitorId, ctx.liveKind);
      }
      this.notifyListeners();
      return true;
    }

    getProfileVisitorStats(profileUserId: string): ProfileVisitorStats {
      const ownerId = String(profileUserId || '').trim();
      const empty = {
        visibleCount: 0,
        hiddenCount: 0,
        totalCount: 0,
        canSeeHidden: false,
        surfaceCounts: emptySurfaceCounts(),
      };
      if (!ownerId || !this.profileVisitorTrackingEnabled(profileUserId)) {
        return empty;
      }

      const entries = this.getProfileVisitList(ownerId).filter(
        (e) => e?.visitorUserId && !this.asLocalDB().isUserBlocked(e.visitorUserId)
      );
      const visible = entries.filter((e) => !e.isHidden);
      const surfaceCounts = emptySurfaceCounts();
      for (const entry of visible) {
        const surface = (entry.lastSurface ?? 'profile') as ProfileVisitSurface;
        surfaceCounts[surface] = (surfaceCounts[surface] ?? 0) + 1;
      }

      return {
        visibleCount: visible.length,
        hiddenCount: 0,
        totalCount: visible.length,
        canSeeHidden: false,
        surfaceCounts,
      };
    }

    /** Unique visitors shown in badge (excludes leave-no-trace / legacy hidden rows). */
    getProfileVisitorCount(profileUserId: string): number {
      return this.getProfileVisitorStats(profileUserId).visibleCount;
    }

    /** Visitors with resolved user rows, newest first. Excludes blocked accounts. */
    getProfileVisitors(profileUserId: string): ProfileVisitorRow[] {
      const ownerId = String(profileUserId || '').trim();
      if (!ownerId || !this.profileVisitorTrackingEnabled(profileUserId)) return [];

      const entries = this.getProfileVisitList(ownerId)
        .filter((entry) => !entry.isHidden)
        .sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);

      const rows: ProfileVisitorRow[] = [];
      for (const entry of entries) {
        const user = this.asLocalDB().users.find((u: User) => u?.id === entry.visitorUserId);
        if (!user || this.asLocalDB().isUserBlocked(user.id)) continue;
        const previewUrl = this.resolveVisitPreviewUrl(ownerId, entry);
        rows.push({
          ...entry,
          lastPreviewUrl: previewUrl ?? entry.lastPreviewUrl,
          user: resolveUser(this.asLocalDB().users, user),
        });
      }
      return rows;
    }

    /** Who is visiting — followers, mutuals, verified (for insights banner). */
    getProfileVisitorAudienceSummary(profileUserId: string) {
      const ownerId = String(profileUserId || '').trim();
      const visitors = this.getProfileVisitors(profileUserId).map((r) => r.user);
      const followingIds = new Set(
        ownerId ? this.asLocalDB().getFollowingIds(ownerId) : []
      );
      let followingYou = 0;
      let youFollowThem = 0;
      let mutual = 0;
      let verified = 0;
      for (const user of visitors) {
        const theyFollowYou = !!user.isFollowing;
        const youFollow = followingIds.has(user.id);
        if (theyFollowYou) followingYou += 1;
        if (youFollow) youFollowThem += 1;
        if (theyFollowYou && youFollow) mutual += 1;
        if (user.isVerified) verified += 1;
      }
      return {
        followingYou,
        youFollowThem,
        mutual,
        verified,
        notFollowingYou: Math.max(0, visitors.length - followingYou),
        total: visitors.length,
      };
    }

    /** Live creator level + XP from posts, reels, likes, followers, stories, visits. */
    getCreatorProgress(profileUserId: string): CreatorProgress {
      const userId = String(profileUserId || '').trim();
      const user = this.asLocalDB().users.find((u: User) => u?.id === userId);
      const posts = this.asLocalDB().posts ?? [];
      const reels = this.asLocalDB().reels ?? [];

      let likesReceived = 0;
      let postCount = 0;
      for (const raw of posts) {
        if (postUserId(raw) !== userId || raw?.isArchived) continue;
        postCount += 1;
        likesReceived += Math.max(0, Number(raw.likes) || 0);
      }

      let reelCount = 0;
      for (const raw of reels) {
        if (reelUserId(raw) !== userId) continue;
        reelCount += 1;
        likesReceived += Math.max(0, Number(raw.likes) || 0);
      }

      const storySegmentCount = this.asLocalDB().getUserStorySegments(userId).length;
      const profileVisitCount = this.profileVisitorTrackingEnabled(userId)
        ? this.getProfileVisitorStats(userId).visibleCount
        : 0;

      const stats: CreatorActivityStats = {
        postCount,
        reelCount,
        likesReceived,
        followers: Math.max(0, Number(user?.followers) || 0),
        storySegmentCount,
        profileVisitCount,
        hasActivePremium: this.userHasProfilePremium(userId),
      };

      return buildCreatorProgress(stats);
    }

    /** Remove a visitor entry from the owner's history (e.g. dismiss). */
    removeProfileVisitor(profileUserId: string, visitorUserId: string): boolean {
      const meId = this.asLocalDB().currentUserId;
      const ownerId = String(profileUserId || '').trim();
      const visitorId = String(visitorUserId || '').trim();
      if (!ownerId || ownerId !== meId || !visitorId) return false;

      const store = this.getProfileVisitsStore();
      const list = this.getProfileVisitList(ownerId);
      const next = list.filter((v) => v.visitorUserId !== visitorId);
      if (next.length === list.length) return false;

      this.saveProfileVisitsStore({ ...store, [ownerId]: next });
      this.notifyListeners();
      return true;
    }

  } as unknown as MixinCtor<T, ProfileLayer>;
}
