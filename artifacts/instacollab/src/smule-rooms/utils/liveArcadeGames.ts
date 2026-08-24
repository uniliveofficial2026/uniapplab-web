import { DEFAULT_GAME_STATE, type GameLiveState } from './liveRoomTypes';

export type LiveArcadeRound = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type LiveArcadeSpec = {
  gameId: string;
  title: string;
  kind: 'pick' | 'spin' | 'tap';
  rounds: LiveArcadeRound[];
};

export const LIVE_ARCADE_GAMES: Record<string, LiveArcadeSpec> = {
  v14_lucky_wheel: {
    gameId: 'v14_lucky_wheel',
    title: 'Lucky Wheel',
    kind: 'spin',
    rounds: [
      { prompt: 'Call the wedge before the wheel stops!', options: ['💎 10', '🎁 50', '❌ Miss', '👑 Jackpot'], correctIndex: 1 },
      { prompt: 'Next spin — pick a prize lane', options: ['🪙 20', '🎀 80', '❌ Miss', '🌟 200'], correctIndex: 3 },
    ],
  },
  v14_treasure_box: {
    gameId: 'v14_treasure_box',
    title: 'Treasure Box',
    kind: 'pick',
    rounds: [
      { prompt: 'Open the box that hides the gem', options: ['📦 Oak', '📦 Gold', '📦 Crystal', '📦 Shadow'], correctIndex: 2 },
      { prompt: 'Which chest has the bonus key?', options: ['🗝️ Left', '🗝️ Center', '🗝️ Right', '🗝️ Hidden'], correctIndex: 0 },
    ],
  },
  v14_fruit_slash: {
    gameId: 'v14_fruit_slash',
    title: 'Fruit Slash',
    kind: 'tap',
    rounds: [
      { prompt: 'Slash the apple — skip the bombs!', options: ['🍎 Apple', '💣 Bomb', '🍉 Melon', '🍌 Banana'], correctIndex: 0 },
      { prompt: 'Cut the watermelon this round', options: ['🍋 Lemon', '🍉 Melon', '💣 Bomb', '🍇 Grapes'], correctIndex: 1 },
    ],
  },
  v14_bubble_shooter: {
    gameId: 'v14_bubble_shooter',
    title: 'Bubble Shooter',
    kind: 'tap',
    rounds: [
      { prompt: 'Pop the matching color cluster', options: ['🔵 Blue', '🔴 Red', '🟢 Green', '🟡 Yellow'], correctIndex: 1 },
      { prompt: 'Clear the last bubble color', options: ['🟣 Purple', '🟠 Orange', '🔵 Blue', '⚪ White'], correctIndex: 2 },
    ],
  },
  v14_dice_king: {
    gameId: 'v14_dice_king',
    title: 'Dice King',
    kind: 'pick',
    rounds: [
      { prompt: 'Call the high roll', options: ['🎲 1-2', '🎲 3', '🎲 4-5', '🎲 6'], correctIndex: 3 },
      { prompt: 'Even or lucky seven combo?', options: ['Even', 'Odd', 'Doubles', 'Lucky 7'], correctIndex: 2 },
    ],
  },
  v14_card_battle: {
    gameId: 'v14_card_battle',
    title: 'Card Battle',
    kind: 'pick',
    rounds: [
      { prompt: 'PK — play the winning suit', options: ['♠️ Spades', '♥️ Hearts', '♦️ Diamonds', '♣️ Clubs'], correctIndex: 0 },
      { prompt: 'Highest card wins this duel', options: ['Jack', 'Queen', 'King', 'Ace'], correctIndex: 3 },
    ],
  },
  v14_whack_a_mole: {
    gameId: 'v14_whack_a_mole',
    title: 'Whack a Mole',
    kind: 'tap',
    rounds: [
      { prompt: 'Whack the mole, not the decoy!', options: ['🕳️ Hole 1', '🐹 Mole', '🕳️ Hole 3', '🌸 Flower'], correctIndex: 1 },
      { prompt: 'Fast mole — tap the right hole', options: ['🐹 Left', '🕳️ Empty', '🐹 Right', '🕳️ Empty'], correctIndex: 2 },
    ],
  },
  v14_fishing_master: {
    gameId: 'v14_fishing_master',
    title: 'Fishing Master',
    kind: 'tap',
    rounds: [
      { prompt: 'Hook the golden fish', options: ['🐟 Blue', '🐠 Clown', '✨ Gold', '🦈 Shark'], correctIndex: 2 },
      { prompt: 'Catch the school leader', options: ['🦐 Shrimp', '🐟 Leader', '🐚 Shell', '🫧 Bubble'], correctIndex: 1 },
    ],
  },
  trivia: {
    gameId: 'trivia',
    title: 'Live Trivia',
    kind: 'pick',
    rounds: [
      { prompt: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctIndex: 1 },
      { prompt: 'How many players are on a soccer team on the field?', options: ['9', '10', '11', '12'], correctIndex: 2 },
      { prompt: 'What year did the first iPhone launch?', options: ['2005', '2006', '2007', '2008'], correctIndex: 2 },
    ],
  },
};

