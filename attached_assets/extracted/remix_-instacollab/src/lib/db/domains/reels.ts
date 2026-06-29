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
        { id: '1', user: this.asLocalDB().users[1], likes: 12400, comments: 452, caption: '🎬 #reels', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', isLiked: false, isSaved: false },
        { id: '2', user: this.asLocalDB().users[2], likes: 8900, comments: 210, caption: '🔥 #editing', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', isLiked: false, isSaved: false },
        { id: 'r_u1_1', user: this.asLocalDB().users[0], likes: 2180, comments: 94, caption: 'Behind the scenes — new reel series 🎥 #reels #design', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', isLiked: false, isSaved: false },
        { id: 'r_u1_2', user: this.asLocalDB().users[0], likes: 940, comments: 31, caption: 'Quick tip: layout grids in 60s ⚡', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', isLiked: false, isSaved: false },
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
      };
      this.save('reels', this.cappedList([newReel, ...this.reels], 'reels'));
    }

    updateReel(id: string, updateFn: (reel: Reel) => Reel) {
      const updated = this.reels.map((r) => r.id === id ? updateFn(r) : r);
      this.save('reels', updated);
    }

    deleteReel(id: string) {
      const updated = this.reels.filter((r) => r.id !== id);
      this.save('reels', updated);
    }
  } as unknown as MixinCtor<T, ReelsLayer>;
}
