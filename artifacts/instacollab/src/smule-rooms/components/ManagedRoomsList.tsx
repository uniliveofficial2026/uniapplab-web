import React, { useEffect, useState } from 'react';
import { Crown, Pencil, Shield, Users, Zap } from 'lucide-react';
import { getAppUserId } from '../../lib/appUserId';
import { getRoomExpProgress } from '../utils/roomExp';
import { canEditRoomForUser } from '../utils/roomRoleUsers';
import { getRoomSettings } from '../utils/storage';
import { RoomHostLabel } from './RoomHostLabel';
import {
  formatManagedRoomRoleLabel,
  formatRoomModeLabel,
  getManagedRooms,
  groupManagedRoomsByRole,
  hydrateManagedRoomsForUser,
  type ManagedRoom,
  type ManagedRoomRole,
} from '../utils/managedRooms';

type ManagedRoomsListProps = {
  onOpenRoom: (room: ManagedRoom) => void;
  onEditRoom?: (room: ManagedRoom) => void;
  variant?: 'profile' | 'party';
  emptyMessage?: string;
};

const SECTION_META: Record<
  ManagedRoomRole,
  { title: string; icon: typeof Crown; description: string }
> = {
  owner: {
    title: 'My Rooms',
    icon: Crown,
    description: 'Rooms you own and host.',
  },
  'co-owner': {
    title: 'Co-owner',
    icon: Users,
    description: 'Rooms where another owner granted you co-owner access.',
  },
  admin: {
    title: 'Admin',
    icon: Shield,
    description: 'Rooms where you can help manage guests and settings.',
  },
};

const SECTION_ORDER: ManagedRoomRole[] = ['owner', 'co-owner', 'admin'];

function roleBadgeClass(role: ManagedRoomRole, variant: 'profile' | 'party'): string {
  if (variant === 'profile') {
    switch (role) {
      case 'owner':
        return 'bg-amber-500/15 text-amber-600 border-amber-500/25';
      case 'co-owner':
        return 'bg-blue-500/15 text-blue-600 border-blue-500/25';
      case 'admin':
        return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  }
  switch (role) {
    case 'owner':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/25';
    case 'co-owner':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/25';
    case 'admin':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
    default:
      return 'bg-gray-800 text-gray-400 border-gray-700';
  }
}

export function ManagedRoomsList({
  onOpenRoom,
  onEditRoom,
  variant = 'profile',
  emptyMessage = 'No managed rooms yet. Create a room or ask an owner to grant you admin or co-owner access.',
}: ManagedRoomsListProps) {
  const appUserId = getAppUserId();
  const [rooms, setRooms] = useState<ManagedRoom[]>(() => getManagedRooms());
  const [, setExpRevision] = useState(0);

  useEffect(() => {
    queueMicrotask(() => {
      hydrateManagedRoomsForUser(appUserId);
      setRooms(getManagedRooms());
    });
  }, [appUserId]);

  useEffect(() => {
    const refresh = () => {
      setRooms(getManagedRooms());
      setExpRevision((n) => n + 1);
    };
    window.addEventListener('managed-rooms-updated', refresh);
    window.addEventListener('room-exp-updated', refresh);
    return () => {
      window.removeEventListener('managed-rooms-updated', refresh);
      window.removeEventListener('room-exp-updated', refresh);
    };
  }, []);

  const grouped = groupManagedRoomsByRole(rooms);
  const hasRooms = rooms.length > 0;

  if (!hasRooms) {
    return (
      <div
        className={
          variant === 'profile'
            ? 'py-16 text-center text-muted-foreground font-medium text-sm px-4'
            : 'rounded-2xl border border-dashed border-gray-800 bg-gray-900/40 p-5 text-center text-xs text-gray-500'
        }
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={variant === 'profile' ? 'space-y-6' : 'space-y-5'}>
      {SECTION_ORDER.map((role) => {
        const sectionRooms = grouped[role];
        if (sectionRooms.length === 0) return null;
        const meta = SECTION_META[role];
        const SectionIcon = meta.icon;

        return (
          <section key={role} className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <SectionIcon
                  className={variant === 'profile' ? 'w-4 h-4 text-primary' : 'w-4 h-4 text-purple-400'}
                />
                <h4
                  className={
                    variant === 'profile'
                      ? 'font-bold text-sm text-foreground'
                      : 'font-bold text-sm text-gray-300 uppercase tracking-wider'
                  }
                >
                  {meta.title}
                </h4>
                <span
                  className={
                    variant === 'profile'
                      ? 'text-[10px] font-bold text-muted-foreground'
                      : 'text-[10px] font-bold text-gray-500'
                  }
                >
                  {sectionRooms.length}
                </span>
              </div>
              <p
                className={
                  variant === 'profile'
                    ? 'text-xs text-muted-foreground mt-1'
                    : 'text-[11px] text-gray-500 mt-1'
                }
              >
                {meta.description}
              </p>
            </div>

            <div className="space-y-2">
              {sectionRooms.map((room) => {
                const canEdit = canEditRoomForUser(
                  getRoomSettings(room.id),
                  getAppUserId(),
                  { sessionRole: room.role },
                );
                return (
                  <div
                    key={`${room.id}-${room.role}`}
                    className={
                      variant === 'profile'
                        ? 'bg-secondary border border-border p-4 rounded-2xl flex justify-between items-center gap-3 hover:bg-secondary/80 transition cursor-pointer'
                        : 'bg-gray-900 border border-purple-500/20 p-4 rounded-3xl flex justify-between items-center gap-3 hover:bg-gray-800 transition cursor-pointer'
                    }
                    onClick={() => onOpenRoom(room)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenRoom(room);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="min-w-0 flex-1">
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
                            ? 'text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1 mb-2'
                            : 'text-[10px] text-gray-500 flex flex-wrap items-center gap-x-1 gap-y-1 mb-2'
                        }
                      >
                        {room.hostName && (
                          <>
                            <RoomHostLabel
                              roomId={room.id}
                              storedHostName={room.hostName}
                              className={variant === 'profile' ? 'font-medium' : 'font-medium text-gray-300'}
                            />
                            <span>•</span>
                          </>
                        )}
                        <span className="font-mono">ID:{room.id}</span>
                        <span>•</span>
                        <span>{formatRoomModeLabel(room.roomMode)}</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${roleBadgeClass(room.role, variant)}`}
                        >
                          {formatManagedRoomRoleLabel(room.role)}
                        </span>
                        {(() => {
                          const level = getRoomExpProgress(room.id).level;
                          return (
                          <span
                            className={
                              variant === 'profile'
                                ? 'text-[9px] bg-blue-500/15 text-blue-600 px-2 py-0.5 rounded-full border border-blue-500/20 font-bold'
                                : 'text-[9px] bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20 font-bold'
                            }
                          >
                            Lv.{level}
                          </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canEdit && onEditRoom && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditRoom(room);
                          }}
                          className={
                            variant === 'profile'
                              ? 'h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:bg-primary/10 hover:text-primary transition'
                              : 'h-8 w-8 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center hover:bg-purple-500/20 hover:text-purple-300 transition'
                          }
                          aria-label={`Edit ${room.name}`}
                          title="Edit room settings"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <div
                        className={
                          variant === 'profile'
                            ? 'h-8 w-8 rounded-full bg-purple-600/20 text-purple-500 flex items-center justify-center'
                            : 'h-8 w-8 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center'
                        }
                      >
                        <Zap size={14} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
