import { ArrowLeft, Edit, Search, Users } from 'lucide-react';
import type { ChatGroup, ChatMessage, User } from '../../types';
import { handleAvatarError } from '../../lib/utils';
import { formatLastSeenLabel } from './messages/messageTime';
import {
  getEffectivePeerReadAt,
  getIncomingReadLabelWatermark,
  isIncomingMessageReadForDisplay,
  isOutgoingMessageSeen,
} from './messages/chatReadReceipts';
import { getChatMessagePreviewText } from './messages/chatFileUtils';

export type MessagesSidebarProps = {
  chatOpen: boolean;
  selectedChatId: string | null;
  onSelectChatId: (chatId: string) => void;
  onBack?: () => void;
  showSidebarSearch: boolean;
  onToggleSidebarSearch: () => void;
  sidebarSearchQuery: string;
  onSidebarSearchQueryChange: (value: string) => void;
  onNewMessage: () => void;
  onNewGroup: () => void;
  filteredGroups: ChatGroup[];
  filteredUsers: User[];
  messages: Record<string, ChatMessage[]>;
  getChatUnreadCount: (chatId: string) => number;
  chatLastReadAt: Record<string, number>;
  chatPeerReadAt: Record<string, number>;
  readLabelCapByChatId: Record<string, number>;
  getBothParticipantsInChat: (chatId: string) => boolean;
  getUserTyping: (userId: string) => boolean;
  getPersistedPeerReadAt: (chatId: string) => number;
  onlineStatusByUserId: Record<string, boolean>;
  lastSeenByUserId: Record<string, number>;
  clockTick: number;
};

