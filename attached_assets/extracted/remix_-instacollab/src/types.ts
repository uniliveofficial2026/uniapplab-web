export type Tab = 'home' | 'search' | 'reels' | 'messages' | 'notifications' | 'workspace' | 'profile' | 'live' | 'local-games' | 'third-party-games' | 'wallet';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isVerified?: boolean;
  followers?: number;
  following?: number;
  isFollowing?: boolean;
  bio?: string;
  status?: 'story' | 'live' | 'none';
  note?: string;
  storageTier?: '50GB' | '100GB' | 'Unlimited';
  lastUsernameChange?: string;
}

export interface Post {
  id: string;
  user: User;
  imageUrl: string;
  videoUrl?: string;
  caption: string;
  likes: number;
  comments: number;
  reposts?: number;
  createdAt: string;
  isLiked: boolean;
  isSaved: boolean;
  isReported?: boolean;
  filter?: string;
  brightness?: number;
  contrast?: number;
  textOverlay?: string;
  textOverlayColor?: string;
  textOverlaySize?: number;
  textOverlayPos?: number;
  audioUrl?: string;
  mediaList?: Array<{ url: string; type: 'image' | 'video' | 'audio'; name: string }>;
  font?: string;
  color?: string;
  alignment?: string;
  size?: string;
  bg?: string;
  repost?: Post;
}

export interface Story {
  id: string;
  user: User;
  hasViewed: boolean;
}
