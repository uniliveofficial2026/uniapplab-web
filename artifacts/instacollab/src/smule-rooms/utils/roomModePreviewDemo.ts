import type { PartySeatMap } from './roomSeats';

export const PREVIEW_ROOM = {
  title: 'Friday Night Vibes',
  announcement: 'Welcome — grab a seat and say hi!',
  displayId: '88294102',
  level: 12,
  viewers: 128,
  expToday: 240,
  expCap: 500,
  giftStars: 12_450,
};

export const PREVIEW_AVATARS = {
  host: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&h=120&fit=crop&crop=faces',
  coowner: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=faces',
  admin: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=faces',
  guest1: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop&crop=faces',
  guest2: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop&crop=faces',
  guest3: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=faces',
  viewer1: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces',
  viewer2: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=faces',
  viewer3: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=faces',
  soloVideo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=700&fit=crop&crop=faces',
  watchThumb: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=640&h=360&fit=crop',
} as const;

export const PREVIEW_CHAT_MESSAGES = [
  {
    user: '@100141358728',
    avatar: PREVIEW_AVATARS.admin,
    text: 'hello guys',
  },
  {
    user: 'Melodia',
    avatar: PREVIEW_AVATARS.guest1,
    text: 'this room is fire 🔥',
  },
] as const;

export function buildPreviewPartySeats(includeAdmin: boolean): PartySeatMap {
  const seats: PartySeatMap = {
    host: {
      name: 'DJ Nova',
      avatar: PREVIEW_AVATARS.host,
      stars: 2840,
      isSpeaking: true,
      frameStyle: 'cyan',
    },
    coowner: null,
    admin: includeAdmin
      ? {
          name: 'Boss',
          avatar: PREVIEW_AVATARS.admin,
          stars: 920,
          isSpeaking: false,
          frameStyle: 'violet',
        }
      : null,
    no1: {
      name: 'Melodia',
      avatar: PREVIEW_AVATARS.guest1,
      stars: 1059,
      isSpeaking: true,
      frameStyle: 'pink',
    },
    no2: {
      name: 'Chou',
      avatar: PREVIEW_AVATARS.guest2,
      stars: 330,
      isSpeaking: false,
      frameStyle: 'default',
    },
    no3: null,
    no4: null,
    no5: {
      name: 'Soul',
      avatar: PREVIEW_AVATARS.guest3,
      stars: 21,
      isSpeaking: false,
      frameStyle: 'default',
    },
    no6: null,
    no7: null,
    no8: null,
    no9: null,
    no10: null,
    no11: null,
    no12: null,
  };
  return seats;
}

export const ROOM_MODE_PREVIEW_SLUG: Record<string, string> = {
  Chat: 'chat',
  Party: 'party',
  Karaoke: 'karaoke',
  Radio: 'radio',
  'Game-Live': 'game-live',
  'Multi-Guest': 'multi-guest',
  'Solo-Live': 'solo-live',
  'Commerce-Live': 'commerce-live',
};

export function roomModePreviewImageUrl(mode: string): string {
  const slug = ROOM_MODE_PREVIEW_SLUG[mode] ?? 'chat';
  return `/room-mode-previews/${slug}.webp`;
}

export const PK_PARTY_PREVIEW_IMAGE = roomModePreviewImageUrl('Party');
