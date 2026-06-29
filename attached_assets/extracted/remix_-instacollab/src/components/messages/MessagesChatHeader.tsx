import { ArrowLeft, Info, Phone, Search, Video } from 'lucide-react';
import type { ChatGroup, User } from '../../types';
import { handleAvatarError } from '../../lib/utils';
import { formatLastSeenLabel } from './messages/messageTime';

export type ChatPeer = User | ChatGroup;

export type MessagesChatHeaderProps = {
  selectedUser: ChatPeer;
  clockTick: number;
  isPeerTyping?: boolean;
  onlineStatusByUserId: Record<string, boolean>;
  lastSeenByUserId: Record<string, number>;
  showChatSearch: boolean;
  chatSearchQuery: string;
  onBack: () => void;
  onToggleChatSearch: () => void;
  onChatSearchQueryChange: (value: string) => void;
  onAudioCall: () => void;
  onVideoCall: () => void;
  onOpenInfo: () => void;
};

export function MessagesChatHeader({
  selectedUser,
  clockTick,
  isPeerTyping = false,
  onlineStatusByUserId,
  lastSeenByUserId,
  showChatSearch,
  chatSearchQuery,
  onBack,
  onToggleChatSearch,
  onChatSearchQueryChange,
  onAudioCall,
  onVideoCall,
  onOpenInfo,
}: MessagesChatHeaderProps) {
  const isGroup = 'isGroup' in selectedUser;

  return (
    <>
      <div className="h-[75px] border-b border-border flex items-center px-4 shrink-0 bg-card/50 backdrop-blur-sm z-10 w-full gap-2 sm:gap-4">
        <button
          type="button"
          className="md:hidden p-2 -ml-2 rounded-full hover:bg-secondary transition-colors shrink-0"
          onClick={onBack}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 overflow-hidden border border-border shrink-0 mb-0 ${isGroup ? 'rounded-xl' : 'rounded-full'}`}
          >
            <img
              src={selectedUser.avatarUrl || undefined}
              alt="user"
              className="w-full h-full object-cover"
              onError={handleAvatarError}
            />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-bold text-[15px] sm:text-[16px] leading-tight flex items-center gap-2 truncate">
              <span className="truncate">{selectedUser.displayName}</span>
              {isGroup && (
                <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-md hidden sm:inline-block shrink-0">
                  TEAM
                </span>
              )}
            </span>
            <span
              className={`text-xs leading-tight font-medium truncate ${
                !isGroup && isPeerTyping
                  ? 'text-blue-500'
                  : !isGroup && !!onlineStatusByUserId[selectedUser.id]
                    ? 'text-green-500'
                    : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {isGroup
                ? selectedUser.username
                : isPeerTyping
                  ? 'Typing...'
                  : onlineStatusByUserId[selectedUser.id]
                    ? 'Online'
                    : formatLastSeenLabel(clockTick, lastSeenByUserId[selectedUser.id])}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-6 text-foreground shrink-0">
          <Search
            onClick={onToggleChatSearch}
            className="w-5 h-5 sm:w-6 sm:h-6 cursor-pointer hover:text-primary transition-colors shrink-0"
          />
          <Phone
            onClick={onAudioCall}
            className="w-5 h-5 sm:w-6 sm:h-6 cursor-pointer hover:text-primary transition-colors shrink-0"
          />
          <Video
            onClick={onVideoCall}
            className="w-5 h-5 sm:w-6 sm:h-6 cursor-pointer hover:text-primary transition-colors shrink-0"
          />
          <div className="w-px h-5 sm:h-6 bg-border mx-0 sm:mx-1 shrink-0" />
          <Info
            onClick={onOpenInfo}
            className="w-5 h-5 sm:w-6 sm:h-6 cursor-pointer hover:text-primary transition-colors shrink-0"
          />
        </div>
      </div>
      {showChatSearch && (
        <div className="px-4 sm:px-6 py-2 border-b border-border bg-card/80 backdrop-blur-sm">
          <input
            type="text"
            value={chatSearchQuery}
            onChange={(e) => onChatSearchQueryChange(e.target.value)}
            placeholder="Search with #, @, name..."
            className="w-full bg-secondary outline-none px-3 py-2 rounded-xl text-sm font-medium"
          />
        </div>
      )}
    </>
  );
}
