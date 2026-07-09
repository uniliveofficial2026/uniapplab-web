import { Mic, MicOff, Sofa, User, Volume2, VolumeX } from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import { safeAvatarUrl } from '../../lib/safe';
import {
  formatGuestSeatNumber,
  formatStaffSeatLabel,
  PK_SIDE_GUEST_KEYS,
  splitPartyGuestSeatRows,
  type PartySeatMap,
  type RoomGuest,
  type RoomSeatKey,
} from '../utils/roomSeats';

type PKSplitRoomSeatsProps = {
  sideA: PartySeatMap;
  sideB: PartySeatMap;
  sideAMuted: boolean;
  sideBMuted: boolean;
  onToggleSideMute: (side: 'a' | 'b') => void;
  onSeatClick: (side: 'a' | 'b', seatKey: RoomSeatKey) => void;
  onToggleMic: (side: 'a' | 'b', seatKey: RoomSeatKey) => void;
};

const guestRows = splitPartyGuestSeatRows(PK_SIDE_GUEST_KEYS);

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
      className={`pk-split-room-mute mb-1 flex w-full items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-[7px] font-black uppercase tracking-wide backdrop-blur-md transition active:scale-95 ${
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

function PKStaffSeat({
  seatKey,
  guest,
  side,
  onSeatClick,
  onToggleMic,
}: {
  seatKey: 'host' | 'coowner' | 'admin';
  guest: RoomGuest | null;
  side: 'a' | 'b';
  onSeatClick: (side: 'a' | 'b', seatKey: RoomSeatKey) => void;
  onToggleMic: (side: 'a' | 'b', seatKey: RoomSeatKey) => void;
}) {
  const label =
    seatKey === 'host' ? 'Host' : seatKey === 'coowner' ? 'Co-owner' : formatStaffSeatLabel('admin');
  const ring =
    seatKey === 'host'
      ? 'party-host-avatar bg-gradient-to-tr from-cyan-400 via-purple-600 to-pink-500'
      : seatKey === 'coowner'
        ? 'party-coowner-avatar bg-gradient-to-tr from-amber-400 via-orange-500 to-yellow-500'
        : 'party-admin-avatar bg-gradient-to-tr from-violet-400 via-purple-500 to-fuchsia-500';

  if (!guest) {
    return (
      <div className="pk-split-staff-seat flex flex-col items-center">
        <button
          type="button"
          onClick={() => onSeatClick(side, seatKey)}
          className="party-empty-seat party-glass-tap flex items-center justify-center rounded-full"
        >
          <User size={12} />
        </button>
        <span className="pk-split-seat-label mt-0.5 text-[6px] font-bold uppercase tracking-wide text-white/50">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="pk-split-staff-seat flex flex-col items-center">
      <div className="relative">
        <button type="button" onClick={() => onSeatClick(side, seatKey)} className="block">
          <div className={`${ring} relative rounded-full p-[1.5px]`}>
            <img
              src={safeAvatarUrl(guest.avatar)}
              alt=""
              className="h-full w-full rounded-full border border-[#07010a] object-cover"
            />
          </div>
        </button>
        <button
          type="button"
          onClick={() => onToggleMic(side, seatKey)}
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border border-[#07010a] p-[2px] ${
            guest.isSpeaking ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        >
          {guest.isSpeaking ? <Mic size={7} className="text-white" /> : <MicOff size={7} className="text-white" />}
        </button>
      </div>
      <span className="pk-split-seat-name mt-0.5 max-w-[2.75rem] truncate text-[7px] font-bold text-white/90">
        {guest.name}
      </span>
      <div className="mt-0.5 flex items-center rounded-full border border-white/10 bg-black/50 px-1 py-px">
        <CoinIcon className="h-1.5 w-1.5 shrink-0" />
        <span className="text-[6px] font-mono font-black text-yellow-300">{guest.stars}</span>
      </div>
    </div>
  );
}

function PKGuestSeat({
  seatKey,
  guest,
  side,
  onSeatClick,
  onToggleMic,
}: {
  seatKey: RoomSeatKey;
  guest: RoomGuest | null;
  side: 'a' | 'b';
  onSeatClick: (side: 'a' | 'b', seatKey: RoomSeatKey) => void;
  onToggleMic: (side: 'a' | 'b', seatKey: RoomSeatKey) => void;
}) {
  const seatNum = formatGuestSeatNumber(seatKey);

  if (!guest) {
    return (
      <div className="pk-split-guest-seat flex flex-col items-center">
        <button
          type="button"
          onClick={() => onSeatClick(side, seatKey)}
          className="party-empty-seat party-glass-tap party-glass-seat-guest flex items-center justify-center rounded-full"
        >
          <Sofa size={11} strokeWidth={2.2} />
        </button>
        <span className="pk-split-seat-label mt-0.5 text-[6px] font-black uppercase tracking-wide text-white/45">
          NO.{seatNum}
        </span>
      </div>
    );
  }

  return (
    <div className="pk-split-guest-seat flex flex-col items-center">
      <div className="relative">
        <button type="button" onClick={() => onSeatClick(side, seatKey)} className="block">
          <div className="party-guest-avatar relative rounded-full border-2 border-pink-500/40 p-[1px]">
            <img
              src={safeAvatarUrl(guest.avatar)}
              alt=""
              className="h-full w-full rounded-full border border-black object-cover"
            />
          </div>
        </button>
        <button
          type="button"
          onClick={() => onToggleMic(side, seatKey)}
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border border-[#0d011c] p-[2px] ${
            guest.isSpeaking ? 'bg-pink-500' : 'bg-red-500'
          }`}
        >
          {guest.isSpeaking ? <Mic size={7} className="text-white" /> : <MicOff size={7} className="text-white" />}
        </button>
      </div>
      <span className="pk-split-seat-name mt-0.5 max-w-[2.5rem] truncate text-[7px] font-bold text-white/85">
        {guest.name}
      </span>
      <span className="text-[6px] font-black uppercase tracking-wide text-white/40">NO.{seatNum}</span>
    </div>
  );
}

