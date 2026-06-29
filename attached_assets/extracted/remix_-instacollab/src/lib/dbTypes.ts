/**
 * Persistence-layer types for LocalDB (IndexedDB cache values).
 */
import type {
  ChatMessage,
  MessagesByChatStore,
  Post,
  Reel,
  StoriesByUserStore,
  User,
} from '../types';
import type { CommentLike, CommentThreadStore } from './entityResolve';
import type { StoryDraftMedia } from '../components/stories/storyDraft';

export type WorkspaceTask = {
  id: number;
  title: string;
  team?: string;
  due?: string;
  user?: number;
  completed?: boolean;
  media?: Array<{ url: string; isVideo?: boolean }>;
};

export type WorkspaceAuditLog = {
  id: number;
  text: string;
  time: string;
};

export type WorkspaceFile = {
  id: number | string;
  name?: string;
  size?: string;
  type?: string;
  owner?: string;
  updated?: string;
  versions?: unknown[];
  [key: string]: unknown;
};

export type ChatWallpaperItem = {
  id: string;
  kind: 'image' | 'video';
  value: string;
  label: string;
};

export type ChatWallpaperEntry = {
  selectedId: string;
  customWallpapers: ChatWallpaperItem[];
};

export type ChatWallpapersStore = Record<string, ChatWallpaperEntry>;

export type { MessageReplyRef } from '../types';

export type CloudConnection = {
  id?: string;
  provider?: string;
  connected?: boolean;
  storageName?: string;
  accountLabel?: string;
  bucket?: string;
  region?: string;
  endpoint?: string;
  credentialHint?: string;
  lastValidatedAt?: string;
  dataTypes?: string[];
  [key: string]: unknown;
};

export type LaunchProgress = {
  hasSeenSplash: boolean;
  hasCompletedOnboarding: boolean;
  profileSetupComplete: boolean;
  hasSeenTrending: boolean;
  pendingPasswordResetEmail?: string | null;
};

export type AuthAccountRecord = {
  userId: string;
  email: string;
  password: string;
};

export type AppSettings = {
  /** Data URL for custom launch/splash logo (image, SVG, or video) */
  appLogoUrl?: string | null;
  appLogoMediaType?: 'image' | 'video';
  /** Full-bleed onboarding slide background (image or video data URL) */
  onboardingBackgroundUrl?: string | null;
  onboardingBackgroundMediaType?: 'image' | 'video';
  theme?: string;
  language?: string;
  offlineSync?: boolean;
  cloudAutoSync?: boolean;
  cloudSyncEnabled?: boolean;
  cloudActiveConnectionId?: string | null;
  cloudConnections?: CloudConnection[];
  cloudProvider?: string;
  hiddenProfileViews?: boolean;
  /** @deprecated Removed on save */
  hideProfileViews?: boolean;
  profileVisitorsEnabled?: boolean;
  cloudLastSyncAt?: string | null;
  cloudConnection?: CloudConnection | null;
  [key: string]: unknown;
};

export type {
  ChatMessage,
  CommentLike,
  CommentThreadStore,
  MessagesByChatStore,
  Post,
  Reel,
  StoriesByUserStore,
  StoryDraftMedia,
  User,
};