export function MessagesSidebar({
  chatOpen,
  selectedChatId,
  onSelectChatId,
  onBack,
  showSidebarSearch,
  onToggleSidebarSearch,
  sidebarSearchQuery,
  onSidebarSearchQueryChange,
  onNewMessage,
  onNewGroup,
  filteredGroups,
  filteredUsers,
  messages,
  getChatUnreadCount,
  chatLastReadAt,
  chatPeerReadAt,
  readLabelCapByChatId,
  getBothParticipantsInChat,
  getUserTyping,
  getPersistedPeerReadAt,
  onlineStatusByUserId,
  lastSeenByUserId,
  clockTick,
}: MessagesSidebarProps) {
  const sidebarReceiptLabel = (
    chatId: string,
    lastMessage: ChatMessage | null,
    unreadCount: number
  ): string | null => {
    if (unreadCount > 0 || !lastMessage) return null;
    const bothInChat = getBothParticipantsInChat(chatId);
    const incomingWatermark = getIncomingReadLabelWatermark(
      chatId,
      chatLastReadAt,
      readLabelCapByChatId,
      bothInChat
    );
    const peerReadAt = getEffectivePeerReadAt(chatId, chatPeerReadAt, getPersistedPeerReadAt(chatId));
    if (lastMessage.isAuthor) {
      return isOutgoingMessageSeen(lastMessage.timestamp, peerReadAt, bothInChat) ? 'Seen' : 'Sent';
    }
    return isIncomingMessageReadForDisplay(lastMessage.timestamp, incomingWatermark, bothInChat)
      ? 'Read'
      : 'Unread';
  };
  return (
    <div
      className={`w-full md:w-[250px] lg:w-[350px] border-r border-border flex flex-col bg-card shrink-0 ${chatOpen ? 'hidden md:flex' : 'flex'}`}
    >
      <div className="h-[75px] border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0 z-[60]">
        <div className="flex items-center gap-3 min-w-0">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden p-2 -ml-2 hover:bg-secondary rounded-full transition-colors shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : null}
          <span className="font-black text-[20px] tracking-tight truncate">Messages</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleSidebarSearch}
            className="hover:bg-secondary p-2.5 rounded-full transition-colors group"
            title="Search"
          >
            <Search className="w-5 h-5 group-hover:text-primary transition-colors" />
          </button>
          <button
            type="button"
            onClick={onNewGroup}
            className="hover:bg-secondary p-2.5 rounded-full transition-colors group"
            title="New Group"
          >
            <Users className="w-5 h-5 group-hover:text-primary transition-colors" />
          </button>
          <button
            type="button"
            onClick={onNewMessage}
            className="hover:bg-secondary p-2.5 rounded-full transition-colors group"
            title="New Message"
          >
            <Edit className="w-5 h-5 group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>
      {showSidebarSearch && (
        <div className="px-4 sm:px-6 py-2 border-b border-border bg-card/80 backdrop-blur-sm">
          <input
            type="text"
            value={sidebarSearchQuery}
            onChange={(e) => onSidebarSearchQueryChange(e.target.value)}
            placeholder="Search with #, @, name..."
            className="w-full bg-secondary outline-none px-3 py-2 rounded-xl text-sm font-medium"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar py-2">
        <div className="px-6 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Groups
        </div>
        {filteredGroups.map((group) => {
          const groupMessages = Array.isArray(messages[group.id]) ? messages[group.id] : [];
          const lastMessage = groupMessages.length > 0 ? groupMessages[groupMessages.length - 1] : null;
          const unreadCount = getChatUnreadCount(group.id);
          return (
            <div
              key={group.id}
              onClick={() => onSelectChatId(group.id)}
              className={`flex items-center gap-4 px-6 py-3 cursor-pointer transition-colors ${selectedChatId === group.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
            >
              <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-border">
                <img
                  src={group.avatarUrl || undefined}
                  alt={group.displayName}
                  className="w-full h-full object-cover"
                  onError={handleAvatarError}
                />
              </div>
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-[15px] font-bold truncate">{group.displayName}</span>
                <span className="text-[13px] text-muted-foreground truncate font-medium">
                  {getChatMessagePreviewText(lastMessage) || 'Start chatting'}
                </span>
              </div>
              <div className="flex flex-col items-end shrink-0 min-w-[44px]">
                {unreadCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                    {unreadCount}
                  </span>
                ) : (() => {
                  const label = sidebarReceiptLabel(group.id, lastMessage, unreadCount);
                  return label ? (
                    <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
                  ) : null;
                })()}
              </div>
            </div>
          );
        })}

        <div className="px-6 mt-4 mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Direct Messages
        </div>
        {filteredUsers.map((user) => {
          const userMessages = Array.isArray(messages[user.id]) ? messages[user.id] : [];
          const lastMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
          const unreadCount = getChatUnreadCount(user.id);
          const isUserTyping = getUserTyping(user.id);
          const isOnline = !!onlineStatusByUserId[user.id];
          const lastPreview = getChatMessagePreviewText(lastMessage);
          const subtitle = isUserTyping
            ? 'Typing...'
            : lastPreview
              ? lastPreview
              : isOnline
                ? 'Online'
                : formatLastSeenLabel(clockTick, lastSeenByUserId[user.id]);
          return (
            <div
              key={user.id}
              onClick={() => onSelectChatId(user.id)}
              className={`flex items-center gap-4 px-6 py-3 cursor-pointer transition-colors ${selectedChatId === user.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
            >
              <div className="relative shrink-0">
                <div className="w-14 h-14 rounded-full overflow-hidden border border-border">
                  <img
                    src={user.avatarUrl || undefined}
                    alt={user.username}
                    className="w-full h-full object-cover"
                    onError={handleAvatarError}
                  />
                </div>
                <div
                  className={`absolute bottom-0 right-0 w-4 h-4 border-2 border-card rounded-full shadow-sm ${isOnline ? 'bg-green-500' : 'bg-zinc-400 dark:bg-zinc-600'}`}
                />
              </div>
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-[15px] font-bold truncate">{user.displayName}</span>
                <span
                  className={`text-[13px] truncate font-medium ${isUserTyping ? 'text-blue-500' : 'text-muted-foreground'}`}
                >
                  {subtitle}
                </span>
              </div>
              <div className="flex flex-col items-end shrink-0 min-w-[44px]">
                {unreadCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                    {unreadCount}
                  </span>
                ) : (() => {
                  const label = sidebarReceiptLabel(user.id, lastMessage, unreadCount);
                  return label ? (
                    <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
                  ) : null;
                })()}
              </div>
            </div>
          );
        })}
        {sidebarSearchQuery.trim() && filteredGroups.length === 0 && filteredUsers.length === 0 && (
          <div className="px-6 py-6 text-center text-sm text-muted-foreground">No chats found.</div>
        )}
      </div>
    </div>
  );
}
