import type { StoryDraftMedia } from '../../stories/storyDraft';
import type { Post, Reel, User } from '../../../types';

export type MessageMediaAttachment = {
  url?: string;
  isVideo?: boolean;
  isAudio?: boolean;
  /** Document / PDF / archive — not shown in photo grid or fullscreen viewer */
  isFile?: boolean;
  mimeType?: string;
  size?: number;
  name?: string;
  title?: string;
  [key: string]: unknown;
};

export type ReplyPreviewItem = {
  index: number;
  text: string;
  hasMedia?: boolean;
  media?: MessageMediaAttachment[] | unknown[];
  hasShareLink?: boolean;
  sourceMessageId?: string;
};

export type FullscreenMediaItem = {
  url: string;
  isVideo: boolean;
  isAudio?: boolean;
  name?: string;
  title?: string;
  caption?: string;
  avatarUrl?: string;
  post?: Post;
  reel?: Reel;
  story?: StoryDraftMedia | { user: User };
  musicUrl?: string;
};

export type FullscreenMediaState = {
  items: FullscreenMediaItem[];
  mediaIndex: number;
};
