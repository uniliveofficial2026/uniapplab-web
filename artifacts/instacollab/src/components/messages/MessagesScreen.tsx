import React, { useState, useEffect } from 'react';
import { useDB } from '../../lib/useDB';
import { useVoice } from '../../lib/useVoice';
import {
  User,
  type ChatGroup,
  type ChatMessage,
  type ChatMessageLocation,
  type ChatPresenceEntry,
  type MessageReplyRef,
} from '../../types';
import { AnimatePresence } from 'motion/react';
import { useToast } from '../../lib/ToastContext';
import { detectMediaKind, fileToBase64, processUploadFile, processUploadFileAsUrl } from '../../lib/utils';
import { resolveUser, findUserById, safeMediaUrl, safeIdArray } from '../../lib/safe';
import {
  openNativeVideoFullscreen,
  openNativeVideoFullscreenFromRef,
} from '../../lib/useNativeVideoFullscreen';
import { ChatFullscreenMediaPortal } from './ChatFullscreenMediaPortal';
import { ChatFilePreviewPortal } from './ChatFilePreviewPortal';
import { ChatLocationMapPortal } from './ChatLocationMapPortal';
import { ChatLocationShareSheet } from './ChatLocationShareSheet';
import { getLocationPreviewLabel } from './messages/chatLocationUtils';
import {
  downloadChatFile,
  getReplyPreviewLabel,
  isChatFileWithinLimit,
} from './messages/chatFileUtils';
import type { ComposeMediaItem } from './messages/chatThreadProps';
import type {
  FullscreenMediaState,
  MessageMediaAttachment,
  ReplyPreviewItem,
} from './messages/types';
import { resolveSharedLinkFullscreen } from './messages/resolveSharedLinkFullscreen';
import { isShareLinkMessage, openShareLink, parseShareLink } from '../../lib/shareLinks';
import { getChatUnreadCount as computeChatUnreadCount } from './messages/chatUnread';
import { matchByQuery, parseSearchQuery } from './messages/searchQuery';
import { getMessageTimestampMs } from './messages/messageTime';
import {
  areBothParticipantsInChat,
  getIncomingReadLabelWatermark,
  newestMessageTimestampMs,
} from './messages/chatReadReceipts';
import { resolveUserTyping, TYPING_IDLE_MS } from './messages/chatTyping';
import { stopAllChatMedia } from '../../lib/chatMediaPlayback';
import { MessagesSidebar } from './MessagesSidebar';
import { MessagesEmptyChat } from './MessagesEmptyChat';
import { MessagesChatHeader } from './MessagesChatHeader';
import { MessagesActiveCallOverlay } from './MessagesActiveCallOverlay';
import { MessagesChatThread } from './MessagesChatThread';
import { MessagesComposeBar } from './MessagesComposeBar';
import { MessagesScreenOverlays } from './MessagesScreenOverlays';

const EMPTY_CHAT_MESSAGES: ChatMessage[] = [];

