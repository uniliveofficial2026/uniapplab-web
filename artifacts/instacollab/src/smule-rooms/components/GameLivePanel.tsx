import { useEffect, useMemo, useState } from 'react';
import { Activity, Coins, Gift, Gamepad2, ShoppingBag, Trophy, User, Users, X } from 'lucide-react';
import type { GameLiveState, GamePayload } from '../utils/liveRoomTypes';
import {
  hasClaimedDailyBonus,
  hasClaimedInviteReward,
  liveArcadeAchievements,
  LIVE_ARCADE_CORRECT_ANSWER_COINS,
  LIVE_ARCADE_DAILY_BONUS_COINS,
  LIVE_ARCADE_INVITE_REWARD_COINS,
  markDailyBonusClaimed,
  markInviteRewardClaimed,
  resolveLiveArcadeGame,
  scoreGameAnswer,
  startGameRound,
} from '../utils/liveArcadeGames';
import {
  getLiveArcadePlayerCount,
  recordArcadeGamePlay,
  setArcadeGameActive,
  subscribeArcadePlayerCounts,
} from '../utils/liveArcadePlayerCounts';
import {
  mergeArcadeLeaderboard,
  recordArcadeLeaderboardScore,
  subscribeArcadeLeaderboard,
} from '../utils/liveArcadeLeaderboard';
import { addWalletCoins, getLiveCoinsBalance, isLocalWalletLedgerAllowed } from '../../lib/walletKstarSync';
import { syncServerWalletBalance } from '../../lib/walletServerSync';
import { safeAvatarUrl } from '../../lib/safe';
import { V14_GAMES, V14_GAME_TABS } from './liveToolsV14Artwork';
import { LiveGiftRechargeModal } from './LiveGiftRechargeModal';
import './live-tools-approved-v15.css';

type GameMenuId = 'catalog' | 'bonus' | 'achievements' | 'leaderboard';

const GAME_ART_FALLBACK: Record<string, string> = {
  v14_lucky_wheel: '/live-tools-v13/games/lucky-wheel.svg',
  v14_treasure_box: '/live-tools-v13/games/ludo-king.svg',
  v14_fruit_slash: '/live-tools-v13/games/greedy-tap.svg',
  v14_bubble_shooter: '/live-tools-v13/games/crash.svg',
  v14_dice_king: '/live-tools-v13/games/live-trivia.svg',
  v14_card_battle: '/live-tools-v13/games/live-trivia.svg',
  v14_whack_a_mole: '/live-tools-v13/games/greedy-tap.svg',
  v14_fishing_master: '/live-tools-v13/games/fishing-master.svg',
};

