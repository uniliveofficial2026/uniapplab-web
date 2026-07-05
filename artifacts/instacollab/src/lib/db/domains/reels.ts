import { resolveUser } from '../../safe';
import type { Reel, User } from '../../../types';
import type { ReelsLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

export function WithReels<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, ReelsLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    get reels(): Reel[] {
      const defaultReels: Reel[] = [
        {
          id: 'demo-carousel',
          user: this.asLocalDB().users[1],
          likes: 3200,
          comments: 88,
          caption: 'Swipe for more — multi-media reel demo 📸',
          videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          isLiked: false,
          isSaved: false,
          createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
          mediaList: [
            {
              url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
              type: 'video',
              name: 'Clip 1',
            },
            {
              url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&h=1920&fit=crop',
              type: 'image',
              name: 'Still 2',
            },
            {
              url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
              type: 'video',
              name: 'Clip 3',
            },
          ],
        },
        { id: '1', user: this.asLocalDB().users[1], likes: 12400, comments: 452, caption: '🎬 #reels', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', isLiked: false, isSaved: false, createdAt: new Date(Date.now() - 6 * 3_600_000).toISOString() },
        { id: '2', user: this.asLocalDB().users[2], likes: 8900, comments: 210, caption: '🔥 #editing', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', isLiked: false, isSaved: false, createdAt: new Date(Date.now() - 12 * 3_600_000).toISOString() },
        { id: 'r_u1_1', user: this.asLocalDB().users[0], likes: 2180, comments: 94, caption: 'Behind the scenes — new reel series 🎥 #reels #design', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', isLiked: false, isSaved: false, createdAt: new Date(Date.now() - 24 * 3_600_000).toISOString() },
        { id: 'r_u1_2', user: this.asLocalDB().users[0], likes: 940, comments: 31, caption: 'Quick tip: layout grids in 60s ⚡', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', isLiked: false, isSaved: false, createdAt: new Date(Date.now() - 36 * 3_600_000).toISOString() },
      ];
      const raw = this.load<Reel[]>('reels', defaultReels) || defaultReels;
      return this.asLocalDB().filterItemsByBlockedAuthors(raw);
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
              isLiked: existing.isLiked,
              isSaved: existing.isSaved,
            }
          : {
              ...incoming,
              user: resolveUser(this.asLocalDB().users, incoming.user),
            };
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
