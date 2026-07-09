import { useEffect, useMemo, useState } from 'react';
import { Mic, MicOff, Swords, Trophy, Users, Volume2, VolumeX } from 'lucide-react';
import { safeAvatarUrl } from '../../lib/safe';
import type { PKBattleState, PKFighter, PKMode, PKPayload } from '../utils/liveRoomTypes';
import { DEFAULT_PK_STATE } from '../utils/liveRoomTypes';
import {
  getPkTeamGridClass,
  isPkAudioBossSlot,
  padPkTeamFighters,
  pkWinnerSide,
  sumPkTeamScore,
  type PKAudioSeatId,
  type PKAudioSeats,
  type PKAudioSlotId,
} from '../utils/pkBattleLayout';

type PKBattleStageProps = {
  selfUserId: string;
  teamA: PKFighter[];
  teamB: PKFighter[];
  audioSeats: PKAudioSeats;
  audioSlotSpeaking?: Partial<Record<PKAudioSlotId, boolean>>;
  canTakeBossSlot?: boolean;
  initialMode?: PKMode;
  lastPk: PKPayload | null;
  isOwner: boolean;
  onEmitPk: (payload: PKPayload) => void;
  onStartPk?: () => void;
  onDisconnectPk?: () => void;
  onJoinAudioSlot?: (slotId: PKAudioSlotId) => void;
  onToggleAudioSlotMic?: (slotId: PKAudioSlotId) => void;
  variant?: 'stage' | 'banner';
  className?: string;
};

function applyPkScore(state: PKBattleState, userId: string, delta: number): PKBattleState {
  const next = { ...state };
  next.teamA = state.teamA.map((fighter) =>
    fighter.userId === userId
      ? { ...fighter, score: Math.max(0, fighter.score + delta) }
      : fighter,
  );
  next.teamB = state.teamB.map((fighter) =>
    fighter.userId === userId
      ? { ...fighter, score: Math.max(0, fighter.score + delta) }
      : fighter,
  );
  next.teamAScore = sumPkTeamScore(next.teamA);
  next.teamBScore = sumPkTeamScore(next.teamB);
  return next;
}

