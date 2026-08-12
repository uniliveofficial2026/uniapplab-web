import React, { useEffect, useMemo, useState } from 'react';
import { Ban, Sofa, Users, Eye, X } from 'lucide-react';
import type { PartySeatMap } from '../utils/roomSeats';
import {
  isPlatformAdminModMessage,
  type PlatformAdminModAction,
} from '../../lib/admin/platformAdminModerationBridge';

type SeatedTarget = {
  userId: string;
  name: string;
  avatar: string;
  seatKey: string;
};

type PlatformAdminModerationListenerProps = {
  enabled: boolean;
  roomId: string;
  activeSeats: PartySeatMap;
  onOpenGuests: () => void;
  onOpenViewers: () => void;
  onRequestBanFromSeats: (userId: string, displayName: string) => void;
};

/**
 * Listens for Control Center watch-bar commands. No floating overlay —
 * only opens bottom sheets when the parent explicitly taps Seats / Ban seats / Viewers.
 */
export function PlatformAdminModerationListener({
  enabled,
  roomId,
  activeSeats,
  onOpenGuests,
  onOpenViewers,
  onRequestBanFromSeats,
}: PlatformAdminModerationListenerProps) {
  const [seatBanPickerOpen, setSeatBanPickerOpen] = useState(false);

  const banTargets = useMemo(() => {
    const out: SeatedTarget[] = [];
    for (const [seatKey, guest] of Object.entries(activeSeats)) {
      if (!guest || seatKey === 'host') continue;
      const userId = guest.userId?.trim();
      if (!userId) continue;
      out.push({
        userId,
        name: guest.name,
        avatar: guest.avatar,
        seatKey,
      });
    }
    return out;
  }, [activeSeats]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onMessage = (event: MessageEvent) => {
      if (!isPlatformAdminModMessage(event.data)) return;
      if (event.data.roomId && event.data.roomId !== roomId) return;

      const action: PlatformAdminModAction = event.data.action;
      if (action === 'seats') {
        setSeatBanPickerOpen(false);
        onOpenGuests();
        return;
      }
      if (action === 'viewers') {
        setSeatBanPickerOpen(false);
        onOpenViewers();
        return;
      }
      if (action === 'ban-seats') {
        setSeatBanPickerOpen(true);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [enabled, roomId, onOpenGuests, onOpenViewers]);

  if (!enabled || !seatBanPickerOpen) return null;

  return (
    <div className="fixed inset-0 z-[190] flex items-end justify-center pointer-events-auto">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        aria-label="Close seat ban picker"
        onClick={() => setSeatBanPickerOpen(false)}
      />
      <div className="relative w-full max-w-md rounded-t-3xl border-t border-orange-500/30 bg-[#1a0f2e] p-5 shadow-[0_-12px_40px_rgba(249,115,22,0.2)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-orange-300">
            <Users size={16} />
            <h3 className="text-sm font-black uppercase tracking-widest">Ban from seats</h3>
          </div>
          <button
            type="button"
            onClick={() => setSeatBanPickerOpen(false)}
            className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          Pick a seated guest. Host seat cannot be banned and always survives.
        </p>
        {banTargets.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No banable seated guests right now.</p>
        ) : (
          <div className="max-h-[45vh] space-y-2 overflow-y-auto pb-2">
            {banTargets.map((target) => (
              <button
                key={`${target.seatKey}-${target.userId}`}
                type="button"
                onClick={() => {
                  setSeatBanPickerOpen(false);
                  onRequestBanFromSeats(target.userId, target.name);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-left transition hover:border-orange-400/40 hover:bg-orange-500/10 active:scale-[0.99]"
              >
                <img
                  src={target.avatar}
                  alt=""
                  className="h-10 w-10 rounded-full border border-orange-400/30 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{target.name}</p>
                  <p className="text-[10px] text-gray-500">Seat {target.seatKey}</p>
                </div>
                <Ban size={14} className="shrink-0 text-orange-300" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
