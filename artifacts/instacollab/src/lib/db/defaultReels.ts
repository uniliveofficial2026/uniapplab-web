import { USERS } from '../data';
import type { Reel } from '../../types';

const DISCOVERY_REEL_IDS = new Set(['demo-carousel', '1', '2', 'r_u1_1', 'r_u1_2']);

export function isDiscoveryReelId(id: string | undefined | null): boolean {
  return Boolean(id && DISCOVERY_REEL_IDS.has(id));
}

/** Read-only discovery reels — embedded authors so they work before demo users are hydrated. */
export function buildDefaultReels(): Reel[] {
  const u1 = USERS[0];
  const u2 = USERS[1];
  const u3 = USERS[2];
  if (!u1 || !u2 || !u3) return [];

  return [
    {
      id: 'demo-carousel',
      user: u2,
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
    {
      id: '1',
      user: u2,
      likes: 12400,
      comments: 452,
      caption: '🎬 #reels',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      isLiked: false,
      isSaved: false,
      createdAt: new Date(Date.now() - 6 * 3_600_000).toISOString(),
    },
    {
      id: '2',
      user: u3,
      likes: 8900,
      comments: 210,
      caption: '🔥 #editing',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      isLiked: false,
      isSaved: false,
      createdAt: new Date(Date.now() - 12 * 3_600_000).toISOString(),
    },
    {
      id: 'r_u1_1',
      user: u1,
      likes: 2180,
      comments: 94,
      caption: 'Behind the scenes — new reel series 🎥 #reels #design',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      isLiked: false,
      isSaved: false,
      createdAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    },
    {
      id: 'r_u1_2',
      user: u1,
      likes: 940,
      comments: 31,
      caption: 'Quick tip: layout grids in 60s ⚡',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      isLiked: false,
      isSaved: false,
      createdAt: new Date(Date.now() - 36 * 3_600_000).toISOString(),
    },
  ];
}
