import { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, Maximize2, Mic, MicOff, PhoneOff } from 'lucide-react';
import { motion } from 'motion/react';
import type { RoomLivePipSession } from '../../contexts/RoomLivePipContext';
import { callVideoStreamHasFrames } from '../../components/messages/CallVideoSurface';
import { AudioCallWaveBars } from '../../components/messages/AudioCallWaveBars';
import { getVoiceChangerEffect } from '../utils/voiceEffects';

type RoomLivePipWindowProps = {
  session: RoomLivePipSession;
  onExpand: () => void;
  onEnd: () => void;
  onToggleMic: () => void;
};

const VIDEO_PIP_WIDTH = 188;
const VIDEO_PIP_HEIGHT = 264;
const AUDIO_PIP_WIDTH = 172;
const AUDIO_PIP_HEIGHT = 228;

export function RoomLivePipWindow({
  session,
  onExpand,
  onEnd,
  onToggleMic,
}: RoomLivePipWindowProps) {
  const videoCall = session.hasVideo;
  const pipWidth = videoCall ? VIDEO_PIP_WIDTH : AUDIO_PIP_WIDTH;
  const pipHeight = videoCall ? VIDEO_PIP_HEIGHT : AUDIO_PIP_HEIGHT;
  const dragRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragState = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const [pos, setPos] = useState<{ left: number; top: number }>(() => ({
    left: Math.max(12, window.innerWidth - pipWidth - 16),
    top: Math.max(72, window.innerHeight - pipHeight - 96),
  }));

  const streamLive = callVideoStreamHasFrames(session.videoStream);
  const voiceLabel = session.voiceEffectLabel || getVoiceChangerEffect('studio').label;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !session.videoStream) return;
    if (video.srcObject !== session.videoStream) {
      video.srcObject = session.videoStream;
      void video.play().catch(() => undefined);
    }
  }, [session.videoStream]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if ((event.target as HTMLElement).closest('[data-pip-action]')) return;
      const el = dragRef.current;
      if (!el) return;
      dragState.current = {
        x: event.clientX,
        y: event.clientY,
        left: pos.left,
        top: pos.top,
      };
      el.setPointerCapture(event.pointerId);
    },
    [pos.left, pos.top],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const state = dragState.current;
      if (!state) return;
      const maxLeft = window.innerWidth - pipWidth - 8;
      const maxTop = window.innerHeight - pipHeight - 8;
      setPos({
        left: Math.min(maxLeft, Math.max(8, state.left + (event.clientX - state.x))),
        top: Math.min(maxTop, Math.max(8, state.top + (event.clientY - state.y))),
      });
    },
    [pipWidth, pipHeight],
  );

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    dragState.current = null;
    dragRef.current?.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <motion.div
      ref={dragRef}
      className="fixed z-[320] touch-none select-none"
      style={{ left: pos.left, top: pos.top, width: pipWidth }}
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 12 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-gray-950/95 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1.5">
          <GripVertical size={14} className="shrink-0 text-white/35" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-white">{session.roomTitle}</p>
            <p className="truncate text-[9px] text-white/45">
              {session.roomMode}
              {session.userMicOn ? ` · ${voiceLabel}` : ''}
            </p>
          </div>
          <button
            type="button"
            data-pip-action
            onClick={onExpand}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/85"
            aria-label="Expand room"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {videoCall ? (
          <div
            className="relative bg-black"
            style={{ width: pipWidth, height: VIDEO_PIP_HEIGHT - 72 }}
          >
            {streamLive ? (
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                autoPlay
                muted
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-white/45">
                Camera starting…
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-purple-950/80 to-gray-950 px-3"
            style={{ width: pipWidth, height: AUDIO_PIP_HEIGHT - 72 }}
          >
            <AudioCallWaveBars active={session.userVoiceActive && session.userMicOn} />
            <p className="text-center text-[10px] text-white/55">Live audio · {voiceLabel}</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 px-3 py-2.5">
          <button
            type="button"
            data-pip-action
            onClick={onToggleMic}
            className={`flex h-9 w-9 items-center justify-center rounded-full border ${
              session.userMicOn
                ? 'border-cyan-400/40 bg-cyan-500/20 text-cyan-100'
                : 'border-red-500/40 bg-red-500/15 text-red-200'
            }`}
            aria-label={session.userMicOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {session.userMicOn ? <Mic size={16} /> : <MicOff size={16} />}
          </button>
          <button
            type="button"
            data-pip-action
            onClick={onEnd}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-red-500/50 bg-red-600/80 text-white"
            aria-label="Leave room"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
