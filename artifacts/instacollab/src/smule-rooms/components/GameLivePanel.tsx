import { Gamepad2, X } from 'lucide-react';
import type { GameLiveState, GamePayload } from '../utils/liveRoomTypes';
import { DEFAULT_GAME_STATE, GAME_ROUNDS } from '../utils/liveRoomTypes';

type GameLivePanelProps = {
  open: boolean;
  isHost: boolean;
  state: GameLiveState;
  lastGame: GamePayload | null;
  selfUserId: string;
  selfName: string;
  onClose: () => void;
  onStart: () => void;
  onAnswer: (optionIndex: number) => void;
  onNextRound: () => void;
  onEnd: () => void;
};

export function GameLivePanel({
  open,
  isHost,
  state,
  lastGame,
  selfUserId,
  selfName,
  onClose,
  onStart,
  onAnswer,
  onNextRound,
  onEnd,
}: GameLivePanelProps) {
  if (!open) return null;

  const leaderboard = Object.entries(state.scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="absolute inset-x-0 bottom-[calc(5.5rem+var(--app-safe-bottom))] z-[110] px-3">
      <div className="mx-auto max-w-md rounded-2xl border border-violet-400/25 bg-black/80 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-200">
            <Gamepad2 className="h-4 w-4" />
            {state.title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/70 hover:bg-white/10"
            aria-label="Close game"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {state.phase === 'idle' || state.phase === 'lobby' ? (
          <div className="text-center">
            <p className="mb-3 text-sm text-white/70">Interactive trivia synced to everyone in the room.</p>
            {isHost ? (
              <button
                type="button"
                onClick={onStart}
                className="rounded-full bg-violet-500 px-4 py-2 text-sm font-bold text-white"
              >
                Start game
              </button>
            ) : (
              <p className="text-xs text-white/50">Waiting for host to start…</p>
            )}
          </div>
        ) : null}

        {state.phase === 'active' ? (
          <div>
            <p className="mb-2 text-sm font-semibold text-white">Round {state.round}</p>
            <p className="mb-3 text-sm text-white/85">{state.prompt}</p>
            <div className="grid grid-cols-2 gap-2">
              {state.options.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onAnswer(index)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-violet-500/20"
                >
                  {option}
                </button>
              ))}
            </div>
            {isHost ? (
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={onNextRound}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Next round
                </button>
                <button
                  type="button"
                  onClick={onEnd}
                  className="rounded-full bg-red-500/80 px-3 py-1.5 text-xs font-bold text-white"
                >
                  End
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {state.phase === 'results' ? (
          <div>
            <p className="mb-2 text-sm font-bold text-white">Results</p>
            <ul className="space-y-1 text-xs text-white/80">
              {leaderboard.map(([userId, score]) => (
                <li key={userId} className="flex justify-between">
                  <span>{userId === selfUserId ? selfName : userId.slice(0, 8)}</span>
                  <span>{score} pts</span>
                </li>
              ))}
            </ul>
            {isHost ? (
              <button
                type="button"
                onClick={onStart}
                className="mt-3 w-full rounded-full bg-violet-500 py-2 text-sm font-bold text-white"
              >
                Play again
              </button>
            ) : null}
          </div>
        ) : null}

        {lastGame?.action === 'answer' && lastGame.playerUserId !== selfUserId ? (
          <p className="mt-2 text-center text-[11px] text-violet-200/80">
            {lastGame.playerName} answered
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function startGameRound(roundIndex: number): GameLiveState {
  const round = GAME_ROUNDS[roundIndex % GAME_ROUNDS.length];
  return {
    ...DEFAULT_GAME_STATE,
    phase: 'active',
    gameId: 'trivia',
    title: 'Live Trivia',
    prompt: round.prompt,
    options: round.options,
    correctIndex: round.correctIndex,
    scores: {},
    round: roundIndex + 1,
    endsAt: Date.now() + 30_000,
  };
}

export function scoreGameAnswer(
  state: GameLiveState,
  optionIndex: number,
  playerUserId: string,
  playerName: string,
): GameLiveState {
  const correct = state.correctIndex === optionIndex;
  const delta = correct ? 10 : 2;
  const key = playerUserId || playerName;
  return {
    ...state,
    scores: {
      ...state.scores,
      [key]: (state.scores[key] ?? 0) + delta,
    },
  };
}
