import { Phone, PhoneOff, Video } from 'lucide-react';
import { motion } from 'motion/react';
import type { ChatCallKind } from '../../lib/chat/chatCallKit';
import { handleAvatarError } from '../../lib/utils';

type IncomingCallDynamicBannerProps = {
  callKind: ChatCallKind;
  callerName: string;
  callerAvatarUrl?: string;
  subtitle: string;
  onAccept: () => void;
  onDecline: () => void;
};

export function IncomingCallDynamicBanner({
  callKind,
  callerName,
  callerAvatarUrl,
  subtitle,
  onAccept,
  onDecline,
}: IncomingCallDynamicBannerProps) {
  const isVideo = callKind === 'video';

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[198] bg-black/15 backdrop-blur-[2px] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />

      <motion.div
        className="fixed left-1/2 z-[210] w-[min(calc(100vw-1.25rem),400px)] -translate-x-1/2"
        style={{ top: 'calc(var(--app-safe-top) + 0.375rem)' }}
        initial={{ y: -88, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -72, opacity: 0, scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        role="alertdialog"
        aria-live="assertive"
        aria-label={`Incoming ${callKind} call from ${callerName}`}
      >
        <div className="overflow-hidden rounded-[26px] border border-white/15 bg-[#1c1c1e]/92 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="flex items-center gap-3 px-3.5 py-3">
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-full bg-emerald-400/25 animate-ping" />
              <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/20 bg-zinc-800">
                <img
                  src={callerAvatarUrl || undefined}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={handleAvatarError}
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                {isVideo ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight text-white">
                {callerName}
              </p>
              <p className="truncate text-[12px] font-medium text-white/55">{subtitle}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onDecline}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                aria-label="Decline call"
              >
                <PhoneOff className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                aria-label="Accept call"
              >
                {isVideo ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent animate-pulse" />
        </div>
      </motion.div>
    </>
  );
}
