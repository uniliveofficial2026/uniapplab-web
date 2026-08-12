import type { PKBattleState, PKFighter, PKPayload } from './liveRoomTypes';
import { DEFAULT_PK_STATE } from './liveRoomTypes';
import { pkWinnerSide, sumPkTeamScore } from './pkBattleLayout';

export type PKFallbackTeams = {
  teamA: PKFighter[];
  teamB: PKFighter[];
};

export function applyPkScore(state: PKBattleState, userId: string, delta: number): PKBattleState {
  const teamA = state.teamA.map((fighter) =>
    fighter.userId === userId
      ? { ...fighter, score: Math.max(0, fighter.score + delta) }
      : fighter,
  );
  const teamB = state.teamB.map((fighter) =>
    fighter.userId === userId
      ? { ...fighter, score: Math.max(0, fighter.score + delta) }
      : fighter,
  );
  return {
    ...state,
    teamA,
    teamB,
    teamAScore: sumPkTeamScore(teamA),
    teamBScore: sumPkTeamScore(teamB),
  };
}

/** Pure reducer — apply one PK bus payload onto battle state. */
export function applyPkPayload(
  state: PKBattleState,
  payload: PKPayload,
  fallbackTeams: PKFallbackTeams = { teamA: state.teamA, teamB: state.teamB },
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
        startedAt: null,
        endsAt: null,
        winnerSide: null,
      };
    }
    case 'accept': {
      const durationSec = payload.durationSec ?? state.durationSec;
      const startedAt = payload.startedAt ?? Date.now();
      const endsAt = payload.endsAt ?? startedAt + durationSec * 1000;
      const teamA = (payload.teamA ?? state.teamA).map((fighter) => ({ ...fighter, score: 0 }));
      const teamB = (payload.teamB ?? state.teamB).map((fighter) => ({ ...fighter, score: 0 }));
      return {
        ...state,
        phase: 'active',
        mode: payload.mode ?? state.mode,
        durationSec,
        startedAt,
        endsAt,
        teamA,
        teamB,
        teamAScore: 0,
        teamBScore: 0,
        winnerSide: null,
      };
    }
    case 'decline':
      return { ...DEFAULT_PK_STATE };
    case 'score':
      if (state.phase !== 'active') return state;
      return applyPkScore(state, payload.userId, payload.delta);
    case 'end': {
      if (state.phase === 'idle') return state;
      const winnerSide = payload.winnerSide ?? pkWinnerSide(state);
      return { ...state, phase: 'ended', winnerSide };
    }
    default:
      return state;
  }
}

export function buildPkAcceptPayload(state: PKBattleState): Extract<PKPayload, { action: 'accept' }> {
  const startedAt = Date.now();
  const durationSec = state.durationSec || 180;
  return {
    action: 'accept',
    startedAt,
    endsAt: startedAt + durationSec * 1000,
    durationSec,
    mode: state.mode,
    teamA: state.teamA.map((fighter) => ({ ...fighter, score: 0 })),
    teamB: state.teamB.map((fighter) => ({ ...fighter, score: 0 })),
  };
}