function dailyBonusCountdown(now = new Date()): string {
  const reset = new Date(now);
  reset.setHours(24, 0, 0, 0);
  const seconds = Math.max(0, Math.floor((reset.getTime() - now.getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
}

function resolveGameArtwork(gameId: string, preferred?: string): string {
  if (preferred) return preferred;
  const row = V14_GAMES.find((game) => game.gameId === gameId);
  return row?.artwork || GAME_ART_FALLBACK[gameId] || '/live-tools-v13/games/live-trivia.svg';
}

function GameArtImage(props: { gameId: string; artwork: string; alt: string; className?: string }) {
  const [src, setSrc] = useState(props.artwork);
  useEffect(() => {
    setSrc(props.artwork);
  }, [props.artwork]);
  return (
    <img
      className={props.className}
      src={src}
      alt={props.alt}
      loading="lazy"
      decoding="async"
      onError={() => {
        const fallback = GAME_ART_FALLBACK[props.gameId];
        if (fallback && src !== fallback) setSrc(fallback);
      }}
    />
  );
}

type GameLivePanelProps = {
  open: boolean;
  isHost: boolean;
  state: GameLiveState;
  lastGame: GamePayload | null;
  selfUserId: string;
  selfName: string;
  receiverName?: string;
  receiverAvatarUrl?: string;
  diamondBalance?: number;
  onClose: () => void;
  onStart: (gameId?: string) => void;
  onAnswer: (optionIndex: number) => void;
  onNextRound: () => void;
  onEnd: () => void;
  onInviteFriends?: () => void;
  onOpenRecharge?: () => void;
  onCycleReceiver?: () => void;
};

export function GameLivePanel(props: GameLivePanelProps) {
  const {
    open,
    isHost,
    state,
    lastGame,
    selfUserId,
    selfName,
    receiverName = 'Room',
    receiverAvatarUrl,
    diamondBalance = 0,
    onClose,
    onStart,
    onAnswer,
    onNextRound,
    onEnd,
    onInviteFriends,
    onOpenRecharge,
    onCycleReceiver,
  } = props;
  const [tab, setTab] = useState('All Games');
  const [selectedId, setSelectedId] = useState(V14_GAMES[0].gameId);
  const [menu, setMenu] = useState<GameMenuId>('catalog');
  const [bonusClaimed, setBonusClaimed] = useState(() => hasClaimedDailyBonus(selfUserId));
  const [localPlay, setLocalPlay] = useState<GameLiveState | null>(null);
  const [bonusCountdown, setBonusCountdown] = useState(dailyBonusCountdown);
  const [playerCountTick, setPlayerCountTick] = useState(0);
  const [leaderboardTick, setLeaderboardTick] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [walletCoins, setWalletCoins] = useState(() =>
    Math.max(0, getLiveCoinsBalance(selfUserId) || diamondBalance || 0),
  );
  const receiverAvatar = safeAvatarUrl(receiverAvatarUrl || '');
  const displayCoins = Math.max(0, walletCoins);

  useEffect(() => {
    const syncLocal = () => {
      const next = Math.max(0, Math.floor(getLiveCoinsBalance(selfUserId) || diamondBalance || 0));
      setWalletCoins(next);
    };
    syncLocal();
    window.addEventListener('wallet-coins-updated', syncLocal);
    return () => window.removeEventListener('wallet-coins-updated', syncLocal);
  }, [selfUserId, diamondBalance, open]);

  useEffect(() => {
    if (!open || !selfUserId) return undefined;
    let cancelled = false;
    void syncServerWalletBalance(selfUserId)
      .then(() => {
        if (cancelled) return;
        setWalletCoins(Math.max(0, Math.floor(getLiveCoinsBalance(selfUserId) || diamondBalance || 0)));
        window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
      })
      .catch(() => {
        if (cancelled) return;
        setWalletCoins(Math.max(0, Math.floor(getLiveCoinsBalance(selfUserId) || diamondBalance || 0)));
      });
    return () => {
      cancelled = true;
    };
  }, [open, selfUserId, diamondBalance]);

  useEffect(() => {
    if (!open) setRechargeOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const update = () => setBonusCountdown(dailyBonusCountdown());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const bump = () => setPlayerCountTick((value) => value + 1);
    const unsubscribe = subscribeArcadePlayerCounts(bump);
    const timer = window.setInterval(bump, 5000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const bump = () => setLeaderboardTick((value) => value + 1);
    return subscribeArcadeLeaderboard(bump);
  }, [open]);

  const playState = state.phase === 'active' || state.phase === 'results' ? state : localPlay;
  const arcade = resolveLiveArcadeGame(playState?.gameId || selectedId);
  const playArtwork = resolveGameArtwork(playState?.gameId || selectedId);
  const playerKey = selfUserId || selfName || 'guest';

  const releaseActiveGame = (gameId?: string | null) => {
    const id = gameId || selectedId;
    if (!id) return;
    setArcadeGameActive(id, playerKey, false);
    setPlayerCountTick((value) => value + 1);
  };

  // Closed / unmounted games must not keep network/player-count loops active.
  useEffect(() => {
    if (!open) {
      releaseActiveGame(selectedId);
    }
  }, [open, selectedId, playerKey]);

  useEffect(() => {
    return () => {
      releaseActiveGame(selectedId);
    };
  }, [selectedId, playerKey]);

  useEffect(() => {
    setPickedIndex(null);
  }, [playState?.round, playState?.gameId, playState?.phase]);

  useEffect(() => {
    if (!playState || playState.phase !== 'active' || !playState.endsAt) {
      setSecondsLeft(0);
      return undefined;
    }
    const endsAt = playState.endsAt;
    const gameId = playState.gameId;
    let finished = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left > 0 || finished) return;
      finished = true;
      setArcadeGameActive(gameId, playerKey, false);
      setPlayerCountTick((value) => value + 1);
      setLocalPlay((prev) => {
        if (!prev || prev.phase !== 'active' || prev.gameId !== gameId) return prev;
        return { ...prev, phase: 'results', endsAt: null };
      });
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [playState?.endsAt, playState?.phase, playState?.gameId, playerKey]);

  const roomActiveByGame = useMemo(() => {
    if ((state.phase !== 'active' && state.phase !== 'results') || !state.gameId) return {} as Record<string, number>;
    return { [state.gameId]: Math.max(1, Object.keys(state.scores ?? {}).length) };
  }, [state.gameId, state.phase, state.scores]);

  const playerCountByGame = useMemo(() => {
    void playerCountTick;
    const map: Record<string, number> = {};
    for (const row of V14_GAMES) {
      map[row.gameId] = getLiveArcadePlayerCount(row.gameId, {
        seed: row.players,
        roomActivePlayers: roomActiveByGame[row.gameId] ?? 0,
      });
    }
    return map;
  }, [playerCountTick, roomActiveByGame]);

  const leaderboard = useMemo(() => {
    void leaderboardTick;
    const live = playState?.scores ?? state.scores ?? {};
    return mergeArcadeLeaderboard(live, selfUserId, selfName);
  }, [leaderboardTick, playState?.scores, selfName, selfUserId, state.scores]);

  const selfScore = useMemo(() => {
    const scores = playState?.scores ?? state.scores;
    const key = selfUserId || selfName;
    return scores[key] ?? 0;
  }, [playState?.scores, selfName, selfUserId, state.scores]);

  useEffect(() => {
    const scores = playState?.scores ?? state.scores;
    const key = selfUserId || selfName;
    const score = scores?.[key];
    if (!key || !score) return;
    recordArcadeLeaderboardScore(key, selfName || 'You', score);
  }, [playState?.scores, selfName, selfUserId, state.scores]);

  const openRecharge = () => {
    if (onOpenRecharge) {
      onOpenRecharge();
      return;
    }
    setRechargeOpen(true);
  };

  if (!open) return null;

  const closeMenus = () => setMenu('catalog');

  const inviteFriends = () => {
    if (onInviteFriends) {
      onInviteFriends();
    } else {
      try {
        void navigator.clipboard.writeText(window.location.href);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Invite link copied' }));
    }
    if (selfUserId && !hasClaimedInviteReward(selfUserId)) {
      if (!isLocalWalletLedgerAllowed(selfUserId)) {
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: 'Arcade coin rewards require the server wallet for this account.',
          }),
        );
      } else {
        addWalletCoins(selfUserId, LIVE_ARCADE_INVITE_REWARD_COINS);
        markInviteRewardClaimed(selfUserId);
        window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: `Invite sent · +${LIVE_ARCADE_INVITE_REWARD_COINS} coins`,
          }),
        );
      }
    }
  };

  const claimBonus = () => {
    if (!selfUserId || hasClaimedDailyBonus(selfUserId)) {
      setBonusClaimed(true);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Daily bonus already claimed today.' }));
      return;
    }
    if (!isLocalWalletLedgerAllowed(selfUserId)) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: 'Arcade coin rewards require the server wallet for this account.',
        }),
      );
      return;
    }
    addWalletCoins(selfUserId, LIVE_ARCADE_DAILY_BONUS_COINS);
    markDailyBonusClaimed(selfUserId);
    setBonusClaimed(true);
    window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
    window.dispatchEvent(
      new CustomEvent('app-toast', { detail: `+${LIVE_ARCADE_DAILY_BONUS_COINS} coins daily bonus` }),
    );
  };

  const launchGame = (gameId?: string) => {
    const id = gameId || selectedId;
    const selectedGame = V14_GAMES.find((row) => row.gameId === id) ?? V14_GAMES[0];
    if (!selectedGame.enabled) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: `${selectedGame.displayName} is unavailable.` }));
      return;
    }
    setSelectedId(selectedGame.gameId);
    setMenu('catalog');
    setPickedIndex(null);
    recordArcadeGamePlay(selectedGame.gameId, playerKey);
    setArcadeGameActive(selectedGame.gameId, playerKey, true);
    setPlayerCountTick((value) => value + 1);
    window.dispatchEvent(
      new CustomEvent('unilive-game-launch-request', {
        detail: { gameId: selectedGame.gameId, source: 'live-game-center' },
      }),
    );
    if (isHost) {
      onStart(selectedGame.gameId);
      return;
    }
    const next = startGameRound(0, selectedGame.gameId);
    setLocalPlay({ ...next, scores: { [selfUserId || selfName]: 0 } });
  };

  const answerLocal = (optionIndex: number) => {
    if (pickedIndex != null) return;
    setPickedIndex(optionIndex);
    const active = playState && playState.phase === 'active' ? playState : null;
    const correct = active ? active.correctIndex === optionIndex : false;
    if (correct && selfUserId && isLocalWalletLedgerAllowed(selfUserId)) {
      addWalletCoins(selfUserId, LIVE_ARCADE_CORRECT_ANSWER_COINS);
      window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: `Correct · +${LIVE_ARCADE_CORRECT_ANSWER_COINS} coins`,
        }),
      );
    } else if (!correct) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Miss — try the next round' }));
    }
    if (state.phase === 'active' || state.phase === 'results') {
      onAnswer(optionIndex);
      return;
    }
    setLocalPlay((prev) => {
      if (!prev || prev.phase !== 'active') return prev;
      return scoreGameAnswer(prev, optionIndex, selfUserId, selfName);
    });
  };

  if (playState && (playState.phase === 'active' || playState.phase === 'results')) {
    return (
      <div className="lt15-overlay" data-ui-id="live.games.v15.exact">
        <button className="lt15-scrim" onClick={onClose} aria-label="Close game" type="button" />
        <section className="lt15-sheet lt15-games">
          <div className="lt15-handle" />
          <div className="lt15-head">
            <div className="lt15-title">
              <Gamepad2 /> {playState.title}
            </div>
            <button className="lt15-icon-btn" onClick={onClose} type="button" aria-label="Close">
              <X size={17} />
            </button>
          </div>
          {playState.phase === 'active' ? (
            <>
              <div className="lt15-arcade-hero">
                <GameArtImage gameId={playState.gameId} artwork={playArtwork} alt={playState.title} />
                {secondsLeft > 0 ? (
                  <span className={`lt15-arcade-timer ${secondsLeft <= 5 ? 'is-low' : ''}`}>
                    {secondsLeft}s
                  </span>
                ) : null}
              </div>
              <div className="lt15-arcade-score">
                <span>Round {playState.round}</span>
                <span>Score {selfScore}</span>
              </div>
              <p style={{ fontSize: 12 }}>{playState.prompt}</p>
              <div className={`lt15-arcade-board is-${arcade.kind}`}>
                {playState.options.map((option, i) => {
                  const isPicked = pickedIndex === i;
                  const reveal = pickedIndex != null;
                  const isCorrect = playState.correctIndex === i;
                  return (
                    <button
                      key={`${playState.gameId}-${playState.round}-${option}`}
                      className={`lt15-select ${
                        reveal && isCorrect ? 'is-correct' : ''
                      } ${reveal && isPicked && !isCorrect ? 'is-wrong' : ''}`}
                      type="button"
                      onClick={() => answerLocal(i)}
                      disabled={pickedIndex != null}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {isHost && state.phase === 'active' ? (
                <div className="lt15-footer">
                  <button className="lt15-primary" type="button" onClick={onNextRound}>
                    Next round
                  </button>
                  <button
                    className="lt15-preview"
                    type="button"
                    onClick={() => {
                      releaseActiveGame(state.gameId);
                      onEnd();
                    }}
                  >
                    End
                  </button>
                </div>
              ) : localPlay?.phase === 'active' ? (
                <div className="lt15-footer">
                  <button
                    className="lt15-primary"
                    type="button"
                    onClick={() => {
                      setPickedIndex(null);
                      setLocalPlay((prev) => (prev ? startGameRound(prev.round, prev.gameId) : prev));
                    }}
                  >
                    Next round
                  </button>
                  <button
                    className="lt15-preview"
                    type="button"
                    onClick={() => {
                      releaseActiveGame(localPlay.gameId);
                      setLocalPlay((prev) => (prev ? { ...prev, phase: 'results', endsAt: null } : prev));
                    }}
                  >
                    End
                  </button>
                </div>
              ) : null}
              {lastGame?.action === 'answer' && lastGame.playerUserId !== selfUserId ? (
                <p className="lt15-sub">{lastGame.playerName} answered</p>
              ) : null}
            </>
          ) : (
            <>
              <div className="lt15-arcade-hero">
                <GameArtImage gameId={playState.gameId} artwork={playArtwork} alt={playState.title} />
              </div>
              <div>
                {leaderboard.length ? (
                  leaderboard.map((row, i) => (
                    <div key={row.id} className="lt15-manage-row">
                      <span>
                        #{i + 1} {row.name}
                      </span>
                      <b>{row.score}</b>
                    </div>
                  ))
                ) : (
                  <p className="lt15-manage-empty">No scores yet — play a round to rank.</p>
                )}
              </div>
              {isHost ? (
                <button
                  className="lt15-primary"
                  type="button"
                  onClick={() => launchGame(playState.gameId)}
                >
                  Play again
                </button>
              ) : (
                <button
                  className="lt15-primary"
                  type="button"
                  onClick={() => launchGame(playState.gameId)}
                >
                  Play again
                </button>
              )}
            </>
          )}
        </section>
      </div>
    );
  }

  const visible = V14_GAMES.filter((row) =>
    (V14_GAME_TABS[tab] ?? V14_GAME_TABS['All Games']).includes(row.gameId),
  );
  const achievements = liveArcadeAchievements(
    Object.fromEntries(leaderboard.map((row) => [row.id, row.score])),
    selfUserId,
  );
  const selected = V14_GAMES.find((row) => row.gameId === selectedId) ?? V14_GAMES[0];

  return (
    <>
    <div className="lt15-overlay" data-ui-id="live.games.v15.exact">
      <button className="lt15-scrim" onClick={onClose} aria-label="Close Game Center" type="button" />
      <section className="lt15-sheet lt15-games">
        <div className="lt15-handle" />
        <div className="lt15-head lt15-games-head">
          <div className="lt15-coins" aria-label={`${displayCoins.toLocaleString()} coins`}>
            <Coins size={26} aria-hidden />
            <span>My Coins</span>
            <strong>{displayCoins.toLocaleString()}</strong>
          </div>
          <div className="lt15-head-actions">
            <button type="button" className="lt15-recharge" onClick={openRecharge}>
              <ShoppingBag size={15} aria-hidden /> Recharge
            </button>
            <button className="lt15-icon-btn" onClick={onClose} type="button" aria-label="Close">
              <X size={17} />
            </button>
          </div>
        </div>
        <div className="lt15-games-banner">
          <div className="lt15-title">
            <Gamepad2 color="#c34dff" /> Game Center ✨
          </div>
          <div className="lt15-sub">Play fun games, win rewards, and challenge your friends!</div>
        </div>
        {menu !== 'catalog' ? (
          <div className="lt15-subpanel">
            <div className="lt15-head">
              <div className="lt15-title">
                {menu === 'bonus' ? 'Daily Bonus' : menu === 'achievements' ? 'Achievements' : 'Leaderboard'}
              </div>
              <button type="button" className="lt15-icon-btn" onClick={closeMenus} aria-label="Back">
                <X size={16} />
              </button>
            </div>
            {menu === 'bonus' ? (
              <div className="lt15-bonus-panel">
                <p>Reset in <b>{bonusCountdown}</b>. Claim free coins once per day.</p>
                <p>Wallet: <b>{displayCoins.toLocaleString()}</b> coins</p>
                <button className="lt15-primary" type="button" onClick={claimBonus} disabled={bonusClaimed}>
                  {bonusClaimed ? 'Claimed today' : `Claim ${LIVE_ARCADE_DAILY_BONUS_COINS} coins`}
                </button>
              </div>
            ) : null}
            {menu === 'achievements' ? (
              <div>
                {(achievements.length ? achievements : ['Play a round to unlock achievements']).map((row) => (
                  <div key={row} className="lt15-manage-row">
                    <span>{row}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {menu === 'leaderboard' ? (
              <div>
                {leaderboard.length ? (
                  leaderboard.map((row, i) => (
                    <div key={row.id} className="lt15-manage-row">
                      <span>
                        #{i + 1} {row.name}
                      </span>
                      <b>{row.score.toLocaleString()}</b>
                    </div>
                  ))
                ) : (
                  <p className="lt15-manage-empty">No scores yet — play a game to rank.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="lt15-catalog">
            <div className="lt15-tabs">
              {Object.keys(V14_GAME_TABS).map((label) => (
                <button
                  key={label}
                  type="button"
                  className={`lt15-tab ${tab === label ? 'is-active' : ''}`}
                  onClick={() => setTab(label)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="lt15-game-grid">
              {visible.map((row) => {
                const isSelected = selectedId === row.gameId;
                const isLive = Boolean(roomActiveByGame[row.gameId]);
                return (
                  <button
                    key={row.gameId}
                    type="button"
                    className={`lt15-game-card ${isSelected ? 'is-selected' : ''} ${isLive ? 'is-playing' : ''}`}
                    onClick={() => {
                      if (isSelected) {
                        launchGame(row.gameId);
                        return;
                      }
                      setSelectedId(row.gameId);
                    }}
                    onDoubleClick={() => launchGame(row.gameId)}
                    aria-pressed={isSelected}
                    aria-label={`${row.displayName}${row.badge ? ` ${row.badge}` : ''}`}
                  >
                    {row.badge ? (
                      <span className={`tag ${row.badge === 'NEW' ? 'new' : row.badge === 'PK' ? 'pk' : ''}`}>
                        {row.badge}
                      </span>
                    ) : null}
                    <span className="lt15-game-art">
                      <GameArtImage gameId={row.gameId} artwork={row.artwork} alt={row.displayName} />
                    </span>
                    <strong>{row.displayName}</strong>
                    <small aria-label={`${(playerCountByGame[row.gameId] ?? row.players).toLocaleString()} players`}>
                      <Users size={11} aria-hidden /> {(playerCountByGame[row.gameId] ?? row.players).toLocaleString()}
                    </small>
                  </button>
                );
              })}
            </div>
            <div className="lt15-game-menu">
              <button className="lt15-menu-card" type="button" onClick={() => setMenu('bonus')}>
                <Gift size={24} aria-hidden /><span>Daily Bonus</span><small>{bonusCountdown}</small>
              </button>
              <button className="lt15-menu-card" type="button" onClick={() => setMenu('achievements')}>
                <Trophy size={24} aria-hidden /><span>Achievements</span>
              </button>
              <button className="lt15-menu-card" type="button" onClick={() => setMenu('leaderboard')}>
                <Activity size={24} aria-hidden /><span>Leaderboard</span>
              </button>
              <button className="lt15-menu-card" type="button" onClick={inviteFriends}>
                <Users size={24} aria-hidden /><span>Invite Friends</span><small>+{LIVE_ARCADE_INVITE_REWARD_COINS}</small>
              </button>
            </div>
            <div className="lt15-footer">
              <div
                className="lt15-recipient"
                role={onCycleReceiver ? 'button' : undefined}
                tabIndex={onCycleReceiver ? 0 : undefined}
                onClick={() => onCycleReceiver?.()}
                onKeyDown={(event) => {
                  if (!onCycleReceiver) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onCycleReceiver();
                  }
                }}
                aria-label={onCycleReceiver ? `Send to ${receiverName}. Tap to change.` : `Send to ${receiverName}`}
              >
                <div className="lt15-recipient-avatar">
                  {receiverAvatar ? <img src={receiverAvatar} alt="" /> : <User size={20} aria-hidden />}
                </div>
                <div>
                  <small>Send to</small>
                  <b>{receiverName}</b>
                </div>
                <span>›</span>
              </div>
              <button className="lt15-primary" type="button" onClick={() => launchGame(selected.gameId)}>
                <Gamepad2 size={19} aria-hidden /> Play {selected.displayName} <span>›</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
    <LiveGiftRechargeModal
      open={rechargeOpen}
      onClose={() => setRechargeOpen(false)}
      zIndexClass="z-[3200]"
      onCredited={() => {
        setWalletCoins(Math.max(0, Math.floor(getLiveCoinsBalance(selfUserId))));
        window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
        window.dispatchEvent(
          new CustomEvent('app-toast', { detail: 'Coins added to your wallet' }),
        );
      }}
    />
    </>
  );
}

export { startGameRound, scoreGameAnswer } from '../utils/liveArcadeGames';
