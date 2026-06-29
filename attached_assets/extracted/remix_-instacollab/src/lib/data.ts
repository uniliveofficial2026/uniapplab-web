import { Post, Story, User } from '../types';

export const currentUser: User = {
  id: 'u1',
  username: 'designer_dude',
  displayName: 'Dan Designer',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop',
  followers: 1243,
  following: 342,
  bio: 'Pixel pusher. Coffee drinker. Always creating. ✨',
  storageTier: 'Unlimited',
  note: 'Needs coffee ☕'
};

export const USERS: User[] = [
  currentUser,
  { id: 'u2', username: 'creative_sarah', displayName: 'Sarah Jenkins', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop', isVerified: true, status: 'story', note: 'Working on new designs' },
  { id: 'u3', username: 'tech_tom', displayName: 'Tom Hanks', avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop', status: 'live' },
  { id: 'u4', username: 'photo_phil', displayName: 'Phil Weston', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop', status: 'story' },
  { id: 'u5', username: 'wanderlust_lucy', displayName: 'Lucy Jane', avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop' },
  { id: 'u6', username: 'foodie_frank', displayName: 'Frank Eats', avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&h=150&fit=crop', status: 'live' },
  { id: 'u7', username: 'code_ninja', displayName: 'Ninja Coder', avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a6dc6?w=150&h=150&fit=crop', isVerified: true },
];

export let STORIES: Story[] = USERS.map((user, i) => ({
  id: `s${i}`,
  user,
  hasViewed: i > 2,
}));

export let POSTS: Post[] = [
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
        imageUrl: 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=2940&auto=format&fit=crop',
        caption: 'အသက်ရှည်စွာကျန်းကျန်းမာမာနေပေးပါဖေဖေနဲ့ မေမေ #Family #Zego',
        textOverlay: 'ဘဝမှာ...\nအဖေဘာလိုချင်လဲ အမေဘာလိုချင်လဲ မေးပြီး...\nလိုတာလောက် ဖြည့်ဆည်းပေးနိုင်တဲ့ အထိတော့\nပြည့်ဆုံချင်ပါသေးတယ် ။',
        textOverlaySize: 18,
        textOverlayPos: 65,
        likes: 1245,
        comments: 84,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        isLiked: false,
        isSaved: false,
      }
  },
  {
    id: 'p1',
    user: USERS[0],
    imageUrl: 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=2940&auto=format&fit=crop',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    caption: 'Lost in the mountains today. The air up here is just different. ⛰️✨ #nature #mountains #explore',
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
    likes: 2130,
    comments: 156,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    isLiked: true,
    isSaved: false,
  }
];