function applyPkPayload(
  state: PKBattleState,
  payload: PKPayload,
  fallbackTeams: { teamA: PKFighter[]; teamB: PKFighter[] },
): PKBattleState {
  switch (payload.action) {
    case 'sync':
      return payload.state;
    case 'invite': {
      const mode = payload.mode ?? state.mode ?? 'single';
      const teamA = payload.teamA ?? fallbackTeams.teamA;
      const teamB = payload.teamB ?? fallbackTeams.teamB;
      return {
        ...state,
        phase: 'inviting',
        mode,
        teamA,
        teamB,
        teamAScore: sumPkTeamScore(teamA),
        teamBScore: sumPkTeamScore(teamB),
        durationSec: payload.durationSec ?? state.durationSec,
        winnerSide: null,
      };
    }
    case 'accept': {
      const startedAt = Date.now();
      return {
        ...state,
        phase: 'active',
        startedAt,
        endsAt: startedAt + state.durationSec * 1000,
        teamA: state.teamA.map((fighter) => ({ ...fighter, score: 0 })),
        teamB: state.teamB.map((fighter) => ({ ...fighter, score: 0 })),
        teamAScore: 0,
        teamBScore: 0,
        winnerSide: null,
      };
    }
    case 'decline':
      return { ...DEFAULT_PK_STATE };
    case 'score':
      return applyPkScore(state, payload.userId, payload.delta);
    case 'end': {
      const winnerSide = payload.winnerSide ?? pkWinnerSide(state);
      return { ...state, phase: 'ended', winnerSide };
    }
    default:
      return state;
  }
}

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
      className={`pk-battle-side-mute absolute right-1.5 top-1.5 z-40 flex items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wide backdrop-blur-md transition active:scale-95 ${
        muted
          ? 'border-red-400/50 bg-red-950/80 text-red-200'
          : side === 'a'
            ? 'border-fuchsia-400/35 bg-black/65 text-fuchsia-100'
            : 'border-cyan-400/35 bg-black/65 text-cyan-100'
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
  mode,
}: {
  teamAScore: number;
  teamBScore: number;
  mode: PKMode;
}) {
  const total = Math.max(1, teamAScore + teamBScore);
  const leftPct = (teamAScore / total) * 100;
  const rightPct = (teamBScore / total) * 100;

  return (
    <div className="pk-battle-live-score pointer-events-none absolute inset-x-0 top-0 z-30 px-2 pt-1.5">
      <div className="mb-1 flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
        <span className="text-fuchsia-200">{mode === 'team' ? 'Team A' : 'Left'}</span>
        <span className="rounded-full bg-black/75 px-2 py-0.5 font-mono text-[10px] text-white">
          {teamAScore} : {teamBScore}
        </span>
        <span className="text-cyan-200">{mode === 'team' ? 'Team B' : 'Right'}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full border border-white/15 bg-black/55 shadow-lg backdrop-blur-sm">
        <div
          className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all duration-300"
          style={{ width: `${leftPct}%` }}
        />
        <div
          className="h-full bg-gradient-to-l from-cyan-500 to-blue-500 transition-all duration-300"
          style={{ width: `${rightPct}%` }}
        />
      </div>
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
  accent: 'fuchsia' | 'cyan';
  isSpeaking?: boolean;
  dimmed?: boolean;
  canJoinBoss?: boolean;
  onJoin?: (slotId: PKAudioSlotId) => void;
  onToggleMic?: (slotId: PKAudioSlotId) => void;
}) {
  const ring =
    accent === 'fuchsia'
      ? 'from-fuchsia-400 via-pink-500 to-fuchsia-600'
      : 'from-cyan-400 via-blue-500 to-cyan-600';
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
          accent === 'fuchsia' ? 'text-fuchsia-200' : 'text-cyan-200'
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
  accent: 'fuchsia' | 'cyan';
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
        accent="fuchsia"
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
        accent="cyan"
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
  teamA,
  teamB,
  audioSeats,
  audioSlotSpeaking,
  canTakeBossSlot = false,
  initialMode = 'single',
  lastPk,
  isOwner,
  onEmitPk,
  onStartPk,
  onDisconnectPk,
  onJoinAudioSlot,
  onToggleAudioSlotMic,
  variant = 'stage',
  className = '',
}: PKBattleStageProps) {
  const fallbackTeams = useMemo(() => ({ teamA, teamB }), [teamA, teamB]);
  const [state, setState] = useState<PKBattleState>(() => ({
    ...DEFAULT_PK_STATE,
    mode: initialMode,
    teamA,
    teamB,
    teamAScore: sumPkTeamScore(teamA),
    teamBScore: sumPkTeamScore(teamB),
  }));
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [inviteMode, setInviteMode] = useState<PKMode>(initialMode);
  const [sideAMuted, setSideAMuted] = useState(false);
  const [sideBMuted, setSideBMuted] = useState(false);

  useEffect(() => {
    if (!lastPk) return;
    setState((prev) => applyPkPayload(prev, lastPk, fallbackTeams));
    if (lastPk.action === 'invite' && lastPk.mode) {
      setInviteMode(lastPk.mode);
    }
  }, [lastPk, fallbackTeams]);

  useEffect(() => {
    if (state.phase !== 'active' || !state.endsAt) {
      setSecondsLeft(0);
      return undefined;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((state.endsAt! - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && isOwner) {
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
    <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-fuchsia-200">
      <span className="inline-flex items-center gap-1">
        {state.mode === 'team' ? <Users className="h-3.5 w-3.5" /> : <Swords className="h-3.5 w-3.5" />}
        {modeLabel}
      </span>
      {state.phase === 'active' ? (
        <span className="font-mono text-white">{secondsLeft}s</span>
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
                teamA: fallbackTeams.teamA,
                teamB: fallbackTeams.teamB,
              });
            }}
            className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide transition ${
              inviteMode === mode
                ? 'bg-fuchsia-500/30 text-fuchsia-100 border border-fuchsia-400/50'
                : 'bg-white/5 text-white/60 border border-white/10'
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
    return (
      <div className={`pk-battle-stage relative z-20 w-full shrink-0 px-2 sm:px-3 ${className}`}>
        <div className="pk-battle-stage-frame overflow-hidden rounded-2xl border border-fuchsia-400/25 bg-black shadow-[0_0_32px_rgba(192,38,211,0.15)]">
          <div className="pk-battle-stage-hud flex flex-col gap-2 border-b border-white/10 bg-black/70 px-3 py-2 backdrop-blur-md">
            {statusChip}
            {inviteActions}
          </div>

          <div className="pk-battle-video-shell relative">
            <PKLiveScoreBar teamAScore={state.teamAScore} teamBScore={state.teamBScore} mode={state.mode} />
            <div
              className={`pk-battle-stage-grid ${
                state.mode === 'team' ? 'pk-battle-stage-grid--team' : 'pk-battle-stage-grid--single'
              }`}
            >
              <div className={`pk-battle-side-column relative min-h-0 ${sideAMuted ? 'pk-battle-side-column--muted' : ''}`}>
                <PKSideMuteButton side="a" muted={sideAMuted} onToggle={() => setSideAMuted((v) => !v)} />
                {state.mode === 'single' ? (
                  <PKVideoTile
                    fighter={state.teamA[0] ?? { userId: 'a', name: 'Host', score: state.teamAScore }}
                    accent="fuchsia"
                  />
                ) : (
                  <PKTeamPane fighters={state.teamA} accent="fuchsia" label="Team A" forceFour />
                )}
              </div>
              <div className={`pk-battle-side-column relative min-h-0 ${sideBMuted ? 'pk-battle-side-column--muted' : ''}`}>
                <PKSideMuteButton side="b" muted={sideBMuted} onToggle={() => setSideBMuted((v) => !v)} />
                {state.mode === 'single' ? (
                  <PKVideoTile
                    fighter={state.teamB[0] ?? { userId: 'b', name: 'Rival', score: state.teamBScore }}
                    accent="cyan"
                  />
                ) : (
                  <PKTeamPane fighters={state.teamB} accent="cyan" label="Team B" forceFour />
                )}
              </div>
            </div>
          </div>

          <PKAudioSeatsRow
            audioSeats={audioSeats}
            sideAMuted={sideAMuted}
            sideBMuted={sideBMuted}
            audioSlotSpeaking={audioSlotSpeaking}
            canTakeBossSlot={canTakeBossSlot}
            onJoinAudioSlot={onJoinAudioSlot}
            onToggleAudioSlotMic={onToggleAudioSlotMic}
          />

          {state.phase === 'ended' && state.winnerSide ? (
            <p className="border-t border-white/10 bg-black/80 py-2 text-center text-xs text-white/85">
              {winnerName} wins
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-[calc(var(--app-safe-top)+3.25rem)] z-[95] px-3 ${className}`}
    >
      <div className="mx-auto max-w-lg rounded-2xl border border-fuchsia-400/30 bg-black/60 p-3 shadow-xl backdrop-blur-md">
        {statusChip}
        <div className="mt-2 flex justify-between text-sm font-semibold text-white">
          <span className="text-fuchsia-300">{state.teamAScore}</span>
          <span className="text-white/50">vs</span>
          <span className="text-cyan-300">{state.teamBScore}</span>
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
