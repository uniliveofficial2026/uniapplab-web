import { safeAvatarUrl } from '../../lib/safe';
import type { PKFighter, PKMode } from '../utils/liveRoomTypes';
import {
  formatPkRoomModeLabel,
  getPkTeamGridClass,
  padPkTeamFighters,
  type PKAudioSeats,
  type PKAudioSlotId,
  type PKSeatLayout,
} from '../utils/pkBattleLayout';
import type { PartySeatMap, RoomSeatKey } from '../utils/roomSeats';
import { PKCompactAudioSide } from './PKCompactAudioSeats';
import { PKSplitRoomPane } from './PKSplitRoomSeats';

function PKVideoTile({
  fighter,
  accent,
  empty = false,
}: {
  fighter: PKFighter;
  accent: 'fuchsia' | 'cyan';
  empty?: boolean;
}) {
  const poster = safeAvatarUrl(fighter.avatarUrl);
  const ring =
    accent === 'fuchsia'
      ? 'from-fuchsia-500/40 via-pink-500/20 to-transparent'
      : 'from-cyan-500/40 via-blue-500/20 to-transparent';

  return (
    <div className="pk-battle-video-tile relative min-h-0 overflow-hidden bg-black">
      {!empty && poster ? (
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />
      )}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${ring}`} />
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-1.5 pb-1.5 pt-5">
        <p className="truncate text-center text-[10px] font-black text-white">{fighter.name}</p>
        {!empty ? (
          <p
            className={`text-center text-sm font-black ${
              accent === 'fuchsia' ? 'text-fuchsia-300' : 'text-cyan-300'
            }`}
          >
            {fighter.score}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PKTeamPane({
  fighters,
  accent,
  label,
  forceFour = false,
}: {
  fighters: PKFighter[];
  accent: 'fuchsia' | 'cyan';
  label: string;
  forceFour?: boolean;
}) {
  const members = forceFour
    ? padPkTeamFighters(fighters, label)
    : fighters.length > 0
      ? fighters
      : [{ userId: 'empty', name: label, score: 0 }];
  const gridClass = forceFour ? 'pk-team-grid--4' : getPkTeamGridClass(members.length);

  return (
    <div className={`pk-battle-team-pane ${gridClass}`}>
      {members.map((fighter) => (
        <PKVideoTile
          key={fighter.userId}
          fighter={fighter}
          accent={accent}
          empty={fighter.userId.startsWith('empty-')}
        />
      ))}
    </div>
  );
}

type PKCrossRoomSideColumnProps = {
  side: 'a' | 'b';
  layout: PKSeatLayout;
  roomMode: string;
  fighters: PKFighter[];
  mode: PKMode;
  muted: boolean;
  splitSeats: PartySeatMap;
  audioSideSeats: PKAudioSeats['sideA'];
  slotMicOn?: Partial<Record<PKAudioSlotId, boolean>>;
  onToggleSideMute: () => void;
  onSplitSeatClick?: (side: 'a' | 'b', seatKey: RoomSeatKey) => void;
  onSplitSeatToggleMic?: (side: 'a' | 'b', seatKey: RoomSeatKey) => void;
  onAudioSeatClick?: (slotId: PKAudioSlotId) => void;
  onAudioSeatToggleMic?: (slotId: PKAudioSlotId) => void;
};

export function PKCrossRoomSideColumn({
  side,
  layout,
  roomMode,
  fighters,
  mode,
  muted,
  splitSeats,
  audioSideSeats,
  slotMicOn,
  onToggleSideMute,
  onSplitSeatClick,
  onSplitSeatToggleMic,
  onAudioSeatClick,
  onAudioSeatToggleMic,
}: PKCrossRoomSideColumnProps) {
  const accent = side === 'a' ? 'fuchsia' : 'cyan';
  const label = side === 'a' ? 'Side A' : 'Side B';
  const showVideo = layout !== 'audio-only';
  const showCompactAudio = layout === 'live-compact';
  const showAudioSeats = layout === 'audio-only' || layout === 'split-rooms';
  const teamForceFour = mode === 'team' && (layout === 'live-compact' || layout === 'split-rooms' || layout === 'video-only');

  return (
    <div
      className={`pk-cross-room-side pk-cross-room-side--${side} pk-cross-room-side--layout-${layout} ${
        muted ? 'pk-cross-room-side--muted' : ''
      }`}
    >
      <p className="pk-cross-room-side-mode text-center text-[8px] font-black uppercase tracking-widest text-white/45">
        {formatPkRoomModeLabel(roomMode)}
      </p>

      {showVideo ? (
        <div
          className={`pk-cross-room-side-video ${
            mode === 'team' ? 'pk-cross-room-side-video--team' : 'pk-cross-room-side-video--single'
          }`}
        >
          {mode === 'single' ? (
            <PKVideoTile
              fighter={fighters[0] ?? { userId: side, name: label, score: 0 }}
              accent={accent}
            />
          ) : (
            <PKTeamPane fighters={fighters} accent={accent} label={label} forceFour={teamForceFour} />
          )}
        </div>
      ) : null}

      {showCompactAudio ? (
        <div className="pk-cross-room-side-compact-audio">
          <PKCompactAudioSide
            side={side}
            seats={audioSideSeats}
            muted={muted}
            slotMicOn={slotMicOn}
            onToggleSideMute={onToggleSideMute}
            onSeatClick={(slotId) => onAudioSeatClick?.(slotId)}
            onToggleMic={(slotId) => onAudioSeatToggleMic?.(slotId)}
          />
        </div>
      ) : null}

      {showAudioSeats ? (
        <div className="pk-cross-room-side-audio-seats">
          <PKSplitRoomPane
            side={side}
            seats={splitSeats}
            muted={muted}
            onToggleSideMute={onToggleSideMute}
            onSeatClick={(paneSide, seatKey) => onSplitSeatClick?.(paneSide, seatKey)}
            onToggleMic={(paneSide, seatKey) => onSplitSeatToggleMic?.(paneSide, seatKey)}
          />
        </div>
      ) : null}
    </div>
  );
}
