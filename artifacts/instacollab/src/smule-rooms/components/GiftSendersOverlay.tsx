import React, { useCallback, useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { safeAvatarUrl } from '../../lib/safe';
import { resolveRoomMemberIdentity } from '../utils/roomMemberProfile';
import {
  getReceiverGiftSenders,
  getReceiverGiftStars,
  type ReceiverGiftSender,
} from '../utils/roomGifts';

type GiftSendersOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  roomDisplayId: string;
  receiverName: string;
  receiverUserId?: string;
  onSelectSender?: (sender: { id: string; name: string; avatar: string }) => void;
};

export function GiftSendersOverlay({
  isOpen,
  onClose,
  roomDisplayId,
  receiverName,
  receiverUserId,
  onSelectSender,
}: GiftSendersOverlayProps) {
  const [senders, setSenders] = useState<ReceiverGiftSender[]>([]);

  const refreshSenders = useCallback(() => {
    setSenders(getReceiverGiftSenders(roomDisplayId, receiverName, receiverUserId));
  }, [roomDisplayId, receiverName, receiverUserId]);

  useEffect(() => {
    if (!isOpen) return;
    refreshSenders();
  }, [isOpen, refreshSenders]);

  useEffect(() => {
    if (!isOpen) return;
    const handleGiftsUpdated = () => refreshSenders();
    window.addEventListener('room-gifts-updated', handleGiftsUpdated);
    return () => window.removeEventListener('room-gifts-updated', handleGiftsUpdated);
  }, [isOpen, refreshSenders]);

  if (!isOpen) return null;

  const totalStars = getReceiverGiftStars(roomDisplayId, receiverName, receiverUserId);

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex flex-col justify-end pointer-events-auto">
      <div className="bg-[#1a0f2e] w-full max-h-[75vh] rounded-t-3xl border-t border-yellow-500/25 flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(234,179,8,0.12)] animate-fade-in-up">
        <div className="flex justify-between items-center px-5 sm:px-6 py-4 sm:py-5 border-b border-white/5">
          <div className="flex min-w-0 items-center space-x-2.5">
            <Star size={22} className="shrink-0 fill-yellow-400 text-yellow-400" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-100 uppercase tracking-widest truncate">
                Gift Supporters
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-400 truncate mt-0.5">
                Coins sent to {receiverName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition active:scale-95 shrink-0"
            aria-label="Close gift supporters"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-3.5 border-b border-white/5 bg-white/5 flex items-center justify-between gap-3">
          <span className="text-sm sm:text-base text-gray-200 font-semibold">
            {senders.length} supporter{senders.length === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/30 bg-yellow-950/40 px-2.5 py-1 text-xs font-black text-yellow-300 font-mono">
            <Star size={12} className="fill-yellow-400 text-yellow-400" aria-hidden />
            {totalStars.toLocaleString()}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-2.5 pb-10 scrollbar-hide mt-1">
          {senders.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-black/30 px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No gift history yet for this seat.</p>
              <p className="text-xs text-gray-500 mt-1">Send a gift to appear here.</p>
            </div>
          ) : (
            senders.map((sender) => {
              const identity = resolveRoomMemberIdentity(
                sender.senderUserId,
                sender.senderName,
                roomDisplayId,
                80,
              );
              const senderId = identity.userId ?? sender.senderName;

              return (
                <button
                  key={`${sender.senderName}-${sender.lastGiftAt}`}
                  type="button"
                  onClick={() =>
                    onSelectSender?.({
                      id: senderId,
                      name: identity.name,
                      avatar: identity.avatarUrl,
                    })
                  }
                  className="w-full flex justify-between items-center bg-black/40 border border-white/5 rounded-2xl p-3.5 sm:p-4 animate-fade-in text-left hover:border-yellow-500/25 hover:bg-black/55 transition"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <img
                      src={safeAvatarUrl(identity.avatarUrl)}
                      alt={identity.name}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-yellow-500/40 shrink-0"
                    />
                    <div className="flex flex-col space-y-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-gray-100 truncate">
                        {identity.name}
                      </h3>
                      <span className="text-[10px] sm:text-xs text-gray-400">
                        {sender.giftCount} gift{sender.giftCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full border border-yellow-400/25 bg-yellow-950/50 px-2 py-1 shrink-0">
                    <Star size={10} className="fill-yellow-400 text-yellow-400" aria-hidden />
                    <span className="text-[11px] sm:text-xs font-black text-yellow-300 font-mono">
                      {sender.totalStars.toLocaleString()}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
