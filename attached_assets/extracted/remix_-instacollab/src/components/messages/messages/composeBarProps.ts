import type React from 'react';
import type { ChatMessage } from '../../../types';
import type { FullscreenMediaState, MessageMediaAttachment, ReplyPreviewItem } from './types';
import type { ComposeMediaItem } from './chatThreadProps';

export type TokenSuggestionState = {
  type: 'mention' | 'hashtag';
  query: string;
  start: number;
  end: number;
} | null;

export type MessagesComposeBarProps = {
  chatMedia: ComposeMediaItem[];
  setChatMedia: React.Dispatch<React.SetStateAction<ComposeMediaItem[]>>;
  selectedMessageKeys: string[];
  setSelectedMessageKeys: React.Dispatch<React.SetStateAction<string[]>>;
  currentMessages: ChatMessage[];
  replyToMessage: { index: number; text: string } | null;
  setReplyToMessage: React.Dispatch<React.SetStateAction<{ index: number; text: string } | null>>;
  replyToMessages: ReplyPreviewItem[];
  setReplyToMessages: React.Dispatch<React.SetStateAction<ReplyPreviewItem[]>>;
  editingMessageIndex: number | null;
  setEditingMessageIndex: React.Dispatch<React.SetStateAction<number | null>>;
  showAttachmentMenu: boolean;
  setShowAttachmentMenu: React.Dispatch<React.SetStateAction<boolean>>;
  messageText: string;
  setMessageText: React.Dispatch<React.SetStateAction<string>>;
  onComposeTypingChange?: (hasDraft: boolean) => void;
  showEmojiPicker: boolean;
  setShowEmojiPicker: React.Dispatch<React.SetStateAction<boolean>>;
  isRecording: boolean;
  recordedVoice: string | null;
  isListening: boolean;
  tokenSuggestion: TokenSuggestionState;
  activeSuggestions: string[];
  activeTokenIndex: number;
  setActiveTokenIndex: React.Dispatch<React.SetStateAction<number>>;
  messageInputRef: React.RefObject<HTMLInputElement | null>;
  inlineVideoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  onSendMessage: (e: React.FormEvent) => void;
  onToggleSelectAllMessages: () => void;
  onSelectionCopy: () => void;
  onSelectionPin: () => void;
  onSelectionReply: () => void;
  onSelectionForward: () => void;
  onSelectionDeleteForMe: () => void;
  onSelectionDeleteForEveryone: () => void;
  onMediaUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileUploadMenu: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMusicUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLocationShare: () => void;
  onOpenFilePreview: (media: MessageMediaAttachment) => void;
  tryOpenMediaFullscreen: (
    items: FullscreenMediaState['items'],
    mediaIndex: number,
    videoRefKey?: string,
  ) => void;
  setFullscreenMedia: React.Dispatch<React.SetStateAction<FullscreenMediaState | null>>;
  clearRecording: () => void;
  showToast: (message: string) => void;
  handleMicDown: (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => void;
  handleMicUp: (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => void;
  updateTokenSuggestion: (value: string, cursor: number) => void;
  insertTokenSuggestion: (suggestion: string) => void;
  setTokenSuggestion: React.Dispatch<React.SetStateAction<TokenSuggestionState>>;
};
