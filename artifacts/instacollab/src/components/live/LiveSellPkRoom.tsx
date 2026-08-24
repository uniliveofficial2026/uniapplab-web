import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import {
  ChevronLeft,
  Gift,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Package,
  ShoppingBag,
  SmilePlus,
  Sparkles,
  Star,
  Trophy,
  UsersRound,
  Zap,
} from 'lucide-react';
import './live-sell-pk-room.css';

export type LiveSellPkCreator = {
  id: string;
  name: string;
  avatarUrl?: string;
  audienceLabel: string;
  followersLabel?: string;
  verified?: boolean;
  isFollowing?: boolean;
};

export type LiveSellPkSupporter = {
  id: string;
  name: string;
  avatarUrl?: string;
  rank: number;
};

export type LiveSellPkComment = {
  id: string;
  userId?: string;
  userName: string;
  userAvatarUrl?: string;
  level?: number;
  message: string;
};

export type LiveSellPkGiftFeedItem = {
  id: string;
  senderName: string;
  senderAvatarUrl?: string;
  giftName: string;
  giftIcon?: ReactNode;
  quantity: number;
  receiverUserId?: string;
};

export type LiveSellPkFlashSale = {
  id: string;
  title: string;
  imageUrl?: string;
  remainingLabel: string;
};

export type LiveSellPkRoomProps = {
  roomId: string;
  leftCreator: LiveSellPkCreator;
  rightCreator: LiveSellPkCreator;
  leftCamera: ReactNode;
  rightCamera: ReactNode;
  leftScore: number;
  rightScore: number;
  remainingSeconds: number;
  multiplier?: number;
  viewersLabel: string;
  connectionLabel: string;
  hourlyRankLabel?: string;
  hourlyRankTimeLabel?: string;
  leftWinStreak?: number;
  rightWinStreak?: number;
  leftSupporters?: LiveSellPkSupporter[];
  rightSupporters?: LiveSellPkSupporter[];
  comments: LiveSellPkComment[];
  giftFeed?: LiveSellPkGiftFeedItem[];
  flashSale?: LiveSellPkFlashSale | null;
  isHost: boolean;
  isPkEnding?: boolean;
  isLiveEnding?: boolean;
  onLeaveRoom: () => void;
  onEndPk?: () => Promise<void> | void;
  onEndLive?: () => Promise<void> | void;
  onOpenViewerList: () => void;
  onOpenRanking: () => void;
  onOpenDailyGift: () => void;
  onOpenMyGifts: () => void;
  onOpenFlashSale: () => void;
  onFollowCreator: (creatorId: string) => void;
  onSendComment: (message: string, clientId: string) => Promise<void> | void;
  onOpenStickers: () => void;
  onOpenGiftPanel: () => void;
  onOpenGuests: () => void;
  onOpenPkPanel: () => void;
  onOpenEffects: () => void;
  onOpenMore: () => void;
  onOpenShop: () => void;
};

function formatTimer(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function formatScore(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)),
  );
}

function clientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `live-sell-pk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function Supporters({ supporters = [] }: { supporters?: LiveSellPkSupporter[] }) {
  return (
    <div className="ulspk-supporters" aria-label="Top supporters">
      {supporters.slice(0, 3).map((supporter) => (
        <div className="ulspk-supporter" key={supporter.id} title={supporter.name}>
          {supporter.avatarUrl ? <img src={supporter.avatarUrl} alt="" /> : <UsersRound aria-hidden="true" />}
          <span>{supporter.rank}</span>
        </div>
      ))}
    </div>
  );
}

function CreatorCard({
  creator,
  side,
  supporters,
  onFollowCreator,
}: {
  creator: LiveSellPkCreator;
  side: 'left' | 'right';
  supporters?: LiveSellPkSupporter[];
  onFollowCreator: (creatorId: string) => void;
}) {
  return (
    <div className={`ulspk-creator-card ulspk-creator-card--${side}`} data-user-id={creator.id}>
      <div className="ulspk-creator-main">
        <div className="ulspk-avatar">
          {creator.avatarUrl ? <img src={creator.avatarUrl} alt={`${creator.name} avatar`} /> : <UsersRound aria-hidden="true" />}
        </div>
        <div className="ulspk-creator-copy">
          <div className="ulspk-creator-name">{creator.name}</div>
          <div className="ulspk-creator-audience"><Star aria-hidden="true" /> {creator.audienceLabel}</div>
        </div>
        {!creator.isFollowing ? (
          <button type="button" className="ulspk-follow" onClick={() => onFollowCreator(creator.id)} aria-label={`Follow ${creator.name}`}>
            +
          </button>
        ) : null}
      </div>
      <Supporters supporters={supporters} />
    </div>
  );
}

export function LiveSellPkRoom({
  roomId,
  leftCreator,
  rightCreator,
  leftCamera,
  rightCamera,
  leftScore,
  rightScore,
  remainingSeconds,
  multiplier = 1,
  viewersLabel,
  connectionLabel,
  hourlyRankLabel = 'Hourly Top 1',
  hourlyRankTimeLabel = '12:45',
  leftWinStreak = 0,
  rightWinStreak = 0,
  leftSupporters,
  rightSupporters,
  comments,
  giftFeed = [],
  flashSale = null,
  isHost,
  isPkEnding = false,
  isLiveEnding = false,
  onLeaveRoom,
  onEndPk,
  onEndLive,
  onOpenViewerList,
  onOpenRanking,
  onOpenDailyGift,
  onOpenMyGifts,
  onOpenFlashSale,
  onFollowCreator,
  onSendComment,
  onOpenStickers,
  onOpenGiftPanel,
  onOpenGuests,
  onOpenPkPanel,
  onOpenEffects,
  onOpenMore,
  onOpenShop,
}: LiveSellPkRoomProps) {
  const [draft, setDraft] = useState('');
  const [confirmEndPk, setConfirmEndPk] = useState(false);
  const [confirmEndLive, setConfirmEndLive] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const total = Math.max(0, leftScore) + Math.max(0, rightScore);
  const leftRatio = total > 0 ? leftScore / total : 0.5;
  const boundary = `${Math.max(7, Math.min(93, leftRatio * 100))}%`;
  const recentComments = useMemo(() => comments.slice(-6), [comments]);
  const recentGifts = useMemo(() => giftFeed.slice(-3).reverse(), [giftFeed]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void onSendComment(text, clientId());
  };

  return (
    <section
      className="ulspk-root"
      data-ui-id="live.pk.sell.room"
      data-room-id={roomId}
      data-host={isHost ? 'true' : 'false'}
      style={{ '--ulspk-boundary': boundary } as CSSProperties}
    >
      <header className="ulspk-topbar">
        <button type="button" className="ulspk-icon-button" onClick={onLeaveRoom} aria-label="Leave room"><ChevronLeft /></button>
        <div className="ulspk-host-profile">
          <div className="ulspk-host-avatar">{leftCreator.avatarUrl ? <img src={leftCreator.avatarUrl} alt="" /> : <UsersRound />}</div>
          <div><strong>{leftCreator.name}</strong><span><Zap /> {leftCreator.followersLabel || leftCreator.audienceLabel}</span></div>
        </div>
        <button type="button" className="ulspk-follow-pill" onClick={() => onFollowCreator(leftCreator.id)}>Follow</button>
        <button type="button" className="ulspk-viewers" onClick={onOpenViewerList}><UsersRound /> {viewersLabel}</button>
        <button type="button" className="ulspk-icon-button" onClick={() => setMenuOpen((open) => !open)} aria-label="More" aria-expanded={menuOpen}>
          <MoreHorizontal />
        </button>
        {menuOpen ? (
          <div className="ulspk-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onLeaveRoom(); }}>Leave Room</button>
            {isHost && onEndLive ? (
              <button type="button" role="menuitem" className="ulspk-danger" onClick={() => { setMenuOpen(false); setConfirmEndLive(true); }}>End Live</button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="ulspk-utility-row">
        <button type="button" className="ulspk-hourly" onClick={onOpenRanking}><Zap /> {hourlyRankLabel}<span>{hourlyRankTimeLabel}</span></button>
        <div className="ulspk-utility-spacer" />
        <button type="button" className="ulspk-utility-action" onClick={onOpenRanking}><Trophy /><span>Ranking</span></button>
        <button type="button" className="ulspk-utility-action" onClick={onOpenDailyGift}><Gift /><span>Daily Gift</span></button>
        <button type="button" className="ulspk-utility-action" onClick={onOpenMyGifts}><Gift /><span>My Gifts</span></button>
        {flashSale ? (
          <button type="button" className="ulspk-flash" onClick={onOpenFlashSale}>
            <span>Limited Time</span><strong>⚡ Flash Sale</strong>
            {flashSale.imageUrl ? <img src={flashSale.imageUrl} alt={flashSale.title} /> : <ShoppingBag />}
            <em>{flashSale.remainingLabel}</em>
          </button>
        ) : null}
      </div>

      <div className="ulspk-score-wrap" aria-label="Realtime PK score">
        <div className="ulspk-score-row">
          <strong className="ulspk-score-left">{formatScore(leftScore)}</strong>
          <div className="ulspk-pk-mark">PK</div>
          <strong className="ulspk-score-right">{formatScore(rightScore)}</strong>
        </div>
        <div className="ulspk-score-bar"><div className="ulspk-score-left-fill" /><div className="ulspk-score-right-fill" /></div>
        <div className="ulspk-score-center"><span>{formatTimer(remainingSeconds)}</span>{multiplier > 1 ? <b>x{multiplier}</b> : null}</div>
      </div>

      <div className="ulspk-stage">
        <div className="ulspk-camera ulspk-camera--left">
          <div className="ulspk-video">{leftCamera}</div>
          {leftWinStreak > 0 ? <div className="ulspk-win">WIN × {leftWinStreak}</div> : null}
          <CreatorCard creator={leftCreator} side="left" supporters={leftSupporters} onFollowCreator={onFollowCreator} />
        </div>
        <div className="ulspk-camera ulspk-camera--right">
          <div className="ulspk-video">{rightCamera}</div>
          {rightWinStreak > 0 ? <div className="ulspk-win">WIN × {rightWinStreak}</div> : null}
          <CreatorCard creator={rightCreator} side="right" supporters={rightSupporters} onFollowCreator={onFollowCreator} />
        </div>
        <div className="ulspk-lightning" aria-hidden="true">ϟ</div>
      </div>

      <div className="ulspk-social-layer">
        <div className="ulspk-comments" aria-label="Live comments">
          {recentComments.map((comment) => (
            <div className="ulspk-comment" key={comment.id}>
              <div className="ulspk-comment-avatar">{comment.userAvatarUrl ? <img src={comment.userAvatarUrl} alt="" /> : <UsersRound />}</div>
              <div><strong>{comment.userName}{comment.level ? <span className="ulspk-level">◇ {comment.level}</span> : null}</strong><p>{comment.message}</p></div>
            </div>
          ))}
          <div className="ulspk-system"><MessageCircle /> System · The broadcaster can set PK Title in PK Settings.</div>
        </div>
        <div className="ulspk-gift-feed" aria-label="Gift activity">
          {recentGifts.map((gift) => (
            <div className="ulspk-gift-feed-card" key={gift.id}>
              <div><strong>{gift.senderName}</strong><span>sent {gift.giftName}</span></div>
              <div className="ulspk-gift-art">{gift.giftIcon || <Gift />}</div>
              <b>x{gift.quantity}</b>
            </div>
          ))}
        </div>
        <div className="ulspk-hearts" aria-hidden="true"><Heart /><Heart /><Heart /><Heart /><Heart /></div>
      </div>

      <form className="ulspk-composer" onSubmit={submit}>
        <MessageCircle aria-hidden="true" />
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Say something..." aria-label="Say something" />
        <button type="button" onClick={onOpenStickers} aria-label="Open stickers"><SmilePlus /></button>
        <button type="button" className="ulspk-heart-send" onClick={onOpenGiftPanel} aria-label="Open gifts"><Heart /></button>
      </form>

      <nav className="ulspk-bottom-nav" aria-label="Live selling PK controls">
        <button type="button" onClick={onOpenStickers}><MessageCircle /><span>Chat</span></button>
        <button type="button" onClick={onOpenGuests}><UsersRound /><span>Guests</span></button>
        <button type="button" onClick={onOpenPkPanel}><strong>PK</strong><span>PK</span></button>
        <button type="button" className="ulspk-primary-gift" onClick={onOpenGiftPanel}><Gift /><span>Gift</span></button>
        <button type="button" onClick={onOpenEffects}><Sparkles /><span>Effects</span></button>
        <button type="button" onClick={onOpenMore}><MoreHorizontal /><span>More</span></button>
        <button type="button" className="ulspk-shop" onClick={onOpenShop}><Package /><span>Shop</span></button>
      </nav>
      <div className="ulspk-connection-state" aria-label={connectionLabel}>{connectionLabel}</div>
      {isHost && onEndPk ? (
        <button
          type="button"
          className="ulspk-end-pk"
          data-ui-id="live.pk.sell.action.end-pk"
          disabled={isPkEnding}
          onClick={() => setConfirmEndPk(true)}
        >
          {isPkEnding ? 'Ending…' : 'End PK'}
        </button>
      ) : null}
      {confirmEndPk ? (
        <div className="ulspk-modal-backdrop">
          <section className="ulspk-confirm-card" role="dialog" aria-modal="true">
            <strong>End this PK battle?</strong>
            <p>The battle ends, but the live room continues.</p>
            <div>
              <button type="button" onClick={() => setConfirmEndPk(false)}>Cancel</button>
              <button
                type="button"
                className="ulspk-danger"
                disabled={isPkEnding}
                onClick={() => {
                  void Promise.resolve(onEndPk?.()).then(() => setConfirmEndPk(false));
                }}
              >
                {isPkEnding ? 'Ending…' : 'End PK'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {confirmEndLive ? (
        <div className="ulspk-modal-backdrop">
          <section className="ulspk-confirm-card" role="dialog" aria-modal="true">
            <strong>End live stream?</strong>
            <p>This closes the room for the host and every viewer.</p>
            <div>
              <button type="button" onClick={() => setConfirmEndLive(false)}>Cancel</button>
              <button
                type="button"
                className="ulspk-danger"
                disabled={isLiveEnding}
                onClick={() => {
                  void Promise.resolve(onEndLive?.()).then(() => setConfirmEndLive(false));
                }}
              >
                {isLiveEnding ? 'Ending…' : 'End Live'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default LiveSellPkRoom;
