import { useEffect, useRef, useState } from 'react';
import { Armchair, Mic, MicOff, Swords, Trophy, Users, Volume2, VolumeX } from 'lucide-react';
import { safeAvatarUrl } from '../../lib/safe';
import type { PKBattleState, PKFighter, PKMode, PKPayload } from '../utils/liveRoomTypes';
import {
  getPkTeamGridClass,
  padPkTeamFighters,
  pkWinnerSide,
  type PKAudioSeats,
  type PKAudioSlotId,
} from '../utils/pkBattleLayout';

type PKAccent = 'blue' | 'gold';

function formatPkClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

type PKBattleStageProps = {
  selfUserId: string;
  /** Authoritative PK battle state owned by Room. */
  battle: PKBattleState;
  audioSeats: PKAudioSeats;
  audioSlotSpeaking?: Partial<Record<PKAudioSlotId, boolean>>;
  canTakeBossSlot?: boolean;
  isOwner: boolean;
  onEmitPk: (payload: PKPayload) => void;
  onStartPk?: () => void;
  onDisconnectPk?: () => void;
  onJoinAudioSlot?: (slotId: PKAudioSlotId) => void;
  onToggleAudioSlotMic?: (slotId: PKAudioSlotId) => void;
  variant?: 'stage' | 'banner';
  className?: string;
};

function PKVideoTile({
  fighter,
  accent,
  empty = false,
  layout = 'team',
  streak,
}: {
  fighter: PKFighter;
  accent: PKAccent;
  empty?: boolean;
  layout?: 'single' | 'team';
  streak?: number;
}) {
  const poster = safeAvatarUrl(fighter.avatarUrl);
  const scoreClass = accent === 'blue' ? 'text-[#4da3ff]' : 'text-[#ffc44d]';
  const wash =
    accent === 'blue'
      ? 'from-[#1a6cff]/35 via-transparent to-transparent'
      : 'from-[#ff9a1a]/30 via-transparent to-transparent';

  if (layout === 'single') {
    return (
      <div className="pk-battle-video-tile pk-battle-video-tile--single relative min-h-0 overflow-hidden bg-black">
        {!empty && poster ? (
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />
        )}
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${wash}`} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

        {typeof streak === 'number' && streak > 0 ? (
          <div className="absolute left-1.5 top-1.5 z-20 rounded-full bg-[#2f7dff] px-2 py-0.5 text-[9px] font-black text-white shadow-md">
            {streak} streak
          </div>
        ) : null}

        <div className="absolute bottom-2 left-1.5 z-20 flex max-w-[78%] items-center gap-1">
          <div className="flex min-w-0 items-center gap-1 rounded-full bg-black/55 px-2 py-1 backdrop-blur-md">
            <span className="truncate text-[10px] font-bold text-white">{fighter.name}</span>
          </div>
        </div>

        {!empty ? (
          <p className={`absolute bottom-2 right-2 z-20 text-lg font-black leading-none drop-shadow-md ${scoreClass}`}>
            {fighter.score}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pk-battle-video-tile relative min-h-0 overflow-hidden bg-black">
      {!empty && poster ? (
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />
      )}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${wash}`} />
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-1.5 pb-1.5 pt-5">
        <p className="truncate text-center text-[10px] font-black text-white">{fighter.name}</p>
        {!empty ? <p className={`text-center text-sm font-black ${scoreClass}`}>{fighter.score}</p> : null}
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
  accent: PKAccent;
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
      className={`pk-battle-side-mute absolute right-1.5 top-8 z-40 flex items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wide backdrop-blur-md transition active:scale-95 ${
        muted
          ? 'border-red-400/50 bg-red-950/80 text-red-200'
          : side === 'a'
            ? 'border-blue-400/40 bg-black/65 text-blue-100'
            : 'border-amber-400/40 bg-black/65 text-amber-100'
      }`}
      title={muted ? `Unmute ${side === 'a' ? 'left' : 'right'} side` : `Mute ${side === 'a' ? 'left' : 'right'} side`}
      aria-pressed={muted}
    >
      {muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
      <span>{muted ? 'Muted' : 'Mute'}</span>
    </button>
  );
}

function PKLiveScoreBar({
  teamAScore,
  teamBScore,
  secondsLeft,
  phase,
}: {
  teamAScore: number;
  teamBScore: number;
  secondsLeft: number;
  phase: PKBattleState['phase'];
}) {
  const total = teamAScore + teamBScore;
  const leftPct = total === 0 ? 50 : (teamAScore / total) * 100;
  const clock =
    phase === 'active'
      ? formatPkClock(secondsLeft)
      : phase === 'ended'
        ? '00:00'
        : phase === 'inviting'
          ? 'Ready'
          : formatPkClock(secondsLeft);

  return (
    <div className="pk-battle-live-score pointer-events-none absolute inset-x-0 top-0 z-30">
      <div className="pk-battle-score-track relative flex h-5 overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
        <div
          className="relative flex h-full items-center bg-gradient-to-r from-[#1a6cff] via-[#2f7dff] to-[#4da3ff] transition-all duration-300"
          style={{ width: `${leftPct}%` }}
        >
          <span className="pl-2 text-[11px] font-black tabular-nums text-white drop-shadow">{teamAScore}</span>
        </div>
        <div className="relative flex h-full flex-1 items-center justify-end bg-gradient-to-l from-[#f5a623] via-[#ffb020] to-[#ffc44d] transition-all duration-300">
          <span className="pr-2 text-[11px] font-black tabular-nums text-white drop-shadow">{teamBScore}</span>
        </div>
        <div
          className="pk-battle-score-flare pointer-events-none absolute top-1/2 z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(255,220,120,0.75)_35%,transparent_70%)]"
          style={{ left: `${leftPct}%` }}
        />
      </div>

      <div className="mt-1 flex justify-center">
        <div className="pk-battle-timer-pill inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#12141c]/92 px-2.5 py-0.5 shadow-lg backdrop-blur-md">
          <span className="pk-battle-pk-mark text-[11px] font-black italic tracking-tight" aria-hidden>
            <span className="text-[#ff8a1a]">P</span>
            <span className="text-[#3d8bff]">K</span>
          </span>
          <span className="font-mono text-[11px] font-bold tabular-nums text-white">{clock}</span>
        </div>
      </div>
    </div>
  );
}

function PKStatusBanner({
  mode,
  phase,
  winnerName,
}: {
  mode: PKMode;
  phase: PKBattleState['phase'];
  winnerName?: string;
}) {
  const label =
    phase === 'ended' && winnerName
      ? `${winnerName} wins the PK`
      : phase === 'inviting'
        ? 'PK connected — start when both sides are ready'
        : mode === 'team'
          ? 'Team PK-ing. The team with the highest charm wins'
          : '1v1 PK-ing. The side with the highest charm wins';

  return (
    <div className="pk-battle-status-banner relative z-20 flex items-center justify-between gap-2 border-t border-white/10 bg-[#0b1220]/92 px-2.5 py-1.5">
      <button
        type="button"
        className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2f7dff] text-white shadow-md active:scale-95"
        title="Blue side seats"
        aria-label="Blue side seats"
      >
        <Armchair size={14} />
      </button>
      <p className="min-w-0 flex-1 truncate text-center text-[10px] font-semibold text-white/85">
        {label}
        <span className="ml-1 text-[#7eb6ff]">Details &gt;</span>
      </p>
      <button
        type="button"
        className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f5a623] text-white shadow-md active:scale-95"
        title="Gold side seats"
        aria-label="Gold side seats"
      >
        <Armchair size={14} />
      </button>
    </div>
  );
}