export function resolveLiveArcadeGame(gameId?: string | null): LiveArcadeSpec {
  if (gameId && LIVE_ARCADE_GAMES[gameId]) return LIVE_ARCADE_GAMES[gameId];
  return LIVE_ARCADE_GAMES.trivia;
}

export function startGameRound(roundIndex: number, gameId?: string | null): GameLiveState {
  const spec = resolveLiveArcadeGame(gameId);
  const round = spec.rounds[Math.abs(roundIndex) % spec.rounds.length];
  return {
    ...DEFAULT_GAME_STATE,
    phase: 'active',
    gameId: spec.gameId,
    title: spec.title,
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
  const delta = state.correctIndex === optionIndex ? 10 : 2;
  const key = playerUserId || playerName;
  return {
    ...state,
    scores: {
      ...state.scores,
      [key]: (state.scores[key] ?? 0) + delta,
    },
  };
}

const DAILY_BONUS_KEY = (userId: string) =>
  `live-arcade-daily-bonus:${userId}:${new Date().toISOString().slice(0, 10)}`;

export function hasClaimedDailyBonus(userId: string): boolean {
  if (!userId) return false;
  try {
    return sessionStorage.getItem(DAILY_BONUS_KEY(userId)) === '1';
  } catch {
    return false;
  }
}

export function markDailyBonusClaimed(userId: string): void {
  try {
    sessionStorage.setItem(DAILY_BONUS_KEY(userId), '1');
  } catch {
    /* ignore */
  }
}

export const LIVE_ARCADE_DAILY_BONUS_COINS = 20;
export const LIVE_ARCADE_CORRECT_ANSWER_COINS = 5;
export const LIVE_ARCADE_INVITE_REWARD_COINS = 100;

const INVITE_REWARD_KEY = (userId: string) =>
  `live-arcade-invite-reward:${userId}:${new Date().toISOString().slice(0, 10)}`;

export function hasClaimedInviteReward(userId: string): boolean {
  if (!userId) return false;
  try {
    return sessionStorage.getItem(INVITE_REWARD_KEY(userId)) === '1';
  } catch {
    return false;
  }
}

export function markInviteRewardClaimed(userId: string): void {
  try {
    sessionStorage.setItem(INVITE_REWARD_KEY(userId), '1');
  } catch {
    /* ignore */
  }
}

export function liveArcadeAchievements(scores: Record<string, number>, selfUserId: string): string[] {
  const score = scores[selfUserId] ?? Math.max(0, ...Object.values(scores), 0);
  const unlocked: string[] = [];
  if (score >= 2) unlocked.push('First play');
  if (score >= 10) unlocked.push('Room scorer');
  if (score >= 30) unlocked.push('Arcade star');
  if (Object.keys(scores).length >= 2) unlocked.push('Challenger');
  return unlocked;
}