export function MessagesScreen({
  onBack,
  initialChatId,
  onClearInitialChatId,
  embedded = false,
}: {
  onBack?: () => void;
  initialChatId?: string | null;
  onClearInitialChatId?: () => void;
  embedded?: boolean;
}) {
  const db = useDB();
  const USERS = db.users;
  const currentUser = resolveUser(db.users, db.currentUser);
  const { showToast } = useToast();

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLocationShareSheet, setShowLocationShareSheet] = useState(false);
  const [locationMapPreview, setLocationMapPreview] = useState<ChatMessageLocation | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [chatWallpaper, setChatWallpaper] = useState<string>('default');
  const [customWallpapers, setCustomWallpapers] = useState<Array<{
    id: string;
    kind: 'image' | 'video';
    value: string;
    label: string;
  }>>([]);
  const wallpaperInputRef = React.useRef<HTMLInputElement>(null);
  const wallpaperHydratedChatRef = React.useRef<string | null>(null);
  
  useEffect(() => {
    if (initialChatId) {
      setSelectedChatId(initialChatId);
      onClearInitialChatId?.();
    }
  }, [initialChatId, onClearInitialChatId]);

  const [activeCall, setActiveCall] = useState<'video' | 'audio' | null>(null);
  const [messageText, setMessageText] = useState('');
  const [openReactionPickerKey, setOpenReactionPickerKey] = useState<string | null>(null);
  const [reactionPickerDirection, setReactionPickerDirection] = useState<'up' | 'down'>('up');
  const [openMessageMenuKey, setOpenMessageMenuKey] = useState<string | null>(null);
  const [messageMenuDirection, setMessageMenuDirection] = useState<'up' | 'down'>('up');
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<{ index: number; text: string } | null>(null);
  const [replyToMessages, setReplyToMessages] = useState<ReplyPreviewItem[]>([]);
  const [selectedMessageKeys, setSelectedMessageKeys] = useState<string[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const messageElementRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const highlightTimeoutRef = React.useRef<number | null>(null);
  const [tokenSuggestion, setTokenSuggestion] = useState<{
    type: 'mention' | 'hashtag';
    query: string;
    start: number;
    end: number;
  } | null>(null);
  const [activeTokenIndex, setActiveTokenIndex] = useState(0);
  const messageInputRef = React.useRef<HTMLInputElement>(null);
  
  // --- MEDIA ---
  const [chatMedia, setChatMedia] = useState<ComposeMediaItem[]>([]);
  const [fullscreenMedia, setFullscreenMedia] = useState<FullscreenMediaState | null>(null);
  const [filePreviewMedia, setFilePreviewMedia] = useState<MessageMediaAttachment | null>(null);
  const inlineVideoRefs = React.useRef<Map<string, HTMLVideoElement>>(new Map());

  const tryOpenMediaFullscreen = (
    items: FullscreenMediaState['items'],
    mediaIndex: number,
    videoRefKey?: string
  ) => {
    stopAllChatMedia(inlineVideoRefs.current);
    const item = items[mediaIndex];
    if (item?.isAudio) {
      setFullscreenMedia({ items, mediaIndex });
      return;
    }
    if (item?.isVideo) {
      const key = videoRefKey ?? `fs-${mediaIndex}`;
      if (openNativeVideoFullscreenFromRef(() => inlineVideoRefs.current.get(key))) {
        return;
      }
    }
    setFullscreenMedia({ items, mediaIndex });
  };

  useEffect(() => {
    if (!fullscreenMedia) return;
    const item = fullscreenMedia.items[fullscreenMedia.mediaIndex];
    if (!item?.isVideo) return;
    for (const el of inlineVideoRefs.current.values()) {
      const url = safeMediaUrl(item.url);
      if (url && (el.src === url || el.currentSrc.includes(url))) {
        openNativeVideoFullscreen(el);
        return;
      }
    }
  }, [fullscreenMedia]);

  const handleSharedItemClick = (msgText: string, mediaIndex = 0) => {
    const result = resolveSharedLinkFullscreen(msgText, {
      posts: db.posts,
      reels: db.reels,
      users: db.users,
      getUserStorySegments: (userId) => db.getProfileStorySegments(userId),
    }, mediaIndex);
    if (result.kind === 'fullscreen') {
      tryOpenMediaFullscreen(result.state.items, result.state.mediaIndex);
      return;
    }
    const ref = parseShareLink(msgText);
    if (ref) {
      openShareLink(ref, db.users);
      return;
    }
    if (result.kind === 'openUrl') {
      window.open(result.url, '_blank');
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        try {
          const files = Array.from(e.target.files);
          const newMedia = await Promise.all(files.map(async (file) => {
            const uploaded = await processUploadFile(file);
            return {
              url: uploaded.url,
              isVideo: uploaded.type === 'video',
              isAudio: uploaded.type === 'audio',
              name: uploaded.name,
            };
          }));
          setChatMedia((prev) => [...prev, ...newMedia]);
        } catch {
          showToast('Error processing media');
        }
      }
  };

  const resetNewGroupForm = () => {
    setNewGroupName('');
    setNewGroupSearchQuery('');
    setSelectedGroupMemberIds([]);
    setNewGroupAvatar('');
  };

  const toggleGroupMemberSelection = (userId: string) => {
    setSelectedGroupMemberIds((prev) => (
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    ));
  };

  const handleGroupAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image for group profile.');
      event.target.value = '';
      return;
    }
    try {
      const avatarDataUrl = await fileToBase64(file);
      setNewGroupAvatar(avatarDataUrl);
    } catch {
      showToast('Unable to load group profile image.');
    } finally {
      event.target.value = '';
    }
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim() || selectedGroupMemberIds.length === 0) return;
    const newId = `group_${Date.now()}`;
    setGroups((prev) => [
      ...prev,
      {
        id: newId,
        displayName: newGroupName,
        username: `${selectedGroupMemberIds.length + 1} member${selectedGroupMemberIds.length + 1 > 1 ? 's' : ''}`,
        avatarUrl:
          newGroupAvatar ||
          'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100',
        isGroup: true,
        memberIds: [currentUser.id, ...selectedGroupMemberIds],
        createdBy: currentUser.id,
        adminIds: [currentUser.id],
        mutedMemberIds: [],
        adminOnlyPosting: false,
        requireApprovalToJoin: false,
      },
    ]);
    setSelectedChatId(newId);
    setShowNewGroupModal(false);
    resetNewGroupForm();
    showToast('Group created');
  };
  
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [newMessageSearchQuery, setNewMessageSearchQuery] = useState('');
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupSearchQuery, setNewGroupSearchQuery] = useState('');
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [newGroupAvatar, setNewGroupAvatar] = useState<string>('');
  const groupAvatarInputRef = React.useRef<HTMLInputElement>(null);
  const groupSettingsAvatarInputRef = React.useRef<HTMLInputElement>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showGroupSettingsScreen, setShowGroupSettingsScreen] = useState(false);
  const [showGroupAddUsersScreen, setShowGroupAddUsersScreen] = useState(false);
  const [showGroupModerationScreen, setShowGroupModerationScreen] = useState(false);
  const [showPinnedMessagesScreen, setShowPinnedMessagesScreen] = useState(false);
  const [showGalleryScreen, setShowGalleryScreen] = useState(false);
  const [showSidebarSearch, setShowSidebarSearch] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [showPinnedSearch, setShowPinnedSearch] = useState(false);
  const [pinnedSearchQuery, setPinnedSearchQuery] = useState('');
  const [showGallerySearch, setShowGallerySearch] = useState(false);
  const [gallerySearchQuery, setGallerySearchQuery] = useState('');
  const [groupAddUsersSearchQuery, setGroupAddUsersSearchQuery] = useState('');
  const [groupModerationSearchQuery, setGroupModerationSearchQuery] = useState('');

  const extractMessageSegments = (text: string) => {
    const matches = text.match(/[@#][a-zA-Z0-9_]+/g) || [];
    const seen = new Set<string>();
    const attachments = matches.filter((token) => {
      const normalized = token.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
    const messageBody = text.replace(/[@#][a-zA-Z0-9_]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return { messageBody, attachments };
  };

  const handleAttachmentTokenClick = (token: string) => {
    if (!token || token.length < 2) return;
    const marker = token[0];
    const value = token.slice(1);
    if (!value) return;

    if (marker === '@') {
      window.dispatchEvent(new CustomEvent('navigate', {
        detail: {
          tab: 'search',
          searchQuery: value,
          searchTab: 'accounts',
        },
      }));
      return;
    }

    if (marker === '#') {
      window.dispatchEvent(new CustomEvent('navigate', {
        detail: {
          tab: 'search',
          searchQuery: value,
          searchTab: 'tags',
        },
      }));
    }
  };

  const [groups, setGroups] = useState<ChatGroup[]>([
    {
      id: 'group1',
      displayName: 'Design Team UI/UX',
      username: '3 members',
      avatarUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100',
      isGroup: true,
      memberIds: [currentUser.id, USERS[1]?.id, USERS[2]?.id].filter((id): id is string => Boolean(id)),
      createdBy: currentUser.id,
      adminIds: [currentUser.id],
      mutedMemberIds: [] as string[],
      adminOnlyPosting: false,
      requireApprovalToJoin: false,
    }
  ]);

  const [newGroupName, setNewGroupName] = useState('');
  const [groupManageSearchQuery, setGroupManageSearchQuery] = useState('');
  const [groupNameDraft, setGroupNameDraft] = useState('');

  const selectedUser =
    (selectedChatId ? findUserById(USERS, selectedChatId) : null) ??
    groups.find((g) => g.id === selectedChatId) ??
    null;
  const selectedGroup = groups.find((g: ChatGroup) => g.id === selectedChatId) || null;

  const messages = db.messages;
  const persistedPresence = db.chatPresence;
  const persistedReadState = db.chatReadState;
  const persistedPeerReadState = db.chatPeerReadState;
  const [typingByUserId, setTypingByUserId] = useState<Record<string, boolean>>(
    () => Object.fromEntries(USERS.map((user) => [user.id, !!db.getUserPresence(user.id).typing]))
  );
  const typingTimeoutsRef = React.useRef<Record<string, number>>({});
  const peerMirrorTypingRef = React.useRef(false);
  const presenceMapDebounceRef = React.useRef<number | null>(null);
  const simulatedReplyCleanupRef = React.useRef<(() => void) | null>(null);
  const [onlineStatusByUserId, setOnlineStatusByUserId] = useState<Record<string, boolean>>(
    () => Object.fromEntries(USERS.map((user) => {
      const persisted = db.getUserPresence(user.id);
      const fallbackOnline = Math.random() > 0.35;
      return [user.id, persisted.lastActiveAt > 0 || persisted.lastSeenAt > 0 ? persisted.online : fallbackOnline];
    }))
  );
  const [lastSeenByUserId, setLastSeenByUserId] = useState<Record<string, number>>(
    () => Object.fromEntries(USERS.map((user) => [user.id, db.getUserPresence(user.id).lastSeenAt || 0]))
  );
  const [lastActiveByUserId, setLastActiveByUserId] = useState<Record<string, number>>(
    () => Object.fromEntries(USERS.map((user) => {
      const persisted = db.getUserPresence(user.id);
      const fallback = Date.now() - Math.floor(Math.random() * 25_000);
      return [user.id, persisted.lastActiveAt || fallback];
    }))
  );
  const [chatLastReadAt, setChatLastReadAt] = useState<Record<string, number>>(
    () => Object.fromEntries(Object.keys(messages).map((chatId) => [chatId, db.getChatReadAt(chatId)]))
  );
  const [chatPeerReadAt, setChatPeerReadAt] = useState<Record<string, number>>(
    () => Object.fromEntries(Object.keys(messages).map((chatId) => [chatId, db.getChatPeerReadAt(chatId)]))
  );
  const [clockTick, setClockTick] = useState(Date.now());
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const chatScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [chatScrollRoot, setChatScrollRoot] = React.useState<HTMLDivElement | null>(null);
  const stickToBottomRef = React.useRef(true);

  const setChatScrollContainerRef = React.useCallback((el: HTMLDivElement | null) => {
    chatScrollRef.current = el;
    setChatScrollRoot(el);
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = chatScrollRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleChatScroll = React.useCallback(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 140;
  }, []);

  const setUserTypingState = React.useCallback(
    (userId: string, value: boolean, autoClearMs = 0) => {
      if (!userId) return;
      const previousTimeout = typingTimeoutsRef.current[userId];
      if (previousTimeout) {
        window.clearTimeout(previousTimeout);
        delete typingTimeoutsRef.current[userId];
      }
      setTypingByUserId((prev) => ({ ...prev, [userId]: value }));
      db.setUserTyping(userId, value);
      if (value && autoClearMs > 0) {
        typingTimeoutsRef.current[userId] = window.setTimeout(() => {
          setTypingByUserId((prev) => ({ ...prev, [userId]: false }));
          db.setUserTyping(userId, false);
          delete typingTimeoutsRef.current[userId];
        }, autoClearMs);
      }
    },
    [db]
  );

  const markUserActive = React.useCallback((userId: string, at = Date.now()) => {
    if (!userId) return;
    setLastActiveByUserId((prev) => ({ ...prev, [userId]: at }));
    setOnlineStatusByUserId((prev) => ({ ...prev, [userId]: true }));
  }, []);

  useEffect(() => {
    const now = Date.now();
    setOnlineStatusByUserId((prev) => {
      const nextOnline = { ...prev };
      USERS.forEach((user) => {
        if (typeof nextOnline[user.id] !== 'boolean') {
          nextOnline[user.id] = false;
        }
      });
      return nextOnline;
    });
    setLastActiveByUserId((prev) => {
      const nextActive = { ...prev };
      USERS.forEach((user) => {
        if (typeof nextActive[user.id] !== 'number') {
          nextActive[user.id] = now - 5 * 60_000;
        }
      });
      return nextActive;
    });
    setLastSeenByUserId((prev) => {
      const nextSeen = { ...prev };
      USERS.forEach((user) => {
        if (typeof nextSeen[user.id] !== 'number') {
          nextSeen[user.id] = now - 5 * 60_000;
        }
      });
      return nextSeen;
    });
  }, [USERS]);

  useEffect(() => {
    const OFFLINE_THRESHOLD_MS = 65_000;
    const statusIntervalId = window.setInterval(() => {
      const now = Date.now();
      setClockTick(now);

      setOnlineStatusByUserId((prevOnline) => {
        const nextOnline = { ...prevOnline };
        USERS.forEach((user) => {
          const lastActive = lastActiveByUserId[user.id] || 0;
          nextOnline[user.id] = now - lastActive <= OFFLINE_THRESHOLD_MS;
        });
        return nextOnline;
      });

      setLastSeenByUserId((prevSeen) => {
        const nextSeen = { ...prevSeen };
        USERS.forEach((user) => {
          const lastActive = lastActiveByUserId[user.id] || 0;
          const isOnline = now - lastActive <= OFFLINE_THRESHOLD_MS;
          if (!isOnline) {
            nextSeen[user.id] = lastActive || nextSeen[user.id] || now;
          }
        });
        return nextSeen;
      });
    }, 4000);

    return () => {
      window.clearInterval(statusIntervalId);
    };
  }, [USERS, lastActiveByUserId]);

  useEffect(() => {
    if (!persistedPresence || typeof persistedPresence !== 'object') return;
    setTypingByUserId((prev) => {
      let changed = false;
      const next = { ...prev };
      USERS.forEach((user) => {
        const entry = persistedPresence[user.id];
        if (!entry || typeof entry !== 'object') return;
        const nextValue = !!entry.typing;
        if (next[user.id] !== nextValue) {
          next[user.id] = nextValue;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setOnlineStatusByUserId((prev) => {
      let changed = false;
      const next = { ...prev };
      USERS.forEach((user) => {
        const entry = persistedPresence[user.id];
        if (!entry || typeof entry !== 'object') return;
        const nextValue = !!entry.online;
        if (next[user.id] !== nextValue) {
          next[user.id] = nextValue;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setLastSeenByUserId((prev) => {
      let changed = false;
      const next = { ...prev };
      USERS.forEach((user) => {
        const entry = persistedPresence[user.id];
        if (!entry || typeof entry !== 'object') return;
        const nextValue = typeof entry.lastSeenAt === 'number' ? entry.lastSeenAt : 0;
        if ((next[user.id] || 0) !== nextValue) {
          next[user.id] = nextValue;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setLastActiveByUserId((prev) => {
      let changed = false;
      const next = { ...prev };
      USERS.forEach((user) => {
        const entry = persistedPresence[user.id];
        if (!entry || typeof entry !== 'object') return;
        const nextValue = typeof entry.lastActiveAt === 'number' ? entry.lastActiveAt : 0;
        if ((next[user.id] || 0) !== nextValue) {
          next[user.id] = nextValue;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [USERS, persistedPresence]);

  useEffect(() => {
    if (!persistedReadState || typeof persistedReadState !== 'object') return;
    setChatLastReadAt((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(persistedReadState).forEach(([chatId, value]) => {
        if (typeof value !== 'number') return;
        const previousValue = typeof next[chatId] === 'number' ? next[chatId] : 0;
        if (value > previousValue) {
          next[chatId] = value;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [persistedReadState]);

  useEffect(() => {
    if (!persistedPeerReadState || typeof persistedPeerReadState !== 'object') return;
    setChatPeerReadAt((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(persistedPeerReadState).forEach(([chatId, value]) => {
        if (typeof value !== 'number') return;
        const previousValue = typeof next[chatId] === 'number' ? next[chatId] : 0;
        if (value > previousValue) {
          next[chatId] = value;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [persistedPeerReadState]);

  useEffect(() => {
    db.setUserPresence(currentUser.id, { activeChatId: selectedChatId || null });
  }, [db, currentUser.id, selectedChatId]);

  const selectedPeerId =
    selectedUser && !('isGroup' in selectedUser) ? selectedUser.id : null;
  const selectedPeerOnline = selectedPeerId ? !!onlineStatusByUserId[selectedPeerId] : false;

  useEffect(() => {
    simulatedReplyCleanupRef.current?.();
    simulatedReplyCleanupRef.current = null;
  }, [selectedChatId]);

  useEffect(() => {
    return () => {
      simulatedReplyCleanupRef.current?.();
      simulatedReplyCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (presenceMapDebounceRef.current) {
      window.clearTimeout(presenceMapDebounceRef.current);
    }
    presenceMapDebounceRef.current = window.setTimeout(() => {
      presenceMapDebounceRef.current = null;
      const nextPresenceMap: Record<string, ChatPresenceEntry> = {};
      USERS.forEach((user) => {
        const existing = db.getUserPresence(user.id);
        let activeChatId = existing.activeChatId ?? null;
        if (user.id === currentUser.id) {
          activeChatId = selectedChatId || null;
        }
        const typing =
          user.id === currentUser.id
            ? !!typingByUserId[user.id] || !!existing.typing
            : !!existing.typing;
        nextPresenceMap[user.id] = {
          online: !!onlineStatusByUserId[user.id],
          typing,
          lastSeenAt:
            typeof lastSeenByUserId[user.id] === 'number' ? lastSeenByUserId[user.id] : 0,
          lastActiveAt:
            typeof lastActiveByUserId[user.id] === 'number' ? lastActiveByUserId[user.id] : 0,
          activeChatId,
        };
      });
      const persisted = persistedPresence || {};
      if (JSON.stringify(persisted) !== JSON.stringify(nextPresenceMap)) {
        db.setChatPresenceMap(nextPresenceMap);
      }
    }, 120);
    return () => {
      if (presenceMapDebounceRef.current) {
        window.clearTimeout(presenceMapDebounceRef.current);
        presenceMapDebounceRef.current = null;
      }
    };
  }, [
    db,
    USERS,
    currentUser.id,
    selectedChatId,
    onlineStatusByUserId,
    typingByUserId,
    lastSeenByUserId,
    lastActiveByUserId,
    persistedPresence,
  ]);

  const lastPersistedReadSnapshotRef = React.useRef('');
  useEffect(() => {
    const snapshot = JSON.stringify(chatLastReadAt);
    if (snapshot === lastPersistedReadSnapshotRef.current) return;
    lastPersistedReadSnapshotRef.current = snapshot;
    Object.entries(chatLastReadAt).forEach(([chatId, timestamp]) => {
      if (typeof timestamp !== 'number') return;
      const persisted = db.getChatReadAt(chatId);
      if (timestamp < persisted) {
        db.setChatReadAt(chatId, timestamp, { allowDecrease: true });
      } else {
        db.setChatReadAt(chatId, timestamp);
      }
    });
  }, [db, chatLastReadAt]);

  const lastPersistedPeerReadSnapshotRef = React.useRef('');
  useEffect(() => {
    const snapshot = JSON.stringify(chatPeerReadAt);
    if (snapshot === lastPersistedPeerReadSnapshotRef.current) return;
    lastPersistedPeerReadSnapshotRef.current = snapshot;
    Object.entries(chatPeerReadAt).forEach(([chatId, timestamp]) => {
      if (typeof timestamp === 'number') {
        db.setChatPeerReadAt(chatId, timestamp);
      }
    });
  }, [db, chatPeerReadAt]);

  useEffect(() => {
    if (selectedUser) {
      document.documentElement.classList.add('chat-open-mobile');
    } else {
      document.documentElement.classList.remove('chat-open-mobile');
    }

    window.dispatchEvent(
      new CustomEvent('messages:chat-open', {
        detail: { chatOpen: !!selectedUser },
      })
    );

    return () => {
      document.documentElement.classList.remove('chat-open-mobile');
      window.dispatchEvent(
        new CustomEvent('messages:chat-open', {
          detail: { chatOpen: false },
        })
      );
    };
  }, [selectedUser]);

  useEffect(() => {
    if (!selectedUser || 'isGroup' in selectedUser) return;
    const now = Date.now();
    markUserActive(selectedUser.id, now);
    setUserTypingState(selectedUser.id, false);
  }, [selectedUser, markUserActive, setUserTypingState]);

  useEffect(() => {
    if (!selectedUser || 'isGroup' in selectedUser) return;
    const keepAliveId = window.setInterval(() => {
      markUserActive(selectedUser.id);
    }, 20_000);
    return () => window.clearInterval(keepAliveId);
  }, [selectedUser, markUserActive]);

  useEffect(() => {
    const mobileTopNav = document.querySelector('.mobile-top-nav');
    if (!mobileTopNav) return;

    const shouldHide = !!selectedUser && window.innerWidth < 768;
    mobileTopNav.classList.toggle('force-hide-chat-nav', shouldHide);

    return () => {
      mobileTopNav.classList.remove('force-hide-chat-nav');
    };
  }, [selectedUser]);

  useEffect(() => {
    setOpenReactionPickerKey(null);
    setOpenMessageMenuKey(null);
    setEditingMessageIndex(null);
    setReplyToMessage(null);
    setReplyToMessages([]);
    setSelectedMessageKeys([]);
    setHighlightedMessageId(null);
    setShowGroupSettingsScreen(false);
    setShowGroupAddUsersScreen(false);
    setShowGroupModerationScreen(false);
    setShowPinnedMessagesScreen(false);
    setShowGalleryScreen(false);
  }, [selectedChatId]);

  useEffect(() => {
    setGroupManageSearchQuery('');
    setGroupAddUsersSearchQuery('');
    setGroupModerationSearchQuery('');
    setGroupNameDraft(selectedGroup?.displayName || '');
  }, [selectedGroup?.id, selectedGroup?.displayName]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      Object.values(typingTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      typingTimeoutsRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!openReactionPickerKey) return;

    const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-reaction-picker="true"]')) return;
      if (target.closest('[data-reaction-more-button="true"]')) return;
      setOpenReactionPickerKey(null);
    };

    document.addEventListener('mousedown', handleOutsidePointer);
    document.addEventListener('touchstart', handleOutsidePointer, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointer);
      document.removeEventListener('touchstart', handleOutsidePointer);
    };
  }, [openReactionPickerKey]);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleOutsideMainEmoji = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-main-emoji-panel="true"]')) return;
      if (target.closest('[data-main-emoji-button="true"]')) return;
      setShowEmojiPicker(false);
    };

    document.addEventListener('mousedown', handleOutsideMainEmoji);
    document.addEventListener('touchstart', handleOutsideMainEmoji, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideMainEmoji);
      document.removeEventListener('touchstart', handleOutsideMainEmoji);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!showAttachmentMenu) return;

    const handleOutsideAttachmentMenu = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-attachment-menu-panel="true"]')) return;
      if (target.closest('[data-attachment-menu-button="true"]')) return;
      setShowAttachmentMenu(false);
    };

    document.addEventListener('mousedown', handleOutsideAttachmentMenu);
    document.addEventListener('touchstart', handleOutsideAttachmentMenu, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideAttachmentMenu);
      document.removeEventListener('touchstart', handleOutsideAttachmentMenu);
    };
  }, [showAttachmentMenu]);

  useEffect(() => {
    if (selectedMessageKeys.length === 0) return;

    const handleOutsideSelectorPanel = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-selector-panel="true"]')) return;
      setSelectedMessageKeys([]);
    };

    document.addEventListener('mousedown', handleOutsideSelectorPanel);
    document.addEventListener('touchstart', handleOutsideSelectorPanel, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideSelectorPanel);
      document.removeEventListener('touchstart', handleOutsideSelectorPanel);
    };
  }, [selectedMessageKeys.length]);

  useEffect(() => {
    if (!openMessageMenuKey) return;

    const handleOutsideMessageMenu = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-message-menu-panel="true"]')) return;
      if (target.closest('[data-message-bubble-shell="true"]')) return;
      setOpenMessageMenuKey(null);
    };

    document.addEventListener('mousedown', handleOutsideMessageMenu);
    document.addEventListener('touchstart', handleOutsideMessageMenu, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideMessageMenu);
      document.removeEventListener('touchstart', handleOutsideMessageMenu);
    };
  }, [openMessageMenuKey]);
  
  const _fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageText.trim() && chatMedia.length === 0 && !recordedVoice) || !selectedUser) return;
    const wasEditing = editingMessageIndex !== null;

    if (editingMessageIndex !== null && selectedChatId) {
      db.updateMessage(selectedChatId, editingMessageIndex, (current) => ({
        ...current,
        text: messageText,
        media: recordedVoice ? [{ url: recordedVoice, isAudio: true }] : (chatMedia.length > 0 ? chatMedia : (current?.media || [])),
        editedAt: Date.now(),
      }));
      showToast('Message updated');
    } else {
      const sentTimestamp = Date.now();
      markUserActive(currentUser.id);
      db.addMessage(selectedUser.id, { 
        text: messageText, 
        isAuthor: true, 
        timestamp: sentTimestamp,
        replyTo: replyToMessage ? { ...replyToMessage } : undefined,
        replyToMany: replyToMessages.length > 0 ? replyToMessages.map((reply) => ({ ...reply })) : undefined,
        media: recordedVoice ? [{ url: recordedVoice, isAudio: true }] : (chatMedia.length > 0 ? chatMedia : undefined)
      });
    }
    
    setMessageText('');
    setUserTypingState(currentUser.id, false);
    setTokenSuggestion(null);
    setActiveTokenIndex(0);
    setOpenReactionPickerKey(null);
    setOpenMessageMenuKey(null);
    setEditingMessageIndex(null);
    setReplyToMessage(null);
    setReplyToMessages([]);
    setChatMedia([]);
    clearRecording();
    stickToBottomRef.current = true;
    requestAnimationFrame(() => scrollToBottom('smooth'));

    // Simulate real-time replies
    if (!wasEditing && !('isGroup' in selectedUser)) {
      const peerId = selectedUser.id;
      markUserActive(peerId);
      const replyDelayMs = 1500 + Math.random() * 2000;
      simulatedReplyCleanupRef.current?.();
      setUserTypingState(peerId, true, replyDelayMs + 2_000);
      const typingRenewId = window.setInterval(() => {
        setUserTypingState(peerId, true, replyDelayMs + 2_000);
      }, 1_200);
      const replyTimeoutId = window.setTimeout(() => {
        window.clearInterval(typingRenewId);
        setUserTypingState(peerId, false);
        const responses = [
          'That sounds amazing!',
          'I completely agree.',
          "Let's sync up about this tomorrow.",
          'Interesting perspective! Tell me more.',
          "Wow, didn't know that. 🚀",
          "Regarding that, I'm on it.",
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        db.addMessage(peerId, { text: randomResponse, isAuthor: false, timestamp: Date.now() });
        markUserActive(peerId);
        simulatedReplyCleanupRef.current = null;
      }, replyDelayMs);
      simulatedReplyCleanupRef.current = () => {
        window.clearInterval(typingRenewId);
        window.clearTimeout(replyTimeoutId);
        setUserTypingState(peerId, false);
      };
    }
  };

  const handleOpenFilePreview = (media: MessageMediaAttachment) => {
    setFilePreviewMedia(media);
  };

  const handleDownloadFile = (media: MessageMediaAttachment) => {
    if (downloadChatFile(media)) {
      showToast(`Saved ${media.name || 'file'}`);
      return;
    }
    showToast('Could not save file');
  };

  const handleFileUploadMenu = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isChatFileWithinLimit(file.size)) {
      showToast('File is too large (max 15 MB)');
      e.target.value = '';
      return;
    }
    try {
      const url = await processUploadFileAsUrl(file);
      setChatMedia((prev) => [
        ...prev,
        {
          url,
          isVideo: false,
          isFile: true,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        },
      ]);
      showToast(`Attached ${file.name} — tap Send`);
      requestAnimationFrame(() => messageInputRef.current?.focus());
    } catch {
      showToast('Could not attach file');
    } finally {
      e.target.value = '';
    }
  };

  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    try {
      const files = Array.from(e.target.files);
      const newMedia = await Promise.all(
        files.map(async (file) => {
          const uploaded = await processUploadFile(file);
          return {
            url: uploaded.url,
            isVideo: false,
            isAudio: uploaded.type === 'audio',
            name: uploaded.name,
          };
        }),
      );
      setChatMedia((prev) => [...prev, ...newMedia]);
      setShowAttachmentMenu(false);
      showToast(
        newMedia.length === 1 ? 'Audio attached' : `${newMedia.length} audio files attached`
      );
    } catch {
      showToast('Error processing audio');
    } finally {
      e.target.value = '';
    }
  };

  const handleLocationShare = () => {
    if (!selectedUser) {
      showToast('Select a chat first');
      return;
    }
    setShowAttachmentMenu(false);
    setShowLocationShareSheet(true);
  };

  const handleSendLocation = (location: ChatMessageLocation) => {
    if (!selectedUser?.id) return;
    const sentTimestamp = Date.now();
    markUserActive(currentUser.id);
    db.addMessage(selectedUser.id, {
      text: '',
      location,
      isAuthor: true,
      timestamp: sentTimestamp,
    });
    setShowLocationShareSheet(false);
    stickToBottomRef.current = true;
    showToast(`Shared ${getLocationPreviewLabel(location)}`);
  };

  const handleOpenLocationMap = (location: ChatMessageLocation) => {
    setLocationMapPreview(location);
  };

  const handleViewProfile = () => {
    if (selectedUser && !('isGroup' in selectedUser)) {
      window.dispatchEvent(new CustomEvent('navigate', { 
        detail: { 
          tab: 'profile', 
          userId: selectedUser.id 
        } 
      }));
    }
  };

  const updateGroupById = (groupId: string, updater: (group: ChatGroup) => ChatGroup) => {
    setGroups((prev) => prev.map((group: ChatGroup) => (group.id === groupId ? updater(group) : group)));
  };

  const handleSaveGroupName = () => {
    if (!selectedGroup) return;
    const nextName = groupNameDraft.trim();
    if (!nextName) {
      showToast('Group name is required.');
      return;
    }
    updateGroupById(selectedGroup.id, (group: ChatGroup) => ({
      ...group,
      displayName: nextName,
    }));
    showToast('Group name updated');
  };

  const handleGroupSettingsAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedGroup) return;
    const ownerId = selectedGroup.createdBy || currentUser.id;
    if (ownerId !== currentUser.id) {
      showToast('Only the group owner can change group profile.');
      event.target.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image for group profile.');
      event.target.value = '';
      return;
    }
    try {
      const avatarDataUrl = await fileToBase64(file);
      updateGroupById(selectedGroup.id, (group: ChatGroup) => ({
        ...group,
        avatarUrl: avatarDataUrl,
      }));
      showToast('Group profile updated');
    } catch {
      showToast('Unable to update group profile.');
    } finally {
      event.target.value = '';
    }
  };

  const handleAddGroupMember = (userId: string) => {
    if (!selectedGroup) return;
    if (selectedGroupMemberSet.has(userId)) return;
    updateGroupById(selectedGroup.id, (group: ChatGroup) => {
      const memberIds = Array.isArray(group?.memberIds) ? group.memberIds : [currentUser.id];
      const nextMemberIds = [...memberIds, userId];
      return {
        ...group,
        memberIds: nextMemberIds,
        username: `${nextMemberIds.length} member${nextMemberIds.length > 1 ? 's' : ''}`,
      };
    });
    showToast('Member added');
  };

  const handleRemoveGroupMember = (userId: string) => {
    if (!selectedGroup) return;
    if (userId === currentUser.id) {
      showToast('Use leave group action to remove yourself.');
      return;
    }
    updateGroupById(selectedGroup.id, (group: ChatGroup) => {
      const memberIds = Array.isArray(group?.memberIds) ? group.memberIds : [currentUser.id];
      const nextMemberIds = memberIds.filter((id: string) => id !== userId);
      if (nextMemberIds.length === 0) return group;
      return {
        ...group,
        memberIds: nextMemberIds,
        username: `${nextMemberIds.length} member${nextMemberIds.length > 1 ? 's' : ''}`,
      };
    });
    showToast('Member removed');
  };

  const handleLeaveGroup = () => {
    if (!selectedGroup) return;
    updateGroupById(selectedGroup.id, (group: ChatGroup) => {
      const memberIds = Array.isArray(group?.memberIds) ? group.memberIds : [];
      const nextMemberIds = memberIds.filter((id: string) => id !== currentUser.id);
      return {
        ...group,
        memberIds: nextMemberIds,
        username: `${nextMemberIds.length} member${nextMemberIds.length > 1 ? 's' : ''}`,
      };
    });
    setShowInfoPanel(false);
    setSelectedChatId(null);
    showToast('You left the group');
  };

  const handleDeleteGroup = () => {
    if (!selectedGroup) return;
    const ownerId = selectedGroup.createdBy || currentUser.id;
    if (ownerId !== currentUser.id) {
      showToast('Only the group owner can delete this group.');
      return;
    }
    setGroups((prev) => prev.filter((group: ChatGroup) => group.id !== selectedGroup.id));
    setShowInfoPanel(false);
    setSelectedChatId(null);
    showToast('Group deleted');
  };

  const toggleMuteGroupMember = (userId: string) => {
    if (!selectedGroup) return;
    const ownerId = selectedGroup.createdBy || currentUser.id;
    if (ownerId !== currentUser.id) {
      showToast('Only the group owner can moderate members.');
      return;
    }
    if (userId === currentUser.id) {
      showToast('You cannot mute yourself.');
      return;
    }
    updateGroupById(selectedGroup.id, (group: ChatGroup) => {
      const mutedMemberIds = Array.isArray(group?.mutedMemberIds) ? group.mutedMemberIds : [];
      const isMuted = mutedMemberIds.includes(userId);
      const nextMuted = isMuted
        ? mutedMemberIds.filter((id: string) => id !== userId)
        : [...mutedMemberIds, userId];
      return {
        ...group,
        mutedMemberIds: nextMuted,
      };
    });
    const currentlyMuted = Array.isArray(selectedGroup.mutedMemberIds) && selectedGroup.mutedMemberIds.includes(userId);
    showToast(currentlyMuted ? 'Member unmuted' : 'Member muted');
  };

  const toggleGroupAdminMember = (userId: string) => {
    if (!selectedGroup) return;
    const ownerId = selectedGroup.createdBy || currentUser.id;
    if (ownerId !== currentUser.id) {
      showToast('Only the group owner can manage admins.');
      return;
    }
    if (userId === ownerId) {
      showToast('Owner role cannot be changed.');
      return;
    }

    const isAdmin = selectedGroupAdminSet.has(userId);
    updateGroupById(selectedGroup.id, (group: ChatGroup) => {
      const existingAdminIds = Array.isArray(group?.adminIds) ? group.adminIds : [];
      const withoutOwner = existingAdminIds.filter((id: string) => id !== ownerId);
      const nextAdminIds = isAdmin
        ? withoutOwner.filter((id: string) => id !== userId)
        : [...withoutOwner, userId];
      return {
        ...group,
        adminIds: nextAdminIds,
      };
    });
    showToast(isAdmin ? 'Admin removed' : 'Admin added');
  };

  const toggleGroupModerationSetting = (key: 'adminOnlyPosting' | 'requireApprovalToJoin') => {
    if (!selectedGroup) return;
    const ownerId = selectedGroup.createdBy || currentUser.id;
    if (ownerId !== currentUser.id) {
      showToast('Only the group owner can change moderation settings.');
      return;
    }
    updateGroupById(selectedGroup.id, (group: ChatGroup) => ({
      ...group,
      [key]: !group?.[key],
    }));
  };

  const currentMessages = selectedUser
    ? (Array.isArray(messages[selectedUser.id]) ? messages[selectedUser.id]! : EMPTY_CHAT_MESSAGES)
    : EMPTY_CHAT_MESSAGES;

  const viewerInDirectChat =
    !!selectedChatId && !!selectedUser && !('isGroup' in selectedUser);

  const bothParticipantsInChat = React.useMemo(() => {
    if (!viewerInDirectChat || !selectedChatId || !selectedUser || 'isGroup' in selectedUser) {
      return false;
    }
    const myPresence = db.getUserPresence(currentUser.id);
    const peerPresence = db.getUserPresence(selectedUser.id);
    return areBothParticipantsInChat(selectedChatId, myPresence, peerPresence);
  }, [db, viewerInDirectChat, selectedChatId, selectedUser, currentUser.id, persistedPresence]);

  const [readLabelCapByChatId, setReadLabelCapByChatId] = useState<Record<string, number>>({});
  const soloReadLabelCapRef = React.useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      if (selectedChatId) {
        delete soloReadLabelCapRef.current[selectedChatId];
      }
    };
  }, [selectedChatId]);

  useEffect(() => {
    if (!selectedChatId || !viewerInDirectChat) return;
    if (bothParticipantsInChat) {
      delete soloReadLabelCapRef.current[selectedChatId];
      setReadLabelCapByChatId((prev) => {
        if (!(selectedChatId in prev)) return prev;
        const next = { ...prev };
        delete next[selectedChatId];
        return next;
      });
      return;
    }
    if (soloReadLabelCapRef.current[selectedChatId] !== undefined) return;
    const cap = chatLastReadAt[selectedChatId] || 0;
    soloReadLabelCapRef.current[selectedChatId] = cap;
    setReadLabelCapByChatId((prev) => ({ ...prev, [selectedChatId]: cap }));
  }, [selectedChatId, viewerInDirectChat, bothParticipantsInChat, chatLastReadAt]);

  const incomingReadLabelWatermark = React.useMemo(
    () =>
      getIncomingReadLabelWatermark(
        selectedChatId,
        chatLastReadAt,
        readLabelCapByChatId,
        bothParticipantsInChat
      ),
    [selectedChatId, chatLastReadAt, readLabelCapByChatId, bothParticipantsInChat]
  );

  const getUserTyping = React.useCallback(
    (userId: string) =>
      resolveUserTyping(userId, typingByUserId, (id) => db.getUserPresence(id)),
    [typingByUserId, db, persistedPresence]
  );

  const getBothParticipantsInChat = React.useCallback(
    (chatId: string) => {
      if (!chatId) return false;
      const myPresence = db.getUserPresence(currentUser.id);
      const peerPresence = db.getUserPresence(chatId);
      const viewerHasThisChat = selectedChatId === chatId && viewerInDirectChat;
      return viewerHasThisChat && areBothParticipantsInChat(chatId, myPresence, peerPresence);
    },
    [db, currentUser.id, selectedChatId, viewerInDirectChat, persistedPresence]
  );

  const isComposeTyping = messageText.trim().length > 0;

  const handleComposeTypingChange = React.useCallback(
    (hasDraft: boolean) => {
      if (!viewerInDirectChat || !selectedUser || 'isGroup' in selectedUser) return;
      markUserActive(currentUser.id);
      setUserTypingState(currentUser.id, hasDraft, hasDraft ? TYPING_IDLE_MS : 0);
    },
    [viewerInDirectChat, selectedUser, currentUser.id, markUserActive, setUserTypingState]
  );

  useEffect(() => {
    if (!viewerInDirectChat || !selectedUser || 'isGroup' in selectedUser) return;
    const hasDraft = isComposeTyping;
    markUserActive(currentUser.id);
    setUserTypingState(currentUser.id, hasDraft, hasDraft ? TYPING_IDLE_MS : 0);
    return () => {
      setUserTypingState(currentUser.id, false);
    };
  }, [
    isComposeTyping,
    viewerInDirectChat,
    selectedUser,
    currentUser.id,
    markUserActive,
    setUserTypingState,
  ]);

  const isPeerTyping = React.useMemo(() => {
    if (!selectedUser || 'isGroup' in selectedUser) return false;
    return getUserTyping(selectedUser.id);
  }, [selectedUser, getUserTyping]);

  useEffect(() => {
    if (!bothParticipantsInChat || !selectedUser || 'isGroup' in selectedUser) {
      if (peerMirrorTypingRef.current && selectedPeerId) {
        peerMirrorTypingRef.current = false;
        setUserTypingState(selectedPeerId, false);
      }
      return;
    }
    if (!isComposeTyping) {
      if (peerMirrorTypingRef.current) {
        peerMirrorTypingRef.current = false;
        setUserTypingState(selectedUser.id, false);
      }
      return;
    }
    const peerId = selectedUser.id;
    const startMirror = window.setTimeout(() => {
      if (!messageText.trim()) return;
      peerMirrorTypingRef.current = true;
      setUserTypingState(peerId, true, TYPING_IDLE_MS + 2_000);
    }, 400);
    const renewMirror = window.setInterval(() => {
      if (!messageText.trim()) return;
      peerMirrorTypingRef.current = true;
      setUserTypingState(peerId, true, TYPING_IDLE_MS + 2_000);
    }, 2_500);
    return () => {
      window.clearTimeout(startMirror);
      window.clearInterval(renewMirror);
    };
  }, [
    bothParticipantsInChat,
    isComposeTyping,
    messageText,
    selectedUser,
    selectedPeerId,
    setUserTypingState,
  ]);

  React.useEffect(() => {
    stickToBottomRef.current = true;
    requestAnimationFrame(() => scrollToBottom('auto'));
  }, [selectedChatId]);

  const lastThreadActivityKey = React.useMemo(() => {
    if (!selectedChatId) return '';
    const last = currentMessages[currentMessages.length - 1];
    const ts = getMessageTimestampMs(last?.timestamp);
    const id = typeof last?.id === 'string' ? last.id : '';
    return `${selectedChatId}:${currentMessages.length}:${id}:${ts}:${isPeerTyping ? 'typing' : ''}`;
  }, [selectedChatId, currentMessages, isPeerTyping]);

  React.useEffect(() => {
    if (!selectedChatId || !stickToBottomRef.current) return;
    requestAnimationFrame(() => scrollToBottom('smooth'));
  }, [lastThreadActivityKey, selectedChatId]);

  const markChatReadUpToLatest = React.useCallback((chatId: string, thread: ChatMessage[]) => {
    if (!thread.length) return;
    let newestTimestamp = newestMessageTimestampMs(thread);
    if (newestTimestamp <= 0) {
      newestTimestamp = Date.now();
    }
    setChatLastReadAt((prev) => {
      const previousReadAt = prev[chatId] || 0;
      if (newestTimestamp <= previousReadAt) return prev;
      return { ...prev, [chatId]: newestTimestamp };
    });
  }, []);

  const handleToggleIncomingReadStatus = React.useCallback(
    (msg: ChatMessage) => {
      if (!selectedChatId || msg.isAuthor || !bothParticipantsInChat) return;
      const messageTimestamp = getMessageTimestampMs(msg.timestamp);
      if (messageTimestamp <= 0) return;
      const isRead =
        messageTimestamp > 0 &&
        incomingReadLabelWatermark >= messageTimestamp;
      if (isRead) {
        const nextReadAt = Math.max(0, messageTimestamp - 1);
        setChatLastReadAt((prev) => {
          if ((prev[selectedChatId] || 0) === nextReadAt) return prev;
          return { ...prev, [selectedChatId]: nextReadAt };
        });
        db.setChatReadAt(selectedChatId, nextReadAt, { allowDecrease: true });
        return;
      }
      setChatLastReadAt((prev) => {
        const previousReadAt = prev[selectedChatId] || 0;
        if (messageTimestamp <= previousReadAt) return prev;
        return { ...prev, [selectedChatId]: messageTimestamp };
      });
      db.setChatReadAt(selectedChatId, messageTimestamp);
    },
    [db, selectedChatId, chatLastReadAt, bothParticipantsInChat, incomingReadLabelWatermark]
  );

  useEffect(() => {
    if (!selectedChatId || !viewerInDirectChat) return;
    markChatReadUpToLatest(selectedChatId, currentMessages);
  }, [selectedChatId, viewerInDirectChat, markChatReadUpToLatest, currentMessages]);

  useEffect(() => {
    if (!selectedChatId || !stickToBottomRef.current || !viewerInDirectChat) return;
    markChatReadUpToLatest(selectedChatId, currentMessages);
  }, [
    selectedChatId,
    viewerInDirectChat,
    lastThreadActivityKey,
    currentMessages,
    markChatReadUpToLatest,
  ]);

  const advancePeerReadUpToLatest = React.useCallback(
    (chatId: string, thread: ChatMessage[]) => {
      const outgoing = thread.filter((message) => message?.isAuthor);
      if (!outgoing.length) return;
      let newestOutgoingTimestamp = newestMessageTimestampMs(outgoing);
      if (newestOutgoingTimestamp <= 0) {
        newestOutgoingTimestamp = Date.now();
      }
      const persistedPeerReadAt = db.getChatPeerReadAt(chatId);
      const targetPeerReadAt = Math.max(newestOutgoingTimestamp, persistedPeerReadAt);
      setChatPeerReadAt((prev) => {
        const previous = prev[chatId] || 0;
        if (targetPeerReadAt <= previous) return prev;
        return { ...prev, [chatId]: targetPeerReadAt };
      });
    },
    [db]
  );

  useEffect(() => {
    if (!selectedUser || 'isGroup' in selectedUser || !selectedChatId) return;
    if (!bothParticipantsInChat) return;
    advancePeerReadUpToLatest(selectedChatId, currentMessages);
    const timerId = window.setTimeout(() => {
      advancePeerReadUpToLatest(selectedChatId, currentMessages);
    }, 400);
    return () => window.clearTimeout(timerId);
  }, [
    selectedUser,
    selectedChatId,
    bothParticipantsInChat,
    lastThreadActivityKey,
    advancePeerReadUpToLatest,
    currentMessages,
  ]);

  useEffect(() => {
    if (!selectedChatId) {
      wallpaperHydratedChatRef.current = null;
      setChatWallpaper('default');
      setCustomWallpapers([]);
      return;
    }
    const saved = db.getChatWallpaper(selectedChatId);
    const savedWallpapers = Array.isArray(saved?.customWallpapers)
      ? saved.customWallpapers.filter(
          (item): item is { id: string; kind: 'image' | 'video'; value: string; label: string } =>
            !!item &&
            typeof item === 'object' &&
            typeof (item as { id?: unknown }).id === 'string' &&
            ((item as { kind?: unknown }).kind === 'image' || (item as { kind?: unknown }).kind === 'video') &&
            typeof (item as { value?: unknown }).value === 'string' &&
            typeof (item as { label?: unknown }).label === 'string'
        )
      : [];
    setCustomWallpapers(savedWallpapers);
    setChatWallpaper(typeof saved?.selectedId === 'string' && saved.selectedId.length > 0 ? saved.selectedId : 'default');
    wallpaperHydratedChatRef.current = selectedChatId;
  }, [db, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId) return;
    if (wallpaperHydratedChatRef.current !== selectedChatId) return;
    db.setChatWallpaper(selectedChatId, {
      selectedId: chatWallpaper,
      customWallpapers,
    });
  }, [db, selectedChatId, chatWallpaper, customWallpapers]);

  const pinnedMessages = React.useMemo(() => (
    currentMessages
      .filter((message: ChatMessage) => !!message?.isPinned && typeof message?.id === 'string')
      .sort((a: ChatMessage, b: ChatMessage) => {
        const aTs = typeof a?.pinnedAt === 'number' ? a.pinnedAt : 0;
        const bTs = typeof b?.pinnedAt === 'number' ? b.pinnedAt : 0;
        return bTs - aTs;
      })
  ), [currentMessages]);

  const galleryItems = React.useMemo(() => {
    const items: Array<{
      url: string;
      isVideo: boolean;
      isAudio?: boolean;
      name?: string;
      sourceText?: string;
      authorLabel?: string;
    }> = [];
    currentMessages.forEach((message: ChatMessage) => {
      const messageMedia = Array.isArray(message?.media)
        ? (message.media as MessageMediaAttachment[])
        : [];
      if (messageMedia.length === 0) return;
      messageMedia.forEach((media) => {
        if (!media || typeof media.url !== 'string' || media.url.length === 0) return;
        items.push({
          url: media.url,
          isVideo: !!media.isVideo,
          isAudio: !!media.isAudio,
          name: media.name,
          sourceText: typeof message?.text === 'string' ? message.text : '',
          authorLabel: message?.isAuthor
            ? `${currentUser.displayName} ${currentUser.username}`
            : `${selectedUser?.displayName || ''} ${selectedUser?.username || ''}`,
        });
      });
    });
    return items;
  }, [currentMessages, currentUser.displayName, currentUser.username, selectedUser?.displayName, selectedUser?.username]);

  const activeCustomWallpaper = React.useMemo(
    () => customWallpapers.find((item) => item.id === chatWallpaper) || null,
    [customWallpapers, chatWallpaper]
  );
  const videoWallpaperSequence = React.useMemo(
    () => customWallpapers.filter((item) => item.kind === 'video'),
    [customWallpapers]
  );
  const playNextVideoWallpaper = React.useCallback(() => {
    if (videoWallpaperSequence.length === 0) return;
    const currentIndex = videoWallpaperSequence.findIndex((item) => item.id === chatWallpaper);
    if (currentIndex === -1) {
      setChatWallpaper(videoWallpaperSequence[0].id);
      return;
    }
    const nextIndex = (currentIndex + 1) % videoWallpaperSequence.length;
    setChatWallpaper(videoWallpaperSequence[nextIndex].id);
  }, [videoWallpaperSequence, chatWallpaper]);

  const handleWallpaperUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files ? Array.from(event.target.files) : [];
    if (fileList.length === 0) return;

    const uploaded: Array<{
      id: string;
      kind: 'image' | 'video';
      value: string;
      label: string;
    }> = [];

    for (let index = 0; index < fileList.length; index += 1) {
      const file = fileList[index];
      const mimeType = typeof file.type === 'string' ? file.type : '';
      if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) continue;
      try {
        const value = await fileToBase64(file);
        uploaded.push({
          id: `custom-wallpaper-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
          kind: mimeType.startsWith('video/') ? 'video' : 'image',
          value,
          label: file.name || `Wallpaper ${index + 1}`,
        });
      } catch {
        showToast(`Failed to load ${file.name}`);
      }
    }

    if (uploaded.length > 0) {
      setCustomWallpapers((prev) => [...uploaded, ...prev].slice(0, 24));
      setChatWallpaper(uploaded[0].id);
      showToast(`${uploaded.length} wallpaper file${uploaded.length > 1 ? 's' : ''} added`);
    } else {
      showToast('No valid image/video files selected');
    }

    event.target.value = '';
  };

  const removeCustomWallpaper = (wallpaperId: string) => {
    setCustomWallpapers((prev) => prev.filter((item) => item.id !== wallpaperId));
    if (chatWallpaper === wallpaperId) {
      setChatWallpaper('default');
    }
  };

  const getWallpaperStyle = (): React.CSSProperties | undefined => {
    if (activeCustomWallpaper?.kind === 'image') {
      return {
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.28) 100%), url(${activeCustomWallpaper.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    if (activeCustomWallpaper?.kind === 'video') {
      return {
        background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.35) 100%)',
      };
    }
    if (chatWallpaper === 'ocean') {
      return { background: 'linear-gradient(180deg, rgba(56,189,248,0.12) 0%, rgba(30,64,175,0.08) 100%)' };
    }
    if (chatWallpaper === 'sunset') {
      return { background: 'linear-gradient(180deg, rgba(251,146,60,0.14) 0%, rgba(217,70,239,0.1) 100%)' };
    }
    if (chatWallpaper === 'forest') {
      return { background: 'linear-gradient(180deg, rgba(34,197,94,0.12) 0%, rgba(22,101,52,0.08) 100%)' };
    }
    return undefined;
  };

  const getChatUnreadCount = (chatId: string) =>
    computeChatUnreadCount(messages, chatLastReadAt, chatId);

  const getMessageConversationText = (message: ChatMessage) => {
    const textParts: string[] = [];
    if (typeof message?.text === 'string' && message.text.trim()) {
      textParts.push(message.text);
    }
    if (typeof message?.replyTo?.text === 'string' && message.replyTo.text.trim()) {
      textParts.push(message.replyTo.text);
    }
    if (Array.isArray(message?.replyToMany)) {
      message.replyToMany.forEach((item) => {
        if (typeof item?.text === 'string' && item.text.trim()) {
          textParts.push(item.text);
        }
      });
    }
    if (Array.isArray(message?.forwardedBundle)) {
      message.forwardedBundle.forEach((item) => {
        const bundleItem = item as MessageReplyRef & { from?: string };
        if (typeof bundleItem.text === 'string' && bundleItem.text.trim()) {
          textParts.push(bundleItem.text);
        }
        if (typeof bundleItem.from === 'string' && bundleItem.from.trim()) {
          textParts.push(bundleItem.from);
        }
      });
    }
    if (Array.isArray(message?.media)) {
      message.media.forEach((item) => {
        const mediaItem = item as MessageMediaAttachment;
        if (typeof mediaItem.name === 'string' && mediaItem.name.trim()) {
          textParts.push(mediaItem.name);
        }
      });
    }
    return textParts.join(' ');
  };

  const getMessageAuthorLabel = (message: ChatMessage) => (
    message?.isAuthor ? `${currentUser.displayName} ${currentUser.username}` : `${selectedUser?.displayName || ''} ${selectedUser?.username || ''}`
  );

  const filteredGroups = React.useMemo(() => {
    if (!sidebarSearchQuery.trim()) return groups;
    const { term } = parseSearchQuery(sidebarSearchQuery);
    return groups.filter((group) => (`${group.displayName} ${group.username} ${group.id}`).toLowerCase().includes(term));
  }, [groups, sidebarSearchQuery]);

  const filteredUsers = React.useMemo(() => {
    if (!sidebarSearchQuery.trim()) return USERS;
    const { term, mode } = parseSearchQuery(sidebarSearchQuery);
    if (mode === 'tag') return [];
    return USERS.filter((user) => (`${user.displayName} ${user.username} ${user.id}`).toLowerCase().includes(term));
  }, [USERS, sidebarSearchQuery]);

  const filteredNewMessageUsers = React.useMemo(() => {
    const query = newMessageSearchQuery.trim().toLowerCase();
    if (!query) return USERS;
    return USERS.filter((user) =>
      (`${user.displayName} ${user.username} ${user.id}`).toLowerCase().includes(query)
    );
  }, [USERS, newMessageSearchQuery]);

  const filteredNewGroupUsers = React.useMemo(() => {
    const query = newGroupSearchQuery.trim().toLowerCase();
    if (!query) return USERS;
    return USERS.filter((user) =>
      (`${user.displayName} ${user.username} ${user.id}`).toLowerCase().includes(query)
    );
  }, [USERS, newGroupSearchQuery]);

  const selectedGroupMembers = React.useMemo(() => {
    if (!selectedGroup || !Array.isArray(selectedGroup.memberIds)) return [];
    return selectedGroup.memberIds
      .map((memberId: string) => findUserById(USERS, memberId))
      .filter((user): user is User => !!user);
  }, [selectedGroup, USERS]);

  const selectedGroupMemberSet = React.useMemo(
    () => new Set((selectedGroup?.memberIds || []) as string[]),
    [selectedGroup?.memberIds]
  );

  const filteredGroupMembers = React.useMemo(() => {
    const query = groupManageSearchQuery.trim().toLowerCase();
    if (!query) return selectedGroupMembers;
    return selectedGroupMembers.filter((user) =>
      (`${user.displayName} ${user.username} ${user.id}`).toLowerCase().includes(query)
    );
  }, [selectedGroupMembers, groupManageSearchQuery]);

  const filteredAddableGroupUsers = React.useMemo(() => {
    const query = groupAddUsersSearchQuery.trim().toLowerCase();
    const candidates = USERS.filter((user) => !selectedGroupMemberSet.has(user.id));
    if (!query) return candidates;
    return candidates.filter((user) =>
      (`${user.displayName} ${user.username} ${user.id}`).toLowerCase().includes(query)
    );
  }, [USERS, selectedGroupMemberSet, groupAddUsersSearchQuery]);

  const filteredModerationMembers = React.useMemo(() => {
    const query = groupModerationSearchQuery.trim().toLowerCase();
    if (!query) return selectedGroupMembers;
    return selectedGroupMembers.filter((user) =>
      (`${user.displayName} ${user.username} ${user.id}`).toLowerCase().includes(query)
    );
  }, [selectedGroupMembers, groupModerationSearchQuery]);

  const selectedGroupAdminSet = React.useMemo(() => {
    if (!selectedGroup) return new Set<string>();
    const ownerId = selectedGroup.createdBy || currentUser.id;
    const adminIds = safeIdArray(selectedGroup?.adminIds);
    return new Set<string>([ownerId, ...adminIds]);
  }, [selectedGroup, currentUser.id]);

  const parsedChatSearchQuery = React.useMemo(() => parseSearchQuery(chatSearchQuery), [chatSearchQuery]);
  const parsedPinnedSearchQuery = React.useMemo(() => parseSearchQuery(pinnedSearchQuery), [pinnedSearchQuery]);
  const parsedGallerySearchQuery = React.useMemo(() => parseSearchQuery(gallerySearchQuery), [gallerySearchQuery]);

  const visibleMessageEntries = React.useMemo(() => {
    if (!chatSearchQuery.trim()) {
      return currentMessages.map((msg: ChatMessage, index: number) => ({ msg, index }));
    }
    return currentMessages
      .map((msg: ChatMessage, index: number) => ({ msg, index }))
      .filter(({ msg }: { msg: ChatMessage; index: number }) => {
        const conversationText = getMessageConversationText(msg);
        const author = getMessageAuthorLabel(msg);
        if (matchByQuery(conversationText, chatSearchQuery)) return true;
        return parsedChatSearchQuery.mode === 'all' && author.toLowerCase().includes(parsedChatSearchQuery.term);
      });
  }, [currentMessages, chatSearchQuery, parsedChatSearchQuery, currentUser.displayName, currentUser.username, selectedUser?.displayName, selectedUser?.username]);

  const filteredPinnedMessages = React.useMemo(() => {
    if (!pinnedSearchQuery.trim()) return pinnedMessages;
    return pinnedMessages.filter((message: ChatMessage) => {
      const text = typeof message?.text === 'string' ? message.text : '';
      return matchByQuery(text, pinnedSearchQuery) || (`${getMessageAuthorLabel(message)}`.toLowerCase().includes(parsedPinnedSearchQuery.term));
    });
  }, [pinnedMessages, pinnedSearchQuery, parsedPinnedSearchQuery, currentUser.displayName, currentUser.username, selectedUser?.displayName, selectedUser?.username]);

  const filteredGalleryItems = React.useMemo(() => {
    if (!gallerySearchQuery.trim()) return galleryItems;
    return galleryItems.filter((item) => {
      const sourceText = typeof item.sourceText === 'string' ? item.sourceText : '';
      const author = typeof item.authorLabel === 'string' ? item.authorLabel : '';
      if (matchByQuery(sourceText, gallerySearchQuery)) return true;
      return parsedGallerySearchQuery.mode === 'all' && author.toLowerCase().includes(parsedGallerySearchQuery.term);
    });
  }, [galleryItems, gallerySearchQuery, parsedGallerySearchQuery]);

  const getMessageReactionKey = (msg: ChatMessage, index: number) => {
    if (typeof msg?.id === 'string' && msg.id.length > 0) {
      return `${selectedChatId || 'chat'}:${msg.id}`;
    }
    const ts = typeof msg?.timestamp === 'number' || typeof msg?.timestamp === 'string'
      ? msg.timestamp
      : `no-ts-${index}`;
    return `${selectedChatId || 'chat'}:${ts}:${index}`;
  };

  const getMessageSelectionKey = (msg: ChatMessage, index: number) => getMessageReactionKey(msg, index);

  const toggleMessageSelection = (msg: ChatMessage, index: number) => {
    const key = getMessageSelectionKey(msg, index);
    setSelectedMessageKeys((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    ));
  };

  const handleSelectAllMessages = () => {
    const allKeys = currentMessages.map((msg: ChatMessage, index: number) => getMessageSelectionKey(msg, index));
    setSelectedMessageKeys(allKeys);
    setOpenMessageMenuKey(null);
  };

  const handleToggleSelectAllMessages = () => {
    if (selectedMessageKeys.length >= currentMessages.length && currentMessages.length > 0) {
      setSelectedMessageKeys([]);
      return;
    }
    handleSelectAllMessages();
  };

  const getSelectedMessageEntries = () => {
    const selectedSet = new Set(selectedMessageKeys);
    return currentMessages
      .map((msg: ChatMessage, index: number) => ({ msg, index, key: getMessageSelectionKey(msg, index) }))
      .filter((entry: { key: string }) => selectedSet.has(entry.key));
  };

  const toggleMessageReaction = (messageIndex: number, emoji: string) => {
    if (!selectedChatId) return;
    db.toggleMessageReaction(selectedChatId, messageIndex, emoji);
  };

  const handleReplyMessage = (msg: ChatMessage, messageIndex: number) => {
    const media = Array.isArray(msg?.media) ? (msg.media as MessageMediaAttachment[]) : [];
    const previewText = getReplyPreviewLabel(
      typeof msg?.text === 'string' ? msg.text : undefined,
      media,
      msg
    );
    setReplyToMessage({ index: messageIndex, text: previewText });
    setReplyToMessages([]);
    setOpenMessageMenuKey(null);
    requestAnimationFrame(() => messageInputRef.current?.focus());
  };

  const handleForwardMessage = (msg: ChatMessage) => {
    if (!selectedChatId) return;
    const sourceText = typeof msg?.text === 'string' ? msg.text : '';
    db.addMessage(selectedChatId, {
      text: sourceText ? `Forwarded: ${sourceText}` : 'Forwarded message',
      isAuthor: true,
      timestamp: Date.now(),
      media: Array.isArray(msg?.media) ? msg.media : undefined,
    });
    setOpenMessageMenuKey(null);
    showToast('Message forwarded');
  };

  const handleDeleteForMe = (messageIndex: number) => {
    if (!selectedChatId) return;
    db.deleteMessage(selectedChatId, messageIndex);
    setOpenMessageMenuKey(null);
    if (editingMessageIndex === messageIndex) {
      setEditingMessageIndex(null);
      setMessageText('');
    }
    if (replyToMessage?.index === messageIndex) {
      setReplyToMessage(null);
    }
  };

  const handleDeleteForEveryone = (msg: ChatMessage, messageIndex: number) => {
    if (!selectedChatId) return;
    if (!msg?.isAuthor) {
      showToast('You can only delete your own messages for everyone.');
      setOpenMessageMenuKey(null);
      return;
    }
    if (msg?.isDeleted) {
      setOpenMessageMenuKey(null);
      return;
    }
    db.deleteMessage(selectedChatId, messageIndex);
    setOpenMessageMenuKey(null);
    if (editingMessageIndex === messageIndex) {
      setEditingMessageIndex(null);
      setMessageText('');
    }
    if (replyToMessage?.index === messageIndex) {
      setReplyToMessage(null);
    }
    showToast('Message deleted for everyone');
  };

  const handleEditMessage = (msg: ChatMessage, messageIndex: number) => {
    if (!msg?.isAuthor) {
      showToast('You can only edit your own messages.');
      setOpenMessageMenuKey(null);
      return;
    }
    setReplyToMessage(null);
    setReplyToMessages([]);
    setEditingMessageIndex(messageIndex);
    setMessageText(typeof msg?.text === 'string' ? msg.text : '');
    setOpenMessageMenuKey(null);
    requestAnimationFrame(() => messageInputRef.current?.focus());
  };

  const handleCopyMessage = async (msg: ChatMessage) => {
    const text = typeof msg?.text === 'string' ? msg.text : '';
    if (!text.trim()) {
      showToast('No text to copy');
      setOpenMessageMenuKey(null);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('Message copied');
    } catch {
      showToast('Unable to copy message');
    } finally {
      setOpenMessageMenuKey(null);
    }
  };

  const handleTogglePinMessage = (msg: ChatMessage, messageIndex: number) => {
    if (!selectedChatId) return;
    db.updateMessage(selectedChatId, messageIndex, (current) => ({
      ...current,
      isPinned: !current?.isPinned,
      pinnedAt: !current?.isPinned ? Date.now() : null,
    }));
    setOpenMessageMenuKey(null);
  };

  const handleSelectionReply = () => {
    const selected = getSelectedMessageEntries();
    if (selected.length === 0) {
      showToast('Select at least one message to reply.');
      return;
    }
    const replies = [...selected]
      .sort((a, b) => a.index - b.index)
      .map((entry) => {
        const media = Array.isArray(entry.msg?.media)
          ? (entry.msg.media as MessageMediaAttachment[])
          : [];
        const previewText = getReplyPreviewLabel(
          typeof entry.msg?.text === 'string' ? entry.msg.text : undefined,
          media,
          entry.msg
        );
        return {
          index: entry.index,
          text: previewText,
          hasMedia: media.length > 0,
          media,
          hasShareLink: typeof previewText === 'string' && isShareLinkMessage(previewText),
          sourceMessageId: typeof entry.msg?.id === 'string' ? entry.msg.id : undefined,
        };
      });
    setReplyToMessage(null);
    setReplyToMessages(replies);
    setOpenMessageMenuKey(null);
    requestAnimationFrame(() => messageInputRef.current?.focus());
    setSelectedMessageKeys([]);
  };

  const handleSelectionForward = () => {
    const selected = getSelectedMessageEntries();
    if (selected.length === 0) {
      showToast('Select at least one message to forward.');
      return;
    }

    const ordered = [...selected].sort((a, b) => a.index - b.index);
    const forwardedLines = ordered.map((entry, lineIndex) => {
      const media = Array.isArray(entry.msg?.media)
        ? (entry.msg.media as MessageMediaAttachment[])
        : [];
      const label = getReplyPreviewLabel(
        typeof entry.msg?.text === 'string' ? entry.msg.text : undefined,
        media,
        entry.msg
      );
      return `${lineIndex + 1}. ${label}`;
    });
    const forwardedBundle = ordered.map((entry) => {
      const media = Array.isArray(entry.msg?.media)
        ? (entry.msg.media as MessageMediaAttachment[])
        : [];
      const label = getReplyPreviewLabel(
        typeof entry.msg?.text === 'string' ? entry.msg.text : undefined,
        media,
        entry.msg
      );
      return {
        text: label,
        hasMedia: Array.isArray(entry.msg?.media) && entry.msg.media.length > 0,
        media: Array.isArray(entry.msg?.media) ? entry.msg.media : [],
        hasShareLink:
          typeof entry.msg?.text === 'string' && isShareLinkMessage(entry.msg.text),
        sourceMessageId: typeof entry.msg?.id === 'string' ? entry.msg.id : undefined,
      };
    });

    if (selectedChatId) {
      db.addMessage(selectedChatId, {
        text: `Forwarded (${ordered.length})\n${forwardedLines.join('\n')}`,
        forwardedBundle,
        isAuthor: true,
        timestamp: Date.now(),
      });
      showToast(`Forwarded ${ordered.length} message${ordered.length > 1 ? 's' : ''}`);
    }
    setSelectedMessageKeys([]);
    setOpenMessageMenuKey(null);
  };

  const handleSelectionDeleteForMe = () => {
    if (!selectedChatId) return;
    const selected = getSelectedMessageEntries();
    if (selected.length === 0) return;

    [...selected]
      .sort((a, b) => b.index - a.index)
      .forEach((entry) => db.deleteMessage(selectedChatId, entry.index));
    setSelectedMessageKeys([]);
    setOpenMessageMenuKey(null);
  };

  const handleSelectionDeleteForEveryone = () => {
    if (!selectedChatId) return;
    const selected = getSelectedMessageEntries();
    if (selected.length === 0) return;

    const own = selected.filter((entry) => entry.msg?.isAuthor);
    if (own.length === 0) {
      showToast('Select your own messages to delete for everyone.');
      return;
    }

    [...own]
      .sort((a, b) => b.index - a.index)
      .forEach((entry) => db.deleteMessage(selectedChatId, entry.index));

    if (own.length < selected.length) {
      showToast('Some selected messages were skipped (not yours).');
    }
    setSelectedMessageKeys([]);
    setOpenMessageMenuKey(null);
  };

  const handleSelectionCopy = async () => {
    const selected = getSelectedMessageEntries();
    if (selected.length === 0) return;

    const lines = [...selected]
      .sort((a, b) => a.index - b.index)
      .map((entry, lineIndex) => {
        const text = typeof entry.msg?.text === 'string' ? entry.msg.text.trim() : '';
        return `${lineIndex + 1}. ${text || 'Voice/Media message'}`;
      });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast(`Copied ${selected.length} message${selected.length > 1 ? 's' : ''}`);
    } catch {
      showToast('Unable to copy selected messages');
    }
  };

  const handleSelectionPin = () => {
    if (!selectedChatId) return;
    const selected = getSelectedMessageEntries();
    if (selected.length === 0) return;

    const allPinned = selected.every((entry) => !!entry.msg?.isPinned);
    selected.forEach((entry) => {
      db.updateMessage(selectedChatId, entry.index, (current) => ({
        ...current,
        isPinned: !allPinned,
        pinnedAt: !allPinned ? Date.now() : null,
      }));
    });
    showToast(allPinned ? 'Selected messages unpinned' : 'Selected messages pinned');
  };

  const decideReactionPickerDirection = (targetElement: HTMLElement) => {
    const rect = targetElement.getBoundingClientRect();
    const panelApproxHeight = 340;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow >= panelApproxHeight || spaceBelow >= spaceAbove) {
      return 'down' as const;
    }
    return 'up' as const;
  };

  const decideMessageMenuDirection = (targetElement: HTMLElement) => {
    const rect = targetElement.getBoundingClientRect();
    const panelApproxHeight = 220;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow >= panelApproxHeight || spaceBelow >= spaceAbove) {
      return 'down' as const;
    }
    return 'up' as const;
  };

  const jumpToOriginalMessage = (sourceMessageId?: string) => {
    if (!sourceMessageId) {
      showToast('Original message not found');
      return;
    }
    const targetElement = messageElementRefs.current[sourceMessageId];
    if (!targetElement) {
      showToast('Original message not found');
      return;
    }
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(sourceMessageId);
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId((current) => (current === sourceMessageId ? null : current));
    }, 1500);
  };

  const hashtagCandidates = React.useMemo(() => {
    const tags = new Set<string>();
    currentMessages.forEach((msg: ChatMessage) => {
      if (typeof msg?.text !== 'string') return;
      const matches = msg.text.match(/#[a-zA-Z0-9_]+/g) || [];
      matches.forEach((tag: string) => tags.add(tag.slice(1).toLowerCase()));
    });
    return Array.from(tags);
  }, [currentMessages]);

  const mentionSuggestions = React.useMemo(() => {
    if (!tokenSuggestion || tokenSuggestion.type !== 'mention') return [] as string[];
    const query = tokenSuggestion.query.toLowerCase();
    return USERS
      .map((user) => user.username)
      .filter((username) => !query || username.toLowerCase().includes(query))
      .slice(0, 6);
  }, [tokenSuggestion, USERS]);

  const hashtagSuggestions = React.useMemo(() => {
    if (!tokenSuggestion || tokenSuggestion.type !== 'hashtag') return [] as string[];
    const query = tokenSuggestion.query.toLowerCase();
    const filtered = hashtagCandidates.filter((tag) => !query || tag.includes(query)).slice(0, 6);
    if (query && !filtered.includes(query)) {
      return [query, ...filtered].slice(0, 6);
    }
    return filtered;
  }, [tokenSuggestion, hashtagCandidates]);

  const activeSuggestions = tokenSuggestion?.type === 'mention' ? mentionSuggestions : hashtagSuggestions;

  const updateTokenSuggestion = (text: string, cursorPosition: number) => {
    const beforeCursor = text.slice(0, cursorPosition);
    const tokenMatch = beforeCursor.match(/(^|[\s])([@#])([a-zA-Z0-9_]*)$/);
    if (!tokenMatch) {
      setTokenSuggestion(null);
      setActiveTokenIndex(0);
      return;
    }

    const marker = tokenMatch[2];
    const query = tokenMatch[3] || '';
    const start = cursorPosition - query.length - 1;
    setTokenSuggestion({
      type: marker === '@' ? 'mention' : 'hashtag',
      query,
      start,
      end: cursorPosition,
    });
    setActiveTokenIndex(0);
  };

  const insertTokenSuggestion = (value: string) => {
    if (!tokenSuggestion) return;
    const marker = tokenSuggestion.type === 'mention' ? '@' : '#';
    const token = `${marker}${value}`;
    const nextText = `${messageText.slice(0, tokenSuggestion.start)}${token} ${messageText.slice(tokenSuggestion.end)}`;
    const nextCursor = tokenSuggestion.start + token.length + 1;

    setMessageText(nextText);
    setTokenSuggestion(null);
    setActiveTokenIndex(0);

    requestAnimationFrame(() => {
      if (messageInputRef.current) {
        messageInputRef.current.focus();
        messageInputRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const { 
    isListening, 
    isRecording, 
    recordedVoice, 
    toggleListening, 
    stopListening,
    startRecording, 
    stopRecording,
    clearRecording
  } = useVoice((text) => setMessageText(text));
  const pressTimer = React.useRef<NodeJS.Timeout | null>(null);
  const micPressActiveRef = React.useRef(false);
  const lastTouchTsRef = React.useRef(0);
  const TOUCH_MOUSE_GUARD_MS = 700;

  const shouldIgnoreSyntheticMouse = (eventType: string) => {
    return eventType.startsWith('mouse') && Date.now() - lastTouchTsRef.current < TOUCH_MOUSE_GUARD_MS;
  };

  const handleMicDown = (event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    if (event.type.startsWith('touch')) {
      lastTouchTsRef.current = Date.now();
    } else if (shouldIgnoreSyntheticMouse(event.type)) {
      return;
    }
    if (micPressActiveRef.current) return;
    micPressActiveRef.current = true;
    pressTimer.current = setTimeout(() => {
      if (isListening) stopListening();
      startRecording();
      pressTimer.current = null;
    }, 500);
  };

  const handleMicUp = (event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    if (event.type.startsWith('touch')) {
      lastTouchTsRef.current = Date.now();
    } else if (shouldIgnoreSyntheticMouse(event.type)) {
      return;
    }
    if (!micPressActiveRef.current) return;
    micPressActiveRef.current = false;
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
      toggleListening();
    } else if (isRecording) {
      stopRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
      micPressActiveRef.current = false;
    };
  }, []);

  return (
    <div
      id="messages-screen"
      data-chat-open={selectedUser ? "true" : "false"}
      data-embedded={embedded ? 'true' : 'false'}
      className={
        embedded
          ? 'w-full h-full flex overflow-hidden bg-background relative'
          : `w-full h-full flex pt-0 md:pt-0 max-w-[935px] mx-auto md:border border-border bg-background md:my-4 rounded-none md:rounded-[32px] overflow-hidden shadow-sm fixed inset-x-0 z-[60] md:relative md:inset-auto md:z-auto md:h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-2rem)] ${
              selectedUser
                ? 'top-[env(safe-area-inset-top)] bottom-0'
                : 'top-[calc(60px+env(safe-area-inset-top))] bottom-[calc(50px+env(safe-area-inset-bottom))]'
            }`
      }
    >
      
      <MessagesSidebar
        chatOpen={!!selectedUser}
        selectedChatId={selectedChatId}
        onSelectChatId={setSelectedChatId}
        onBack={!embedded && !selectedUser ? onBack : undefined}
        showSidebarSearch={showSidebarSearch}
        onToggleSidebarSearch={() => setShowSidebarSearch((prev) => !prev)}
        sidebarSearchQuery={sidebarSearchQuery}
        onSidebarSearchQueryChange={setSidebarSearchQuery}
        onNewMessage={() => setShowNewMessageModal(true)}
        onNewGroup={() => setShowNewGroupModal(true)}
        filteredGroups={filteredGroups}
        filteredUsers={filteredUsers}
        messages={messages}
        getChatUnreadCount={getChatUnreadCount}
        chatLastReadAt={chatLastReadAt}
        chatPeerReadAt={chatPeerReadAt}
        readLabelCapByChatId={readLabelCapByChatId}
        getBothParticipantsInChat={getBothParticipantsInChat}
        getUserTyping={getUserTyping}
        getPersistedPeerReadAt={(chatId) => db.getChatPeerReadAt(chatId)}
        onlineStatusByUserId={onlineStatusByUserId}
        lastSeenByUserId={lastSeenByUserId}
        clockTick={clockTick}
      />

      {!selectedUser ? (
        <MessagesEmptyChat onNewMessage={() => setShowNewMessageModal(true)} />
      ) : (
        <div className="flex flex-col flex-1 bg-background">
          <MessagesChatHeader
            selectedUser={selectedUser}
            clockTick={clockTick}
            isPeerTyping={isPeerTyping}
            onlineStatusByUserId={onlineStatusByUserId}
            lastSeenByUserId={lastSeenByUserId}
            showChatSearch={showChatSearch}
            chatSearchQuery={chatSearchQuery}
            onBack={() => setSelectedChatId(null)}
            onToggleChatSearch={() => setShowChatSearch((prev) => !prev)}
            onChatSearchQueryChange={setChatSearchQuery}
            onAudioCall={() => setActiveCall('audio')}
            onVideoCall={() => setActiveCall('video')}
            onOpenInfo={() => setShowInfoPanel(true)}
          />

          <MessagesChatThread
            selectedUser={selectedUser}
            activeCustomWallpaper={activeCustomWallpaper}
            videoWallpaperSequence={videoWallpaperSequence}
            playNextVideoWallpaper={playNextVideoWallpaper}
            getWallpaperStyle={getWallpaperStyle}
            visibleMessageEntries={visibleMessageEntries}
            chatSearchQuery={chatSearchQuery}
            isPeerTyping={isPeerTyping}
            messagesEndRef={messagesEndRef}
            chatScrollRef={setChatScrollContainerRef}
            chatScrollRoot={chatScrollRoot}
            onChatScroll={handleChatScroll}
            messageElementRefs={messageElementRefs}
            highlightedMessageId={highlightedMessageId}
            selectedMessageKeys={selectedMessageKeys}
            openMessageMenuKey={openMessageMenuKey}
            setOpenMessageMenuKey={setOpenMessageMenuKey}
            messageMenuDirection={messageMenuDirection}
            setMessageMenuDirection={setMessageMenuDirection}
            openReactionPickerKey={openReactionPickerKey}
            setOpenReactionPickerKey={setOpenReactionPickerKey}
            reactionPickerDirection={reactionPickerDirection}
            setReactionPickerDirection={setReactionPickerDirection}
            selectedChatId={selectedChatId}
            chatLastReadAt={chatLastReadAt}
            chatPeerReadAt={chatPeerReadAt}
            incomingReadLabelWatermark={incomingReadLabelWatermark}
            bothParticipantsInChat={bothParticipantsInChat}
            inlineVideoRefs={inlineVideoRefs}
            onViewProfile={handleViewProfile}
            getMessageReactionKey={getMessageReactionKey}
            getMessageSelectionKey={getMessageSelectionKey}
            toggleMessageSelection={toggleMessageSelection}
            decideMessageMenuDirection={decideMessageMenuDirection}
            decideReactionPickerDirection={decideReactionPickerDirection}
            jumpToOriginalMessage={jumpToOriginalMessage}
            setFullscreenMedia={setFullscreenMedia}
            handleSharedItemClick={handleSharedItemClick}
            extractMessageSegments={extractMessageSegments}
            tryOpenMediaFullscreen={tryOpenMediaFullscreen}
            handleAttachmentTokenClick={handleAttachmentTokenClick}
            toggleMessageReaction={toggleMessageReaction}
            handleReplyMessage={handleReplyMessage}
            handleForwardMessage={handleForwardMessage}
            handleCopyMessage={handleCopyMessage}
            handleTogglePinMessage={handleTogglePinMessage}
            handleDeleteForMe={handleDeleteForMe}
            handleDeleteForEveryone={handleDeleteForEveryone}
            handleEditMessage={handleEditMessage}
            handleSelectAllMessages={handleSelectAllMessages}
            onToggleIncomingReadStatus={handleToggleIncomingReadStatus}
            onOpenFilePreview={handleOpenFilePreview}
            onDownloadFile={handleDownloadFile}
            onOpenLocationMap={handleOpenLocationMap}
          />

          <MessagesComposeBar
            chatMedia={chatMedia}
            setChatMedia={setChatMedia}
            selectedMessageKeys={selectedMessageKeys}
            setSelectedMessageKeys={setSelectedMessageKeys}
            currentMessages={currentMessages}
            replyToMessage={replyToMessage}
            setReplyToMessage={setReplyToMessage}
            replyToMessages={replyToMessages}
            setReplyToMessages={setReplyToMessages}
            editingMessageIndex={editingMessageIndex}
            setEditingMessageIndex={setEditingMessageIndex}
            showAttachmentMenu={showAttachmentMenu}
            setShowAttachmentMenu={setShowAttachmentMenu}
            messageText={messageText}
            setMessageText={setMessageText}
            onComposeTypingChange={handleComposeTypingChange}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            isRecording={isRecording}
            recordedVoice={recordedVoice}
            isListening={isListening}
            tokenSuggestion={tokenSuggestion}
            activeSuggestions={activeSuggestions}
            activeTokenIndex={activeTokenIndex}
            setActiveTokenIndex={setActiveTokenIndex}
            messageInputRef={messageInputRef}
            inlineVideoRefs={inlineVideoRefs}
            onSendMessage={handleSendMessage}
            onToggleSelectAllMessages={handleToggleSelectAllMessages}
            onSelectionCopy={handleSelectionCopy}
            onSelectionPin={handleSelectionPin}
            onSelectionReply={handleSelectionReply}
            onSelectionForward={handleSelectionForward}
            onSelectionDeleteForMe={handleSelectionDeleteForMe}
            onSelectionDeleteForEveryone={handleSelectionDeleteForEveryone}
            onMediaUpload={handleMediaUpload}
            onFileUploadMenu={handleFileUploadMenu}
            onMusicUpload={handleMusicUpload}
            onLocationShare={handleLocationShare}
            onOpenFilePreview={handleOpenFilePreview}
            tryOpenMediaFullscreen={tryOpenMediaFullscreen}
            setFullscreenMedia={setFullscreenMedia}
            clearRecording={clearRecording}
            showToast={showToast}
            handleMicDown={handleMicDown}
            handleMicUp={handleMicUp}
            updateTokenSuggestion={updateTokenSuggestion}
            insertTokenSuggestion={insertTokenSuggestion}
            setTokenSuggestion={setTokenSuggestion}
          />
        </div>
      )}

      <AnimatePresence>
        {activeCall && selectedUser && (
          <MessagesActiveCallOverlay
            activeCall={activeCall}
            selectedUser={selectedUser}
            currentUserAvatarUrl={currentUser.avatarUrl}
            onEndCall={() => setActiveCall(null)}
          />
        )}
      </AnimatePresence>

      {/* Modals & Panels */}
      {fullscreenMedia && (
        <ChatFullscreenMediaPortal
          fullscreenMedia={fullscreenMedia}
          globalMuted={db.globalMuted}
          onGlobalMutedChange={(muted) => db.setGlobalMuted(muted)}
          onClose={() => setFullscreenMedia(null)}
          onMediaIndexChange={(index) => {
            stopAllChatMedia(inlineVideoRefs.current);
            setFullscreenMedia((prev) => (prev ? { ...prev, mediaIndex: index } : null));
          }}
          inlineVideoRefs={inlineVideoRefs}
        />
      )}

      {filePreviewMedia && (
        <ChatFilePreviewPortal
          media={filePreviewMedia}
          onClose={() => setFilePreviewMedia(null)}
          onDownloadFailed={() => showToast('Could not save file')}
        />
      )}

      {locationMapPreview && (
        <ChatLocationMapPortal
          location={locationMapPreview}
          onClose={() => setLocationMapPreview(null)}
        />
      )}

      <ChatLocationShareSheet
        open={showLocationShareSheet}
        onClose={() => setShowLocationShareSheet(false)}
        onSend={handleSendLocation}
      />

      <MessagesScreenOverlays
        currentUser={currentUser}
        selectedUser={selectedUser}
        selectedGroup={selectedGroup}
        selectedGroupAdminSet={selectedGroupAdminSet}
        showNewMessageModal={showNewMessageModal}
        setShowNewMessageModal={setShowNewMessageModal}
        newMessageSearchQuery={newMessageSearchQuery}
        setNewMessageSearchQuery={setNewMessageSearchQuery}
        filteredNewMessageUsers={filteredNewMessageUsers}
        setSelectedChatId={setSelectedChatId}
        showNewGroupModal={showNewGroupModal}
        setShowNewGroupModal={setShowNewGroupModal}
        resetNewGroupForm={resetNewGroupForm}
        newGroupName={newGroupName}
        setNewGroupName={setNewGroupName}
        newGroupSearchQuery={newGroupSearchQuery}
        setNewGroupSearchQuery={setNewGroupSearchQuery}
        newGroupAvatar={newGroupAvatar}
        groupAvatarInputRef={groupAvatarInputRef}
        handleGroupAvatarUpload={handleGroupAvatarUpload}
        selectedGroupMemberIds={selectedGroupMemberIds}
        filteredNewGroupUsers={filteredNewGroupUsers}
        toggleGroupMemberSelection={toggleGroupMemberSelection}
        onCreateGroup={handleCreateGroup}
        showInfoPanel={showInfoPanel}
        setShowInfoPanel={setShowInfoPanel}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        setShowGroupSettingsScreen={setShowGroupSettingsScreen}
        setShowPinnedMessagesScreen={setShowPinnedMessagesScreen}
        pinnedMessages={pinnedMessages}
        chatWallpaper={chatWallpaper}
        setChatWallpaper={setChatWallpaper}
        customWallpapers={customWallpapers}
        wallpaperInputRef={wallpaperInputRef}
        handleWallpaperUpload={handleWallpaperUpload}
        removeCustomWallpaper={removeCustomWallpaper}
        galleryItems={galleryItems}
        setShowGalleryScreen={setShowGalleryScreen}
        handleLeaveGroup={handleLeaveGroup}
        handleDeleteGroup={handleDeleteGroup}
        showToast={showToast}
        blockUser={db.blockUser}
        showGroupSettingsScreen={showGroupSettingsScreen}
        setShowGroupModerationScreen={setShowGroupModerationScreen}
        setShowGroupAddUsersScreen={setShowGroupAddUsersScreen}
        groupSettingsAvatarInputRef={groupSettingsAvatarInputRef}
        handleGroupSettingsAvatarUpload={handleGroupSettingsAvatarUpload}
        groupNameDraft={groupNameDraft}
        setGroupNameDraft={setGroupNameDraft}
        handleSaveGroupName={handleSaveGroupName}
        groupManageSearchQuery={groupManageSearchQuery}
        setGroupManageSearchQuery={setGroupManageSearchQuery}
        filteredGroupMembers={filteredGroupMembers}
        handleRemoveGroupMember={handleRemoveGroupMember}
        showGroupAddUsersScreen={showGroupAddUsersScreen}
        groupAddUsersSearchQuery={groupAddUsersSearchQuery}
        setGroupAddUsersSearchQuery={setGroupAddUsersSearchQuery}
        filteredAddableGroupUsers={filteredAddableGroupUsers}
        handleAddGroupMember={handleAddGroupMember}
        showGroupModerationScreen={showGroupModerationScreen}
        groupModerationSearchQuery={groupModerationSearchQuery}
        setGroupModerationSearchQuery={setGroupModerationSearchQuery}
        filteredModerationMembers={filteredModerationMembers}
        toggleGroupModerationSetting={toggleGroupModerationSetting}
        toggleGroupAdminMember={toggleGroupAdminMember}
        toggleMuteGroupMember={toggleMuteGroupMember}
        showPinnedMessagesScreen={showPinnedMessagesScreen}
        showPinnedSearch={showPinnedSearch}
        setShowPinnedSearch={setShowPinnedSearch}
        pinnedSearchQuery={pinnedSearchQuery}
        setPinnedSearchQuery={setPinnedSearchQuery}
        filteredPinnedMessages={filteredPinnedMessages}
        jumpToOriginalMessage={jumpToOriginalMessage}
        showGalleryScreen={showGalleryScreen}
        showGallerySearch={showGallerySearch}
        setShowGallerySearch={setShowGallerySearch}
        gallerySearchQuery={gallerySearchQuery}
        setGallerySearchQuery={setGallerySearchQuery}
        filteredGalleryItems={filteredGalleryItems}
        tryOpenMediaFullscreen={tryOpenMediaFullscreen}
        inlineVideoRefs={inlineVideoRefs}
      />
    </div>
  );
}