function PKAudioSeat({
  slotId,
  fighter,
  role,
  accent,
  isSpeaking = false,
  dimmed = false,
  canJoinBoss = false,
  onJoin,
  onToggleMic,
}: {
  slotId: PKAudioSlotId;
  fighter: PKFighter | null;
  role: 'boss' | 'guest';
  accent: PKAccent;
  isSpeaking?: boolean;
  dimmed?: boolean;
  canJoinBoss?: boolean;
  onJoin?: (slotId: PKAudioSlotId) => void;
  onToggleMic?: (slotId: PKAudioSlotId) => void;
}) {
  const ring =
    accent === 'blue'
      ? 'from-[#2f7dff] via-[#4da3ff] to-[#1a6cff]'
      : 'from-[#f5a623] via-[#ffc44d] to-[#ff9a1a]';
  const label = role === 'boss' ? 'Admin' : 'Guest';
  const name = fighter?.name ?? 'Join';
  const poster = fighter ? safeAvatarUrl(fighter.avatarUrl) : null;
  const joinable = !fighter && (role === 'guest' || canJoinBoss);

  return (
    <button
      type="button"
      onClick={() => {
        if (fighter && onToggleMic) {
          onToggleMic(slotId);
          return;
        }
        if (joinable && onJoin) onJoin(slotId);
      }}
      className={`pk-battle-audio-seat flex flex-col items-center transition ${
        dimmed ? 'opacity-35' : ''
      } ${joinable ? 'cursor-pointer hover:scale-105' : fighter ? 'cursor-pointer' : 'cursor-default'}`}
      title={
        fighter
          ? isSpeaking
            ? 'Tap to mute mic'
            : 'Tap to unmute mic'
          : role === 'boss'
            ? 'Admin boss seat'
            : 'Tap to join guest audio'
      }
    >
      <div
        className={`pk-battle-audio-seat-avatar relative rounded-full bg-gradient-to-tr p-[1.5px] ${ring} ${
          fighter ? 'opacity-100' : 'opacity-50'
        }`}
      >
        {poster ? (
          <img src={poster} alt="" className="h-full w-full rounded-full border border-[#07010a] object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full border border-[#07010a] bg-[#120818] text-[8px] font-black text-white/35">
            +
          </div>
        )}
        <div
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border border-[#07010a] p-[2px] ${
            fighter
              ? isSpeaking
                ? 'bg-emerald-500'
                : 'bg-red-500'
              : 'bg-zinc-600'
          }`}
        >
          {fighter && isSpeaking ? (
            <Mic size={7} className="text-white" />
          ) : (
            <MicOff size={7} className="text-white/80" />
          )}
        </div>
      </div>
      <span className="pk-battle-audio-seat-role mt-0.5 text-[7px] font-black uppercase tracking-wide text-white/45">
        {label}
      </span>
      <span
        className={`pk-battle-audio-seat-name max-w-[2.75rem] truncate text-[8px] font-bold ${
          accent === 'blue' ? 'text-blue-200' : 'text-amber-200'
        }`}
      >
        {name}
      </span>
    </button>
  );
}

function PKAudioSideColumn({
  side,
  seats,
  accent,
  slotIds,
  sideMuted,
  audioSlotSpeaking,
  canTakeBossSlot,
  onJoinAudioSlot,
  onToggleAudioSlotMic,
}: {
  side: 'a' | 'b';
  seats: PKAudioSeats['sideA'];
  accent: PKAccent;
  slotIds: { boss: PKAudioSlotId; guests: [PKAudioSlotId, PKAudioSlotId] };
  sideMuted: boolean;
  audioSlotSpeaking?: Partial<Record<PKAudioSlotId, boolean>>;
  canTakeBossSlot?: boolean;
  onJoinAudioSlot?: (slotId: PKAudioSlotId) => void;
  onToggleAudioSlotMic?: (slotId: PKAudioSlotId) => void;
}) {
  return (
    <div className={`pk-battle-audio-side pk-battle-audio-side--${side}`}>
      <PKAudioSeat
        slotId={slotIds.boss}
        fighter={seats.boss}
        role="boss"
        accent={accent}
        isSpeaking={audioSlotSpeaking?.[slotIds.boss]}
        dimmed={sideMuted}
        canJoinBoss={canTakeBossSlot}
        onJoin={onJoinAudioSlot}
        onToggleMic={onToggleAudioSlotMic}
      />
      <PKAudioSeat
        slotId={slotIds.guests[0]}
        fighter={seats.guests?.[0] ?? null}
        role="guest"
        accent={accent}
        isSpeaking={audioSlotSpeaking?.[slotIds.guests[0]]}
        dimmed={sideMuted}
        onJoin={onJoinAudioSlot}
        onToggleMic={onToggleAudioSlotMic}
      />
      <PKAudioSeat
        slotId={slotIds.guests[1]}
        fighter={seats.guests?.[1] ?? null}
        role="guest"
        accent={accent}
        isSpeaking={audioSlotSpeaking?.[slotIds.guests[1]]}
        dimmed={sideMuted}
        onJoin={onJoinAudioSlot}
        onToggleMic={onToggleAudioSlotMic}
      />
    </div>
  );
}

function PKAudioSeatsRow({
  audioSeats,
  sideAMuted,
  sideBMuted,
  audioSlotSpeaking,
  canTakeBossSlot,
  onJoinAudioSlot,
  onToggleAudioSlotMic,
}: {
  audioSeats: PKAudioSeats;
  sideAMuted: boolean;
  sideBMuted: boolean;
  audioSlotSpeaking?: Partial<Record<PKAudioSlotId, boolean>>;
  canTakeBossSlot?: boolean;
  onJoinAudioSlot?: (slotId: PKAudioSlotId) => void;
  onToggleAudioSlotMic?: (slotId: PKAudioSlotId) => void;
}) {
  return (
    <div className="pk-battle-audio-row grid grid-cols-2 gap-2 border-t border-white/10 bg-black/80 px-2 py-1.5">
      <PKAudioSideColumn
        side="a"
        seats={audioSeats.sideA}
        accent="blue"
        slotIds={{ boss: 'a_boss', guests: ['a_guest1', 'a_guest2'] }}
        sideMuted={sideAMuted}
        audioSlotSpeaking={audioSlotSpeaking}
        canTakeBossSlot={canTakeBossSlot}
        onJoinAudioSlot={onJoinAudioSlot}
        onToggleAudioSlotMic={onToggleAudioSlotMic}
      />
      <PKAudioSideColumn
        side="b"
        seats={audioSeats.sideB}
        accent="gold"
        slotIds={{ boss: 'b_boss', guests: ['b_guest1', 'b_guest2'] }}
        sideMuted={sideBMuted}
        audioSlotSpeaking={audioSlotSpeaking}
        canTakeBossSlot={canTakeBossSlot}
        onJoinAudioSlot={onJoinAudioSlot}
        onToggleAudioSlotMic={onToggleAudioSlotMic}
      />
    </div>
  );
}

export function PKBattleStage({
  battle: state,
  audioSeats,
  audioSlotSpeaking,
  canTakeBossSlot = false,
  isOwner,
  onEmitPk,
  onStartPk,
  onDisconnectPk,
  onJoinAudioSlot,
  onToggleAudioSlotMic,
  variant = 'stage',
  className = '',
}: PKBattleStageProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [inviteMode, setInviteMode] = useState<PKMode>(state.mode);
  const [sideAMuted, setSideAMuted] = useState(false);
  const [sideBMuted, setSideBMuted] = useState(false);
  const endEmittedRef = useRef(false);

  useEffect(() => {
    setInviteMode(state.mode);
  }, [state.mode]);

  useEffect(() => {
    if (state.phase !== 'active') {
      endEmittedRef.current = false;
    }
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== 'active' || !state.endsAt) {
      setSecondsLeft(state.phase === 'active' ? 0 : state.durationSec);
      return undefined;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((state.endsAt! - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && isOwner && !endEmittedRef.current) {
        endEmittedRef.current = true;
        onEmitPk({ action: 'end', winnerSide: pkWinnerSide(state) });
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [state, isOwner, onEmitPk]);

  if (state.phase === 'idle') return null;

  const modeLabel = state.mode === 'team' ? 'Team PK' : '1v1 PK';
  const winnerName =
    state.winnerSide === 'a'
      ? state.teamA[0]?.name ?? 'Team A'
      : state.teamB[0]?.name ?? 'Team B';

  const statusChip = (
    <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-blue-100">
      <span className="inline-flex items-center gap-1">
        {state.mode === 'team' ? <Users className="h-3.5 w-3.5" /> : <Swords className="h-3.5 w-3.5" />}
        {modeLabel}
      </span>
      {state.phase === 'active' ? (
        <span className="font-mono text-white">{formatPkClock(secondsLeft)}</span>
      ) : state.phase === 'inviting' ? (
        <span className="text-amber-300">Connected</span>
      ) : state.phase === 'ended' ? (
        <span className="inline-flex items-center gap-1 text-yellow-300">
          <Trophy className="h-3.5 w-3.5" />
          Winner
        </span>
      ) : null}
    </div>
  );

  const modePicker =
    state.phase === 'inviting' && isOwner ? (
      <div className="flex gap-1.5">
        {(['single', 'team'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              setInviteMode(mode);
              onEmitPk({
                action: 'invite',
                opponentUserId: state.teamB[0]?.userId ?? '',
                opponentName: state.teamB[0]?.name ?? 'Opponent',
                mode,
                teamA: state.teamA,
                teamB: state.teamB,
                durationSec: state.durationSec,
              });
            }}
            className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide transition ${
              inviteMode === mode
                ? 'border border-blue-400/50 bg-blue-500/30 text-blue-50'
                : 'border border-white/10 bg-white/5 text-white/60'
            }`}
          >
            {mode === 'single' ? '1v1' : 'Team'}
          </button>
        ))}
      </div>
    ) : null;

  const inviteActions =
    state.phase === 'inviting' && isOwner ? (
      <div className="flex flex-wrap items-center gap-2">
        {modePicker}
        {onDisconnectPk ? (
          <button
            type="button"
            onClick={onDisconnectPk}
            className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-white/80 transition hover:bg-white/15 active:scale-95"
          >
            Disconnect
          </button>
        ) : null}
        {onStartPk ? (
          <button
            type="button"
            onClick={onStartPk}
            className="rounded-full border border-blue-400/50 bg-gradient-to-b from-blue-600 to-blue-800 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-white shadow-lg transition hover:from-blue-500 hover:to-blue-700 active:scale-95"
          >
            Start PK
          </button>
        ) : null}
      </div>
    ) : modePicker;

  if (variant === 'stage') {
    const isSingle = state.mode === 'single';
    return (
      <div className={`pk-battle-stage relative z-20 w-full shrink-0 ${isSingle ? '' : 'px-2 sm:px-3'} ${className}`}>
        <div
          className={`pk-battle-stage-frame overflow-hidden bg-black ${
            isSingle
              ? 'pk-battle-stage-frame--single rounded-xl border border-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.45)]'
              : 'rounded-2xl border border-blue-400/25 shadow-[0_0_32px_rgba(47,125,255,0.18)]'
          }`}
        >
          {state.phase === 'inviting' || state.phase === 'ended' ? (
            <div className="pk-battle-stage-hud flex flex-col gap-2 border-b border-white/10 bg-black/70 px-3 py-2 backdrop-blur-md">
              {statusChip}
              {inviteActions}
            </div>
          ) : null}

          <div className={`pk-battle-video-shell relative ${isSingle ? 'pk-battle-video-shell--single' : ''}`}>
            <PKLiveScoreBar
              teamAScore={state.teamAScore}
              teamBScore={state.teamBScore}
              secondsLeft={state.phase === 'active' ? secondsLeft : state.durationSec}
              phase={state.phase}
            />
            <div
              className={`pk-battle-stage-grid ${
                isSingle ? 'pk-battle-stage-grid--single' : 'pk-battle-stage-grid--team'
              }`}
            >
              <div
                className={`pk-battle-side-column relative min-h-0 ${
                  isSingle ? 'pk-battle-side-column--single pk-battle-side-column--blue' : ''
                } ${sideAMuted ? 'pk-battle-side-column--muted' : ''}`}
              >
                <PKSideMuteButton side="a" muted={sideAMuted} onToggle={() => setSideAMuted((v) => !v)} />
                {isSingle ? (
                  <PKVideoTile
                    fighter={state.teamA[0] ?? { userId: 'a', name: 'Host', score: state.teamAScore }}
                    accent="blue"
                    layout="single"
                  />
                ) : (
                  <PKTeamPane fighters={state.teamA} accent="blue" label="Team A" forceFour />
                )}
              </div>
              <div
                className={`pk-battle-side-column relative min-h-0 ${
                  isSingle ? 'pk-battle-side-column--single pk-battle-side-column--gold' : ''
                } ${sideBMuted ? 'pk-battle-side-column--muted' : ''}`}
              >
                <PKSideMuteButton side="b" muted={sideBMuted} onToggle={() => setSideBMuted((v) => !v)} />
                {isSingle ? (
                  <PKVideoTile
                    fighter={state.teamB[0] ?? { userId: 'b', name: 'Rival', score: state.teamBScore }}
                    accent="gold"
                    layout="single"
                  />
                ) : (
                  <PKTeamPane fighters={state.teamB} accent="gold" label="Team B" forceFour />
                )}
              </div>
            </div>
          </div>

          <PKStatusBanner
            mode={state.mode}
            phase={state.phase}
            winnerName={state.phase === 'ended' ? winnerName : undefined}
          />

          <PKAudioSeatsRow
            audioSeats={audioSeats}
            sideAMuted={sideAMuted}
            sideBMuted={sideBMuted}
            audioSlotSpeaking={audioSlotSpeaking}
            canTakeBossSlot={canTakeBossSlot}
            onJoinAudioSlot={onJoinAudioSlot}
            onToggleAudioSlotMic={onToggleAudioSlotMic}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-[calc(var(--app-safe-top)+3.25rem)] z-[95] px-3 ${className}`}
    >
      <div className="mx-auto max-w-lg rounded-2xl border border-blue-400/30 bg-black/60 p-3 shadow-xl backdrop-blur-md">
        {statusChip}
        <div className="mt-2 flex justify-between text-sm font-semibold text-white">
          <span className="text-[#4da3ff]">{state.teamAScore}</span>
          <span className="text-white/50">vs</span>
          <span className="text-[#ffc44d]">{state.teamBScore}</span>
        </div>
      </div>
    </div>
  );
}

export function buildPkInvitePayload(
  opponentUserId: string,
  opponentName: string,
  options?: {
    mode?: PKMode;
    teamA?: PKFighter[];
    teamB?: PKFighter[];
    durationSec?: number;
  },
): PKPayload {
  return {
    action: 'invite',
    opponentUserId,
    opponentName,
    mode: options?.mode ?? 'single',
    teamA: options?.teamA,
    teamB: options?.teamB,
    durationSec: options?.durationSec ?? 180,
  };
}

export function pkScoreFromGift(starValue: number): number {
  return Math.max(1, Math.floor(starValue / 5));
}
