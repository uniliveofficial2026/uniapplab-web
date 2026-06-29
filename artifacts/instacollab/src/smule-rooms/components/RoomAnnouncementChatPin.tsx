import React from 'react';
import { ChatRoleBadges, BADGE_BASE } from './ChatRoleBadges';
import type { ChatRoleFlags } from '../utils/roomRoleUsers';
import type { ViewerRoomWelcome } from '../utils/roomAnnouncementPersonalize';

type RoomAnnouncementChatPinProps = {
  welcome: ViewerRoomWelcome;
  roomLevel: number;
  ownerName: string;
  ownerAvatar: string;
  ownerRoleFlags: ChatRoleFlags;
  onSelectOwner?: () => void;
  onSelectRecipient?: () => void;
  pinId?: string;
};

function renderAnnouncementLine(text: string) {
  if (!text.includes('@')) {
    return <span className="whitespace-pre-wrap break-words">{text}</span>;
  }

  const parts = text.split(/(@[^\s]+)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, index) =>
        part.startsWith('@') ? (
          <span key={`${index}-${part}`} className="text-[#02faab]">
            {part}
          </span>
        ) : (
          <React.Fragment key={`${index}-text`}>{part}</React.Fragment>
        ),
      )}
    </span>
  );
}

export function RoomAnnouncementChatPin({
  welcome,
  roomLevel,
  ownerName,
  ownerAvatar,
  ownerRoleFlags,
  onSelectOwner,
  onSelectRecipient,
  pinId = 'room-announcement-chat-pin',
}: RoomAnnouncementChatPinProps) {
  const { recipientName, greetingLine, bodyLines } = welcome;
  if (!greetingLine && bodyLines.length === 0) return null;

  return (
    <div className="animate-fade-in" id={pinId} data-room-announcement-pin>
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-2 gap-y-1">
        <img
          src={ownerAvatar}
          alt=""
          onClick={onSelectOwner}
          className={`party-chat-avatar row-span-3 self-start rounded-full border border-pink-400 object-cover ${
            onSelectOwner ? 'cursor-pointer transition hover:scale-105' : 'cursor-default'
          }`}
        />

        <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-1">
          <span className="inline-flex shrink-0 items-center rounded-sm bg-gradient-to-r from-fuchsia-600 to-purple-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-[0_0_8px_rgba(168,85,247,0.35)]">
            📣 Announcement
          </span>
          <button
            type="button"
            onClick={onSelectOwner}
            disabled={!onSelectOwner}
            className={`party-chat-username min-w-0 font-black uppercase tracking-wide text-orange-400 ${
              onSelectOwner ? 'cursor-pointer hover:underline hover:text-orange-300' : 'cursor-default'
            }`}
          >
            @{ownerName}
          </button>
          <ChatRoleBadges {...ownerRoleFlags} />
        </div>

        <div className="party-chat-member-badges col-start-2 flex min-w-0 flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={onSelectRecipient}
            disabled={!onSelectRecipient}
            className={`${BADGE_BASE} bg-gradient-to-r from-cyan-400 to-teal-400 text-black ${
              onSelectRecipient ? 'cursor-pointer hover:brightness-110' : 'cursor-default'
            }`}
          >
            @{recipientName}
          </button>
          <span className={`${BADGE_BASE} bg-gradient-to-r from-cyan-400 to-teal-400 text-black`}>
            💎 Lv.{roomLevel}
          </span>
          <span className={`${BADGE_BASE} border border-purple-400/40 bg-purple-500/20 text-purple-100`}>
            Room
          </span>
        </div>

        <div className="col-start-2 min-w-0">
          <div className="mt-0.5 max-w-[95%] rounded-2xl border border-[#a259ff]/10 bg-[#1d0a26]/90 p-2.5 text-left shadow-lg backdrop-blur-md">
            <div className="party-chat-bubble-text font-extrabold leading-relaxed tracking-wide text-gray-100">
              {greetingLine ? (
                <p className="text-[#02faab]">{renderAnnouncementLine(greetingLine)}</p>
              ) : null}
              {bodyLines.map((line, index) => (
                <p
                  key={`${index}-${line.slice(0, 24)}`}
                  className={greetingLine || index > 0 ? 'mt-0.5 text-gray-200' : 'text-[#02faab]'}
                >
                  {renderAnnouncementLine(line)}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
