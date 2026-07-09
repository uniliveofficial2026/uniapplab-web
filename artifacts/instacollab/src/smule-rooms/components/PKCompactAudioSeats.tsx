import { Mic, MicOff, Sofa, User, Volume2, VolumeX } from 'lucide-react';
import { safeAvatarUrl } from '../../lib/safe';
import type { PKAudioSeats, PKAudioSlotId } from '../utils/pkBattleLayout';
import type { PKFighter } from '../utils/liveRoomTypes';

type PKCompactAudioSeatsProps = {
  seats: PKAudioSeats;
  sideAMuted: boolean;
  sideBMuted: boolean;
  onToggleSideMute: (side: 'a' | 'b') => void;
  onSeatClick: (slotId: PKAudioSlotId) => void;
  onToggleMic: (slotId: PKAudioSlotId) => void;
};

function PKSideMuteButton({
  side,
  muted,
  onToggle,
}: {
  side: 'a' | 'b';
  muted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`pk-compact-side-mute mb-1 flex w-full items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-[7px] font-black uppercase tracking-wide backdrop-blur-md transition active:scale-95 ${
        muted
          ? 'border-red-400/50 bg-red-950/80 text-red-200'
          : side === 'a'
            ? 'border-fuchsia-400/35 bg-black/65 text-fuchsia-100'
            : 'border-cyan-400/35 bg-black/65 text-cyan-100'
      }`}
    >
      {muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
      <span>{muted ? 'Side muted' : 'Mute side'}</span>
    </button>
  );
}

function PKCompactAudioSeat({
  slotId,
  fighter,
  label,
  role,
  onSeatClick,
  onToggleMic,
}: {
  slotId: PKAudioSlotId;
  fighter: PKFighter | null;
  label: string;
  role: 'boss' | 'guest';
  onSeatClick: (slotId: PKAudioSlotId) => void;
  onToggleMic: (slotId: PKAudioSlotId) => void;
}) {
  if (!fighter) {
    return (
      <div className="pk-compact-audio-seat flex flex-col items-center">
        <button
          type="button"
          onClick={() => onSeatClick(slotId)}
          className={`party-empty-seat party-glass-tap flex items-center justify-center rounded-full ${
            role === 'guest' ? 'party-glass-seat-guest' : ''
          }`}
        >
          {role === 'boss' ? <User size={12} /> : <Sofa size={11} strokeWidth={2.2} />}
        </button>
        <span className="pk-compact-seat-label mt-0.5 text-[6px] font-bold uppercase tracking-wide text-white/50">
          {label}
        </span>
      </div>
    );
  }

  const ring =
    role === 'boss'
      ? 'party-admin-avatar bg-gradient-to-tr from-violet-400 via-purple-500 to-fuchsia-500'
      : 'party-guest-avatar border-2 border-pink-500/40';

  return (
    <div className="pk-compact-audio-seat flex flex-col items-center">
      <div className="relative">
        <button type="button" onClick={() => onSeatClick(slotId)} className="block">
          <div className={`${ring} relative rounded-full p-[1.5px]`}>
            <img
              src={safeAvatarUrl(fighter.avatarUrl)}
              alt=""
              className="h-full w-full rounded-full border border-[#07010a] object-cover"
            />
          </div>
        </button>
        <button
          type="button"
          onClick={() => onToggleMic(slotId)}
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border border-[#07010a] p-[2px] ${
            fighter.score >= 0 ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        >
          <Mic size={7} className="text-white" />
        </button>
      </div>
      <span className="pk-compact-seat-name mt-0.5 max-w-[2.5rem] truncate text-[7px] font-bold text-white/90">
        {fighter.name}
      </span>
      <span className="text-[6px] font-black uppercase tracking-wide text-white/40">{label}</span>
    </div>
  );
}

export function PKCompactAudioSide({
  side,
  seats,
  muted,
  slotMicOn: _slotMicOn,
  onToggleSideMute,
  onSeatClick,
  onToggleMic,
}: {
  side: 'a' | 'b';
  seats: PKAudioSeats['sideA'];
  muted: boolean;
  slotMicOn?: Partial<Record<PKAudioSlotId, boolean>>;
  onToggleSideMute: () => void;
  onSeatClick: (slotId: PKAudioSlotId) => void;
  onToggleMic: (slotId: PKAudioSlotId) => void;
}) {
  const prefix = side === 'a' ? 'a' : 'b';
  const guestLabels = ['Guest 1', 'Guest 2'] as const;

  return (
    <div
      className={`pk-compact-audio-pane pk-compact-audio-pane--${side} ${muted ? 'pk-compact-audio-pane--muted' : ''}`}
    >
      <PKSideMuteButton side={side} muted={muted} onToggle={onToggleSideMute} />
      <div className="pk-compact-audio-seat-row">
        <PKCompactAudioSeat
          slotId={`${prefix}_boss` as PKAudioSlotId}
          fighter={seats.boss}
          label="Boss"
          role="boss"
          onSeatClick={onSeatClick}
          onToggleMic={onToggleMic}
        />
        {seats.guests.map((guest, index) => (
          <PKCompactAudioSeat
            key={`${prefix}-guest-${index}`}
            slotId={`${prefix}_guest${index + 1}` as PKAudioSlotId}
            fighter={guest}
            label={guestLabels[index]}
            role="guest"
            onSeatClick={onSeatClick}
            onToggleMic={onToggleMic}
          />
        ))}
      </div>
    </div>
  );
}

export function PKCompactAudioSeats({
  seats,
  sideAMuted,
  sideBMuted,
  onToggleSideMute,
  onSeatClick,
  onToggleMic,
}: PKCompactAudioSeatsProps) {
  return (
    <div className="pk-compact-audio-row border-t border-white/10 bg-black/85 px-1.5 py-1.5">
      <PKCompactAudioSide
        side="a"
        seats={seats.sideA}
        muted={sideAMuted}
        onToggleSideMute={() => onToggleSideMute('a')}
        onSeatClick={onSeatClick}
        onToggleMic={onToggleMic}
      />
      <PKCompactAudioSide
        side="b"
        seats={seats.sideB}
        muted={sideBMuted}
        onToggleSideMute={() => onToggleSideMute('b')}
        onSeatClick={onSeatClick}
        onToggleMic={onToggleMic}
      />
    </div>
  );
}
