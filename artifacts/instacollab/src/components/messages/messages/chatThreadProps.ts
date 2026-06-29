import type React from 'react';
import type { ChatGroup, ChatMessage, ChatMessageLocation, User } from '../../../types';
import type { FullscreenMediaState, MessageMediaAttachment } from './types';

export type WallpaperItem = {
  id: string;
  kind: 'image' | 'video';
  value: string;
  label: string;
};

export type MessagesChatThreadProps = {
  selectedUser: User | ChatGroup;
  activeCustomWallpaper: WallpaperItem | null;
  videoWallpaperSequence: WallpaperItem[];
  playNextVideoWallpaper: () => void;
  getWallpaperStyle: () => React.CSSProperties | undefined;
  visibleMessageEntries: Array<{ msg: ChatMessage; index: number }>;
  chatSearchQuery: string;
  isPeerTyping: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  chatScrollRef: React.Ref<HTMLDivElement | null>;
  chatScrollRoot: HTMLDivElement | null;
  onChatScroll: () => void;
  messageElementRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  highlightedMessageId: string | null;
  selectedMessageKeys: string[];
  openMessageMenuKey: string | null;
  setOpenMessageMenuKey: React.Dispatch<React.SetStateAction<string | null>>;
  messageMenuDirection: 'up' | 'down';
  setMessageMenuDirection: React.Dispatch<React.SetStateAction<'up' | 'down'>>;
  openReactionPickerKey: string | null;
  setOpenReactionPickerKey: React.Dispatch<React.SetStateAction<string | null>>;
  reactionPickerDirection: 'up' | 'down';
  setReactionPickerDirection: React.Dispatch<React.SetStateAction<'up' | 'down'>>;
  selectedChatId: string | null;
  chatLastReadAt: Record<string, number>;
  chatPeerReadAt: Record<string, number>;
  incomingReadLabelWatermark: number;
  bothParticipantsInChat: boolean;
  inlineVideoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  onViewProfile: () => void;
  getMessageReactionKey: (msg: ChatMessage, index: number) => string;
  getMessageSelectionKey: (msg: ChatMessage, index: number) => string;
  toggleMessageSelection: (msg: ChatMessage, index: number) => void;
  decideMessageMenuDirection: (targetElement: HTMLElement) => 'up' | 'down';
  decideReactionPickerDirection: (targetElement: HTMLElement) => 'up' | 'down';
  jumpToOriginalMessage: (sourceMessageId?: string) => void;
  setFullscreenMedia: React.Dispatch<React.SetStateAction<FullscreenMediaState | null>>;
  handleSharedItemClick: (msgText: string, mediaIndex?: number) => void;
  extractMessageSegments: (text: string) => { messageBody: string; attachments: string[] };
  tryOpenMediaFullscreen: (
    items: FullscreenMediaState['items'],
    mediaIndex: number,
    videoRefKey?: string,
  ) => void;
  handleAttachmentTokenClick: (token: string) => void;
  toggleMessageReaction: (index: number, emoji: string) => void;
  handleReplyMessage: (msg: ChatMessage, index: number) => void;
  handleForwardMessage: (msg: ChatMessage) => void;
  handleCopyMessage: (msg: ChatMessage) => void;
  handleTogglePinMessage: (msg: ChatMessage, index: number) => void;
  handleDeleteForMe: (index: number) => void;
  handleDeleteForEveryone: (msg: ChatMessage, index: number) => void;
  handleEditMessage: (msg: ChatMessage, index: number) => void;
  handleSelectAllMessages: () => void;
  onToggleIncomingReadStatus: (msg: ChatMessage) => void;
  onOpenFilePreview: (media: MessageMediaAttachment) => void;
  onDownloadFile: (media: MessageMediaAttachment) => void;
  onOpenLocationMap: (location: ChatMessageLocation) => void;
};

export type ComposeMediaItem = {
  url: string;
  isVideo: boolean;
  isAudio?: boolean;
  isFile?: boolean;
  mimeType?: string;
  size?: number;
  name?: string;
};