export function PKSplitRoomPane({
  side,
  seats,
  muted,
  onToggleSideMute,
  onSeatClick,
  onToggleMic,
}: {
  side: 'a' | 'b';
  seats: PartySeatMap;
  muted: boolean;
  onToggleSideMute: () => void;
  onSeatClick: (side: 'a' | 'b', seatKey: RoomSeatKey) => void;
  onToggleMic: (side: 'a' | 'b', seatKey: RoomSeatKey) => void;
}) {
  return (
    <div
      className={`pk-split-room-pane pk-split-room-pane--${side} ${muted ? 'pk-split-room-pane--muted' : ''}`}
    >
      <PKSideMuteButton side={side} muted={muted} onToggle={onToggleSideMute} />
      <div className="pk-split-room-pane-label text-center text-[7px] font-black uppercase tracking-wider text-white/40">
        {side === 'a' ? 'Room A' : 'Room B'} · 11 seats
      </div>
      <div className="party-host-seat-row party-seat-grid pk-split-staff-row relative z-10">
        <PKStaffSeat seatKey="host" guest={seats.host} side={side} onSeatClick={onSeatClick} onToggleMic={onToggleMic} />
        <PKStaffSeat
          seatKey="coowner"
          guest={seats.coowner}
          side={side}
          onSeatClick={onSeatClick}
          onToggleMic={onToggleMic}
        />
        <PKStaffSeat seatKey="admin" guest={seats.admin} side={side} onSeatClick={onSeatClick} onToggleMic={onToggleMic} />
      </div>
      <div className="party-guest-seat-rows pk-split-guest-rows relative z-10 w-full">
        {guestRows.map((rowKeys) => (
          <div key={rowKeys.join('-')} className="party-seat-grid pk-split-guest-grid">
            {rowKeys.map((seatKey) => (
              <PKGuestSeat
                key={seatKey}
                seatKey={seatKey}
                guest={seats[seatKey]}
                side={side}
                onSeatClick={onSeatClick}
                onToggleMic={onToggleMic}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PKSplitRoomSeats({
  sideA,
  sideB,
  sideAMuted,
  sideBMuted,
  onToggleSideMute,
  onSeatClick,
  onToggleMic,
}: PKSplitRoomSeatsProps) {
  return (
    <div className="pk-split-rooms-row border-t border-white/10 bg-black/85 px-1.5 py-1.5">
      <PKSplitRoomPane
        side="a"
        seats={sideA}
        muted={sideAMuted}
        onToggleSideMute={() => onToggleSideMute('a')}
        onSeatClick={onSeatClick}
        onToggleMic={onToggleMic}
      />
      <PKSplitRoomPane
        side="b"
        seats={sideB}
        muted={sideBMuted}
        onToggleSideMute={() => onToggleSideMute('b')}
        onSeatClick={onSeatClick}
        onToggleMic={onToggleMic}
      />
    </div>
  );
}
