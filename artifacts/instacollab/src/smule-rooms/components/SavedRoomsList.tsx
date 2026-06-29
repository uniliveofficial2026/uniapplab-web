import React, { useEffect, useState } from 'react';
import { Users, X, Zap } from 'lucide-react';
import { useDbRevision } from '../../lib/useDB';
import { getSavedRooms, removeSavedRoom, type SavedRoom } from '../utils/savedRooms';
import { getRoomExpProgress } from '../utils/roomExp';
import { RoomHostLabel } from './RoomHostLabel';

type SavedRoomsListProps = {
  onOpenRoom: (roomId: string) => void;
  emptyMessage?: string;
  variant?: 'party' | 'profile';
};

export function SavedRoomsList({
  onOpenRoom,
  emptyMessage = 'No saved rooms yet. Tap + on a room header to save it here.',
  variant = 'party',
}: SavedRoomsListProps) {
  useDbRevision();
  const [rooms, setRooms] = useState<SavedRoom[]>(() => getSavedRooms());
  const [, setExpRevision] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setRooms(getSavedRooms());
      setExpRevision((n) => n + 1);
    };
    window.addEventListener('saved-rooms-updated', refresh);
    window.addEventListener('room-exp-updated', refresh);
    return () => {
      window.removeEventListener('saved-rooms-updated', refresh);
      window.removeEventListener('room-exp-updated', refresh);
    };
  }, []);

  if (rooms.length === 0) {
    return (
      <div
        className={
          variant === 'profile'
            ? 'col-span-3 py-16 text-center text-muted-foreground font-medium text-sm px-4'
            : 'rounded-2xl border border-dashed border-gray-800 bg-gray-900/40 p-5 text-center text-xs text-gray-500'
        }
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={variant === 'profile' ? 'col-span-3 space-y-3' : 'grid grid-cols-1 gap-3'}>
      {rooms.map((room) => (
        <div
          key={room.id}
          className={
            variant === 'profile'
              ? 'bg-secondary border border-border p-4 rounded-2xl flex justify-between items-center hover:bg-secondary/80 transition cursor-pointer'
              : 'bg-gray-900 border border-purple-500/20 p-4 rounded-3xl flex justify-between items-center hover:bg-gray-800 transition cursor-pointer'
          }
          onClick={() => onOpenRoom(room.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpenRoom(room.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="min-w-0 pr-3">
            <h4
              className={
                variant === 'profile'
                  ? 'font-bold text-foreground mb-1 text-sm truncate'
                  : 'font-bold text-white mb-1 text-sm truncate'
              }
            >
              {room.name}
            </h4>
            <p
              className={
                variant === 'profile'
                  ? 'text-[10px] text-muted-foreground flex items-center space-x-1 mb-1'
                  : 'text-[10px] text-gray-500 flex items-center space-x-1 mb-1'
              }
            >
              {room.hostName && (
                <>
                  <RoomHostLabel
                    roomId={room.id}
                    storedHostName={room.hostName}
                    className={variant === 'profile' ? 'font-medium text-foreground/80' : 'font-medium text-gray-300'}
                  />
                  <span>•</span>
                </>
              )}
              <span className="font-mono">ID:{room.id}</span>
            </p>
            <span className="text-[9px] bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20 font-bold">
              Lv.{getRoomExpProgress(room.id).level}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeSavedRoom(room.id);
              }}
              className={
                variant === 'profile'
                  ? 'h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition'
                  : 'h-8 w-8 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center hover:bg-red-500/20 hover:text-red-300 transition'
              }
              aria-label={`Remove ${room.name} from saved rooms`}
              title="Remove from saved"
            >
              <X size={14} />
            </button>
            <div
              className={
                variant === 'profile'
                  ? 'h-8 w-8 rounded-full bg-purple-600/20 text-purple-500 flex items-center justify-center'
                  : 'h-8 w-8 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center'
              }
            >
              {variant === 'profile' ? <Users size={14} /> : <Zap size={14} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
