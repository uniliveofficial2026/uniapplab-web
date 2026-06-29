import fs from 'fs';
import path from 'path';

const screenPath = path.join('src/components/messages/MessagesScreen.tsx');
const lines = fs.readFileSync(screenPath, 'utf8').split('\n');

function dedent(block, spaces) {
  const prefix = ' '.repeat(spaces);
  return block
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line.slice(spaces) : line))
    .join('\n');
}

const threadRaw = lines.slice(1891, 2559).join('\n');
const composeRaw = lines.slice(2560, 2958).join('\n');

let threadBody = dedent(threadRaw, 9);
let composeBody = dedent(composeRaw, 10);

threadBody = threadBody
  .replaceAll('handleViewProfile', 'onViewProfile')
  .replaceAll('!!typingByUserId[selectedUser.id]', 'isPeerTyping');

composeBody = composeBody
  .replaceAll('handleSendMessage', 'onSendMessage')
  .replaceAll('handleToggleSelectAllMessages', 'onToggleSelectAllMessages')
  .replaceAll('handleSelectionCopy', 'onSelectionCopy')
  .replaceAll('handleSelectionPin', 'onSelectionPin')
  .replaceAll('handleSelectionReply', 'onSelectionReply')
  .replaceAll('handleSelectionForward', 'onSelectionForward')
  .replaceAll('handleSelectionDeleteForMe', 'onSelectionDeleteForMe')
  .replaceAll('handleSelectionDeleteForEveryone', 'onSelectionDeleteForEveryone')
  .replaceAll('handleMediaUpload', 'onMediaUpload')
  .replaceAll('handleFileUploadMenu', 'onFileUploadMenu')
  .replaceAll('handleMusicUpload', 'onMusicUpload')
  .replaceAll('handleLocationShare', 'onLocationShare');

const threadHeader = `import React from 'react';
import { Heart, MoreHorizontal, Music, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import type { ChatGroup, ChatMessage, MessageReplyRef, Post, Reel, User } from '../../types';
import { useDB } from '../../lib/useDB';
import { handleAvatarError, handleMediaError } from '../../lib/utils';
import { safeMediaUrl } from '../../lib/safe';
import { PLAYBACK_SCOPE } from '../../lib/playbackScope';
import { ChatInlineVideo } from './ChatInlineVideo';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { MusicDiscPlayer } from './MusicDiscPlayer';
import type { FullscreenMediaState, MessageMediaAttachment } from './messages/types';
import { toFullscreenMediaItems } from './messages/messageMediaUtils';
import {
  formatMessageDateTime,
  getDaySeparatorLabel,
  getMessageDateValue,
} from './messages/messageTime';
import type { MessagesChatThreadProps } from './messages/chatThreadProps';

export function MessagesChatThread(props: MessagesChatThreadProps) {
  const db = useDB();
  const {
    selectedUser,
    activeCustomWallpaper,
    videoWallpaperSequence,
    playNextVideoWallpaper,
    getWallpaperStyle,
    visibleMessageEntries,
    chatSearchQuery,
    isPeerTyping,
    messagesEndRef,
    messageElementRefs,
    highlightedMessageId,
    selectedMessageKeys,
    openMessageMenuKey,
    setOpenMessageMenuKey,
    messageMenuDirection,
    setMessageMenuDirection,
    openReactionPickerKey,
    setOpenReactionPickerKey,
    reactionPickerDirection,
    setReactionPickerDirection,
    selectedChatId,
    chatLastReadAt,
    chatPeerReadAt,
    inlineVideoRefs,
    onViewProfile,
    getMessageReactionKey,
    getMessageSelectionKey,
    toggleMessageSelection,
    decideMessageMenuDirection,
    decideReactionPickerDirection,
    jumpToOriginalMessage,
    setFullscreenMedia,
    handleSharedItemClick,
    extractMessageSegments,
    tryOpenMediaFullscreen,
    handleAttachmentTokenClick,
    toggleMessageReaction,
    handleReplyMessage,
    handleForwardMessage,
    handleCopyMessage,
    handleTogglePinMessage,
    handleDeleteForMe,
    handleDeleteForEveryone,
    handleEditMessage,
    handleSelectAllMessages,
  } = props;

  return (
`;

const threadFooter = `
  );
}
`;

const composeHeader = `import React from 'react';
import { FileText, Image, Loader2, MapPin, Mic, Music, Plus, Send, Smile, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import type { MessageMediaAttachment } from './messages/types';
import { safeMediaUrl } from '../../lib/safe';
import { handleMediaError } from '../../lib/utils';
import { ChatInlineVideo } from './ChatInlineVideo';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { Waveform } from './Waveform';
import type { MessagesComposeBarProps } from './messages/composeBarProps';

export function MessagesComposeBar(props: MessagesComposeBarProps) {
  const {
    chatMedia,
    setChatMedia,
    selectedMessageKeys,
    setSelectedMessageKeys,
    currentMessages,
    replyToMessage,
    setReplyToMessage,
    replyToMessages,
    setReplyToMessages,
    editingMessageIndex,
    setEditingMessageIndex,
    showAttachmentMenu,
    setShowAttachmentMenu,
    isSharingLocation,
    messageText,
    setMessageText,
    showEmojiPicker,
    setShowEmojiPicker,
    isRecording,
    recordedVoice,
    isListening,
    tokenSuggestion,
    activeSuggestions,
    activeTokenIndex,
    setActiveTokenIndex,
    messageInputRef,
    inlineVideoRefs,
    onSendMessage,
    onToggleSelectAllMessages,
    onSelectionCopy,
    onSelectionPin,
    onSelectionReply,
    onSelectionForward,
    onSelectionDeleteForMe,
    onSelectionDeleteForEveryone,
    onMediaUpload,
    onFileUploadMenu,
    onMusicUpload,
    onLocationShare,
    tryOpenMediaFullscreen,
    setFullscreenMedia,
    clearRecording,
    showToast,
    handleMicDown,
    handleMicUp,
    updateTokenSuggestion,
    insertTokenSuggestion,
    setTokenSuggestion,
  } = props;

  return (
`;

const composeFooter = `
  );
}
`;

fs.writeFileSync(
  'src/components/messages/MessagesChatThread.tsx',
  threadHeader + threadBody + threadFooter,
);
fs.writeFileSync(
  'src/components/messages/MessagesComposeBar.tsx',
  composeHeader + composeBody + composeFooter,
);

console.log('Wrote MessagesChatThread.tsx and MessagesComposeBar.tsx');
