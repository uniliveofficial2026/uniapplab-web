import { resolveUser } from '../../safe';
import type { Reel, User } from '../../../types';
import type { ReelsLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';
import { buildDefaultReels, isDiscoveryReelId } from '../defaultReels';

function resolveReelsList(
  db: {
    load<T>(key: string, defaultData: T): T;
    asLocalDB(): {
      filterItemsByBlockedAuthors<T extends { user?: { id?: string } }>(items: T[]): T[];
      users: User[];
    };
  },
): Reel[] {
  const defaultReels = buildDefaultReels();
  const cached = db.load<Reel[]>('reels', defaultReels);
  const raw =
    Array.isArray(cached) && cached.length > 0
      ? cached
      : defaultReels.length > 0
        ? defaultReels
        : [];

  const resolved = raw.map((reel) => ({
    ...reel,
    user: resolveUser(db.asLocalDB().users, reel.user),
  }));

  // Discovery/demo reels always show — block lists must not blank the Reels tab.
  const discovery = resolved.filter((reel) => isDiscoveryReelId(reel.id));
  const social = db.asLocalDB().filterItemsByBlockedAuthors(
    resolved.filter((reel) => !isDiscoveryReelId(reel.id)),
  );

  const merged = [...discovery, ...social];
  merged.sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  );
  return merged;
}

export function WithReels<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, ReelsLayer> {
  return class extends Base {
    private ensuringReels = false;

    constructor(...args: any[]) {
      super(...args);
    }

    get reels(): Reel[] {
      let list = resolveReelsList(this as unknown as Parameters<typeof resolveReelsList>[0]);
      if (list.length === 0 && !this.ensuringReels) {
        this.ensuringReels = true;
        try {
          this.seedDemoReelsIfNeeded({ force: true });
          list = resolveReelsList(this as unknown as Parameters<typeof resolveReelsList>[0]);
        } finally {
          this.ensuringReels = false;
        }
      }
      return list;
    }

    seedDemoReelsIfNeeded(opts?: { force?: boolean }) {
      const cached = this.load<Reel[]>('reels', []);
      if (!opts?.force && Array.isArray(cached) && cached.length > 0) {
        this.save('demo_reels_seeded', true);
        return;
      }

      const defaults = buildDefaultReels();
      if (!defaults.length) return;

      this.asLocalDB().cacheDiscoveredUsers(
        defaults.map((reel) => reel.user).filter(Boolean) as User[],
      );
      this.save('reels', defaults);
      this.save('demo_reels_seeded', true);
    }

    addReel(reel: Partial<Reel> & { user?: User }) {
      const author = resolveUser(this.asLocalDB().users, reel.user, this.asLocalDB().currentUser);
      const newReel = {
        ...reel,
        user: author,
        id: reel.id || `r_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        createdAt: reel.createdAt ?? new Date().toISOString(),
      };
      this.save('reels', this.cappedList([newReel, ...this.reels], 'reels'));
      void import('../../cloudSocial/cloudSocialContent').then((m) =>
        m.scheduleCloudReelPublish(newReel as Reel),
      );
      void import('../../liveCloudSurfaces').then((m) =>
        m.refreshLiveCloudSurface('reels', { force: true }),
      );
    }

    mergeInboundReels(inbound: Reel[]) {
      if (!Array.isArray(inbound) || inbound.length === 0) return;
      const byId = new Map(this.reels.map((r) => [r.id, r]));
      let changed = false;
      for (const incoming of inbound) {
        if (!incoming?.id || !incoming.user?.id) continue;
        const existing = byId.get(incoming.id);
        const merged = existing
          ? {
              ...existing,
              ...incoming,
              user: resolveUser(this.asLocalDB().users, incoming.user),
              videoUrl: incoming.videoUrl?.trim() ? incoming.videoUrl : existing.videoUrl,
              imageUrl: incoming.imageUrl?.trim() ? incoming.imageUrl : existing.imageUrl,
              mediaList:
                Array.isArray(incoming.mediaList) && incoming.mediaList.length > 0
                  ? incoming.mediaList
                  : existing.mediaList,
              caption: incoming.caption?.trim() ? incoming.caption : existing.caption,
              isLiked: existing.isLiked,
              isSaved: existing.isSaved,
            }
          : {
              ...incoming,
              user: resolveUser(this.asLocalDB().users, incoming.user),
            };
        if (!existing && !merged.videoUrl?.trim() && !(Array.isArray(merged.mediaList) && merged.mediaList.length)) {
          continue;
        }
        if (!existing || JSON.stringify(existing) !== JSON.stringify(merged)) {
          byId.set(incoming.id, merged);
          changed = true;
        }
      }
      if (!changed) return;
      const mergedList = Array.from(byId.values()).sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      );
      this.save('reels', this.cappedList(mergedList, 'reels'));
      this.asLocalDB().cacheDiscoveredUsers(inbound.map((r) => r.user).filter(Boolean) as User[]);
    }

    applyInboundReelEngagement(
      reelId: string,
      engagement: { likes: number; isLiked: boolean; isSaved: boolean },
    ) {
      const existing = this.reels.find((r) => r.id === reelId);
      if (!existing) return;
      if (
        existing.likes === engagement.likes &&
        existing.isLiked === engagement.isLiked &&
        existing.isSaved === engagement.isSaved
      ) {
        return;
      }
      const updated = this.reels.map((r) =>
        r.id === reelId
          ? {
              ...r,
              likes: engagement.likes,
              isLiked: engagement.isLiked,
              isSaved: engagement.isSaved,
            }
          : r,
      );
      this.save('reels', updated);
    }

    updateReel(id: string, updateFn: (reel: Reel) => Reel) {
      const before = this.reels.find((r) => r.id === id);
      const updated = this.reels.map((r) => (r.id === id ? updateFn(r) : r));
      this.save('reels', updated);
      const after = updated.find((r) => r.id === id);
      if (
        before &&
        after &&
        after.user?.id === this.asLocalDB().currentUserId &&
        (before.caption !== after.caption ||
          before.videoUrl !== after.videoUrl ||
          JSON.stringify(before.mediaList) !== JSON.stringify(after.mediaList))
      ) {
        void import('../../cloudSocial/cloudSocialContent').then((m) =>
          m.scheduleCloudReelPublish(after),
        );
      }
    }

    deleteReel(id: string) {
      const existing = this.reels.find((r) => r.id === id);
      const updated = this.reels.filter((r) => r.id !== id);
      this.save('reels', updated);
      if (existing?.user?.id === this.asLocalDB().currentUserId) {
        void import('../../cloudSocial/cloudSocialContent').then((m) =>
          m.scheduleCloudReelDelete(id),
        );
      }
    }
  } as unknown as MixinCtor<T, ReelsLayer>;
}
