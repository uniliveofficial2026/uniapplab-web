import React from 'react';
import { Check, Copy, Pencil, Plus } from 'lucide-react';

export function RoomLiveHeaderInfo({
  roomLevel,
  roomTitle,
  announcement,
  roomDisplayId,
  isRoomSaved,
  roomIdCopied,
  onOpenDetails,
  onCopyRoomId,
  onToggleSaveRoom,
  canEditAnnouncement = false,
  onEditAnnouncement,
  className = '',
}: {
  roomLevel: number;
  roomTitle: string;
  announcement: string;
  roomDisplayId: string;
  isRoomSaved: boolean;
  roomIdCopied: boolean;
  onOpenDetails: () => void;
  onCopyRoomId: (event: React.MouseEvent) => void;
  onToggleSaveRoom: (event: React.MouseEvent) => void;
  canEditAnnouncement?: boolean;
  onEditAnnouncement?: () => void;
  className?: string;
}) {
  const headline = announcement.trim() || roomTitle.trim() || 'Welcome to the room';

  return (
    <div
      className={`flex min-w-0 max-w-[55%] items-center gap-1 rounded-full py-1 pl-1.5 pr-1.5 backdrop-blur-md sm:max-w-none ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-center space-x-2 py-0.5 pr-1">
        <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md bg-blue-500 text-[10px] font-black italic text-white shadow-[0_0_8px_rgba(59,130,246,0.5)]">
          {roomLevel}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={onOpenDetails}
              className="min-w-0 truncate text-left text-[11px] font-black italic tracking-tighter text-gray-100 transition hover:text-white"
              title={headline}
              aria-label={`Room announcement: ${headline}. Open room details.`}
            >
              {headline}
            </button>
            {canEditAnnouncement && onEditAnnouncement ? (
              <button
                type="button"
                onClick={onEditAnnouncement}
                className="shrink-0 rounded-md p-0.5 text-pink-300/90 transition hover:bg-white/10 hover:text-pink-200"
                title="Edit room announcement"
                aria-label="Edit room announcement"
              >
                <Pencil size={11} />
              </button>
            ) : null}
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={onOpenDetails}
              className="truncate font-mono text-[10px] font-semibold tracking-wide text-gray-300 transition hover:text-gray-100 sm:text-[11px]"
              title="Room details"
              aria-label={`Room ID ${roomDisplayId}. Open room details.`}
            >
              ID:{roomDisplayId}
            </button>
            <button
              type="button"
              onClick={onCopyRoomId}
              className="shrink-0 rounded-md p-1 text-gray-400 transition hover:bg-white/10 hover:text-gray-200"
              aria-label={roomIdCopied ? 'Room ID copied' : 'Copy room ID'}
            >
              {roomIdCopied ? (
                <Check size={13} className="text-emerald-400" />
              ) : (
                <Copy size={13} />
              )}
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleSaveRoom}
        title={isRoomSaved ? 'Saved to your room list — tap to remove' : 'Save room to your profile'}
        aria-label={isRoomSaved ? 'Remove room from saved list' : 'Save room to your profile'}
        aria-pressed={isRoomSaved}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition active:scale-90 sm:h-[22px] sm:w-[22px] ${
          isRoomSaved
            ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.55)] ring-1 ring-emerald-300/60'
            : 'bg-pink-500 text-white shadow-[0_0_8px_rgba(236,72,153,0.45)]'
        }`}
      >
        {isRoomSaved ? <Check size={13} strokeWidth={3} /> : <Plus size={13} strokeWidth={3} />}
      </button>
    </div>
  );
}
