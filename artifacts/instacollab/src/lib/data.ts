import { LiveKind, Post, Story, User } from '../types';

export const currentUser: User = {
  id: 'u1',
  username: 'designer_dude',
  displayName: 'Dan Designer',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop',
  followers: 1243,
  following: 342,
  bio: 'Pixel pusher. Coffee drinker. Always creating. ✨',
  storageTier: 'Unlimited',
  note: 'Needs coffee ☕',
  noteUpdatedAt: Date.now() - 45 * 60_000,
};

export const USERS: User[] = [
  currentUser,
  { id: 'u2', username: 'creative_sarah', displayName: 'Sarah Jenkins', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop', isVerified: true, status: 'story', note: 'Working on new designs', noteUpdatedAt: Date.now() - 2 * 3_600_000 },
  {
    id: 'u3',
    username: 'tech_tom',
    displayName: 'Tom Hanks',
    avatarUrl:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop',
    status: 'live',
    liveKind: 'solo',
  },
  {
    id: 'u4',
    username: 'photo_phil',
    displayName: 'Phil Weston',
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    status: 'story',
  },
  {
    id: 'u5',
    username: 'wanderlust_lucy',
    displayName: 'Lucy Jane',
    avatarUrl:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
    status: 'story',
  },
  {
    id: 'u6',
    username: 'foodie_frank',
    displayName: 'Frank Eats',
    avatarUrl:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&h=150&fit=crop',
    status: 'live',
    liveKind: 'audio-room',
  },
  {
    id: 'u7',
    username: 'code_ninja',
    displayName: 'Ninja Coder',
    avatarUrl:
      'https://images.unsplash.com/photo-1539571696357-5a69c17a6dc6?w=150&h=150&fit=crop',
    isVerified: true,
    status: 'live',
    liveKind: 'video-multi',
  },
  {
    id: 'u8',
    username: 'battle_ace',
    displayName: 'Ace PK',
    avatarUrl:
      'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop',
    status: 'live',
    liveKind: 'pk',
  },
  {
    id: 'u9',
    username: 'shop_stella',
    displayName: 'Stella Shop',
    avatarUrl:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop',
    status: 'live',
    liveKind: 'commerce',
  },
  {
    id: 'u10',
    username: 'game_gus',
    displayName: 'Gus Plays',
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop',
    status: 'live',
    liveKind: 'game',
  },
];

export const STORIES: Story[] = USERS.map((user, i) => ({
  id: `s${i}`,
  user,
  hasViewed: i > 2,
}));

/** Demo story segments for feed/profile rings (synced via db.applyDemoStoryStrip). */
export type DemoStorySegment = { url: string; isVideo: boolean };

const demoStoryImg = (sig: string) =>
  `https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&fit=crop&sig=${sig}`;

export const DEMO_STORY_SEGMENTS: Record<string, DemoStorySegment[]> = {
  u1: [
    { url: demoStoryImg('u1-1'), isVideo: false },
    { url: demoStoryImg('u1-2'), isVideo: false },
  ],
  u2: [
    { url: demoStoryImg('u2-1'), isVideo: false },
    { url: demoStoryImg('u2-2'), isVideo: false },
    { url: demoStoryImg('u2-3'), isVideo: false },
  ],
  u3: [
    { url: demoStoryImg('u3-1'), isVideo: false },
    { url: demoStoryImg('u3-2'), isVideo: true },
  ],
  u4: [
    { url: demoStoryImg('u4-1'), isVideo: false },
    { url: demoStoryImg('u4-2'), isVideo: false },
  ],
  u5: [{ url: demoStoryImg('u5-1'), isVideo: false }],
  u6: [
    { url: demoStoryImg('u6-1'), isVideo: false },
    { url: demoStoryImg('u6-2'), isVideo: false },
    { url: demoStoryImg('u6-3'), isVideo: true },
  ],
};

/** Ensures feed strip shows LIVE vs story ring styles for demo users. */
export const DEMO_USER_STATUS_PATCHES: Record<string, User['status']> = {
  u2: 'story',
  u3: 'live',
  u4: 'story',
  u5: 'story',
  u6: 'live',
  u7: 'live',
  u8: 'live',
  u9: 'live',
  u10: 'live',
};

/** Live ring colors per user (see `LiveKind` in types). */
export const DEMO_LIVE_KIND_PATCHES: Record<string, LiveKind> = {
  u3: 'solo',
  u6: 'audio-room',
  u7: 'video-multi',
  u8: 'pk',
  u9: 'commerce',
  u10: 'game',
};

export const POSTS: Post[] = [
  {
    id: 'pr1',
    user: USERS[2],
    imageUrl: '', // No main image because it's just a repost
    caption: 'This is so true! I remember being there.',
    likes: 54,
    comments: 4,
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    isLiked: false,
    isSaved: false,
    repost: {
      id: 'p1',
      user: USERS[0],
      imageUrl: '',
      caption: 'Lost in the mountains today. The air up here is just different. ⛰️✨ #nature #mountains #explore',
      location: 'Swiss Alps, Switzerland',
      likes: 1245,
      comments: 84,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      isLiked: false,
      isSaved: false,
    },
  },
  {
    id: 'p1',
    user: USERS[0],
    imageUrl: 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=2940&auto=format&fit=crop',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    mediaList: [
      {
        url: 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=2940&auto=format&fit=crop',
        type: 'image',
        name: 'mountains.jpg',
      },
      {
        url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        type: 'video',
        name: 'ElephantsDream.mp4',
      },
      {
        url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2940&auto=format&fit=crop',
        type: 'image',
        name: 'summit.jpg',
      },
    ],
    caption: 'Lost in the mountains today. The air up here is just different. ⛰️✨ #nature #mountains #explore',
    location: 'Swiss Alps, Switzerland',
    likes: 1245,
    comments: 84,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isLiked: false,
    isSaved: false,
  },
  {
    id: 'p2',
    user: USERS[1],
    imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=2944&auto=format&fit=crop',
    caption: 'Late night coding sessions. Fuelled by espresso and ambition. 💻☕ #developer #coding #setup #desksetup',
    likes: 892,
    comments: 42,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    isLiked: true,
    isSaved: true,
  },
  {
    id: 'p3',
    user: USERS[3],
    imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2940&auto=format&fit=crop',
    caption: 'Gym time! No excuses. 💪 #fitness #workout #gym',
    likes: 345,
    comments: 12,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    isLiked: false,
    isSaved: false,
  },
  {
    id: 'p4',
    user: USERS[4],
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=2600&auto=format&fit=crop',
    caption: 'Best brunch spot in town! The avocado toast is to die for. 🥑 #foodie #brunch #weekend',
    location: 'Brooklyn, New York',
    likes: 2130,
    comments: 156,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    isLiked: true,
    isSaved: false,
  },
  {
    id: 'p5',
    user: USERS[1],
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=2832&auto=format&fit=crop',
    caption: 'Collab day with @designer_dude — thanks for the color grade! 🎨 #design #collab',
    likes: 640,
    comments: 28,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isLiked: false,
    isSaved: false,
    taggedUserIds: ['u1'],
  },
  {
    id: 'p6',
    user: USERS[2],
    imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=2940&auto=format&fit=crop',
    caption: 'Workshop recap — shoutout @designer_dude for leading the session.',
    likes: 412,
    comments: 19,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    isLiked: false,
    isSaved: false,
    taggedUserIds: ['u1'],
  },
];

/** Who each user follows (canonical social graph for follower/following lists). */
export const DEFAULT_FOLLOW_GRAPH: { following: Record<string, string[]> } = {
  following: {
    u1: ['u2', 'u3', 'u4', 'u5', 'u6', 'u7'],
    u2: ['u1', 'u3', 'u5'],
    u3: ['u1', 'u4'],
    u4: ['u1', 'u2'],
    u5: ['u1', 'u6'],
    u6: ['u1', 'u2', 'u7'],
    u7: ['u1', 'u3'],
  },
};

