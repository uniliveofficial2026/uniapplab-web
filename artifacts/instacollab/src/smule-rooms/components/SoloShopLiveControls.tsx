import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Ellipsis,
  Gamepad2,
  Gift,
  Heart,
  MessageCircle,
  Mic,
  MicOff,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
  Swords,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import './solo-shop-live-approved.css';
import { safeAvatarUrl } from '../../lib/safe';
import { useOptionalLiveLike } from '../liveLike/LiveLikeContext';

export type SoloShopLiveMoreAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  hidden?: boolean;
  disabled?: boolean;
  danger?: boolean;
};

export type SoloShopLiveControlsProps = {
  isCommerceLive: boolean;
  chatComposerOpen: boolean;
  onToggleChatComposer: () => void;
  onOpenGuests: () => void;
  guestsOpen?: boolean;
  onOpenPk?: () => void;
  pkEnabled?: boolean;
  onOpenGift: () => void;
  onOpenEffects?: () => void;
  effectsOpen?: boolean;
  effectsEnabled?: boolean;
  onOpenGame?: () => void;
  onOpenShop?: () => void;
  shopOpen?: boolean;
  shopActive?: boolean;
  moreActions: SoloShopLiveMoreAction[];
  moreExtras?: ReactNode;
};

function ControlLabel({ children }: { children: ReactNode }) {
  return <span className="approved-live-control-label">{children}</span>;
}

function ControlIcon({ children }: { children: ReactNode }) {
  return <span className="approved-live-control-surface approved-live-control-icon">{children}</span>;
}

export function SoloShopLiveControls({
  isCommerceLive,
  chatComposerOpen,
  onToggleChatComposer,
  onOpenGuests,
  guestsOpen = false,
  onOpenPk,
  pkEnabled = false,
  onOpenGift,
  onOpenEffects,
  effectsOpen = false,
  effectsEnabled = false,
  onOpenGame,
  onOpenShop,
  shopOpen = false,
  shopActive = false,
  moreActions,
  moreExtras,
}: SoloShopLiveControlsProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleMoreActions = useMemo(
    () => moreActions.filter((action) => !action.hidden),
    [moreActions],
  );

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  const runMoreAction = (action: SoloShopLiveMoreAction) => {
    if (action.disabled) return;
    setMoreOpen(false);
    action.onClick();
  };

  return (
    <>
      <nav
        className="approved-live-control-bar"
        aria-label={isCommerceLive ? 'Shop Live controls' : 'Solo Live controls'}
        data-ui-id={isCommerceLive ? 'live.shop.controls.approved' : 'live.solo.controls.approved'}
      >
        <button
          type="button"
          className={`approved-live-control ${chatComposerOpen ? 'is-active' : ''}`}
          onClick={onToggleChatComposer}
          aria-pressed={chatComposerOpen}
          aria-label={chatComposerOpen ? 'Hide chat' : 'Show chat'}
        >
          <ControlIcon><MessageCircle aria-hidden="true" /></ControlIcon>
          <ControlLabel>Chat</ControlLabel>
        </button>

        <button
          type="button"
          className={`approved-live-control ${guestsOpen ? 'is-active' : ''}`}
          onClick={onOpenGuests}
          aria-expanded={guestsOpen}
          aria-label="Guests"
        >
          <ControlIcon><Users aria-hidden="true" /></ControlIcon>
          <ControlLabel>Guests</ControlLabel>
        </button>

        <button
          type="button"
          className="approved-live-control approved-live-control--pk"
          onClick={onOpenPk}
          disabled={!pkEnabled || !onOpenPk}
          aria-label="Open PK creation"
        >
          <ControlIcon><Swords aria-hidden="true" /></ControlIcon>
          <ControlLabel>PK</ControlLabel>
        </button>

        <button
          type="button"
          className="approved-live-control approved-live-control--gift"
          onClick={onOpenGift}
          aria-label="Open gifts"
        >
          <span className="approved-live-gift-art">
            <Gift aria-hidden="true" />
          </span>
          <span className="sr-only">Gift</span>
        </button>

        <button
          type="button"
          className={`approved-live-control ${effectsOpen ? 'is-active' : ''}`}
          onClick={onOpenEffects}
          disabled={!effectsEnabled || !onOpenEffects}
          aria-expanded={effectsOpen}
        >
          <ControlIcon><Sparkles aria-hidden="true" /></ControlIcon>
          <ControlLabel>Effects</ControlLabel>
        </button>

        <button
          type="button"
          className={`approved-live-control ${moreOpen ? 'is-active' : ''}`}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-controls="approved-live-more-sheet"
        >
          <ControlIcon><Ellipsis aria-hidden="true" /></ControlIcon>
          <ControlLabel>More</ControlLabel>
        </button>

        {isCommerceLive ? (
          <button
            type="button"
            className={`approved-live-control approved-live-control--shop ${shopOpen || shopActive ? 'is-active' : ''}`}
            onClick={onOpenShop}
            disabled={!onOpenShop}
            aria-expanded={shopOpen}
            aria-label="Open Shop Live products"
          >
            <ControlIcon><ShoppingBag aria-hidden="true" /></ControlIcon>
            <ControlLabel>Shop</ControlLabel>
          </button>
        ) : (
          <button
            type="button"
            className="approved-live-control approved-live-control--game"
            onClick={onOpenGame}
            disabled={!onOpenGame}
            aria-label="Open games"
          >
            <ControlIcon><Gamepad2 aria-hidden="true" /></ControlIcon>
            <ControlLabel>Game</ControlLabel>
          </button>
        )}
      </nav>

      {moreOpen ? (
        <div
          className="approved-live-more-backdrop"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setMoreOpen(false);
          }}
        >
          <section
            id="approved-live-more-sheet"
            className="approved-live-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More live controls"
          >
            <div className="approved-live-sheet-handle" />
            <header>
              <div>
                <strong>More Controls</strong>
                <small>Live tools and room settings</small>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close more controls">
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="approved-live-more-grid">
              {visibleMoreActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={action.danger ? 'is-danger' : ''}
                  onClick={() => runMoreAction(action)}
                  disabled={action.disabled}
                >
                  <span>{action.icon}</span>
                  <b>{action.label}</b>
                </button>
              ))}
              {moreExtras}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export type SoloShopLiveComposerProps = {
  open: boolean;
  children: ReactNode;
  onOpenStickers?: () => void;
  cameraOn?: boolean;
  cameraEnabled?: boolean;
  onToggleCamera?: () => void;
  micOn?: boolean;
  micEnabled?: boolean;
  onToggleMic?: () => void;
  likeTappers?: Array<{
    userId: string;
    name: string;
    avatarUrl?: string;
    taps: number;
  }>;
  likeCount?: number;
};

export function SoloShopLiveComposerActions({
  open,
  children,
  onOpenStickers,
  cameraOn = false,
  cameraEnabled = false,
  onToggleCamera,
  micOn = false,
  micEnabled = false,
  onToggleMic,
  likeTappers,
  likeCount,
}: SoloShopLiveComposerProps) {
  const liveLike = useOptionalLiveLike();
  const tappers = likeTappers ?? liveLike?.likeTappers ?? [];
  const totalLikes = likeCount ?? liveLike?.likeCount ?? 0;
  const [likersOpen, setLikersOpen] = useState(false);

  useEffect(() => {
    if (!open) setLikersOpen(false);
  }, [open]);

  if (!open) return null;
  return (
    <div className="approved-live-composer-row" data-ui-id="live.chat.composer.approved">
      <div className="approved-live-composer-shell">
        {children}
        <button
          type="button"
          className={`approved-live-composer-mic ${micOn ? 'is-on' : 'is-off'}`}
          onClick={onToggleMic}
          disabled={!micEnabled || !onToggleMic}
          aria-pressed={micOn}
          aria-label={micOn ? 'Mute mic' : 'Unmute mic'}
          title={micEnabled ? (micOn ? 'Mute mic' : 'Unmute mic') : 'Join a seat to use your mic'}
        >
          {micOn ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
        </button>
        <button type="button" onClick={onOpenStickers} aria-label="Open stickers">
          <Smile aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className={`approved-live-round-action ${cameraOn ? 'is-on' : 'is-off'}`}
        onClick={onToggleCamera}
        disabled={!cameraEnabled || !onToggleCamera}
        aria-pressed={cameraOn}
        aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
        title={cameraEnabled ? (cameraOn ? 'Camera Off' : 'Camera On') : 'Join a seat to use your camera'}
      >
        {cameraOn ? <Video aria-hidden="true" /> : <VideoOff aria-hidden="true" />}
      </button>
      <div className="approved-live-like-wrap">
        {likersOpen ? (
          <div className="approved-live-likers-panel" role="dialog" aria-label="People who liked">
            <header>
              <strong>Likes</strong>
              <span>{totalLikes}</span>
              <button type="button" onClick={() => setLikersOpen(false)} aria-label="Close likes panel">
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="approved-live-likers-list">
              {tappers.length === 0 ? (
                <p className="approved-live-likers-empty">No likes yet</p>
              ) : (
                tappers.map((tapper) => (
                  <div key={tapper.userId} className="approved-live-likers-row">
                    <img src={safeAvatarUrl(tapper.avatarUrl)} alt="" />
                    <div>
                      <strong>{tapper.name}</strong>
                      <small>{tapper.taps} {tapper.taps === 1 ? 'like' : 'likes'}</small>
                    </div>
                    <Heart aria-hidden="true" />
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className={`approved-live-round-action approved-live-like-action ${likersOpen ? 'is-open' : ''}`}
          onClick={() => setLikersOpen((value) => !value)}
          aria-label={likersOpen ? 'Hide likes panel' : 'Show likes panel'}
          aria-expanded={likersOpen}
        >
          <Heart aria-hidden="true" />
          {totalLikes > 0 ? (
            <span className="approved-live-like-count">{totalLikes > 999 ? '999+' : totalLikes}</span>
          ) : null}
        </button>
      </div>
    </div>
  );
}

export function ApprovedLiveAmbientHearts() {
  return (
    <div className="approved-live-ambient-hearts" aria-hidden="true">
      {Array.from({ length: 11 }, (_, index) => (
        <Heart key={index} style={{ '--approved-heart-index': index } as CSSProperties} />
      ))}
    </div>
  );
}

export type SoloShopLiveDailyGiftSheetProps = {
  open: boolean;
  hostName: string;
  isHost: boolean;
  giftCount: number;
  totalStars: number;
  todayExp: number;
  dailyCap: number;
  giftBonusExp: number;
  onClose: () => void;
  onOpenGiftPanel: () => void;
};

export function SoloShopLiveDailyGiftSheet({
  open,
  hostName,
  isHost,
  giftCount,
  totalStars,
  todayExp,
  dailyCap,
  giftBonusExp,
  onClose,
  onOpenGiftPanel,
}: SoloShopLiveDailyGiftSheetProps) {
  if (!open) return null;
  const target = Math.max(1, dailyCap);
  const progress = Math.min(100, Math.max(0, (todayExp / target) * 100));
  return (
    <div className="approved-live-more-backdrop approved-live-daily-backdrop" role="presentation">
      <section className="approved-live-more-sheet approved-live-daily-sheet" role="dialog" aria-modal="true" aria-label="Daily Gift">
        <div className="approved-live-sheet-handle" />
        <header>
          <div>
            <strong>Daily Gift</strong>
            <small>{isHost ? 'Your live goal progress' : `Support ${hostName}'s daily goal`}</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Daily Gift"><X aria-hidden="true" /></button>
        </header>
        <div className="approved-live-daily-stats">
          <article><Gift aria-hidden="true" /><span>Gifts</span><strong>{giftCount.toLocaleString()}</strong></article>
          <article><Star aria-hidden="true" /><span>Gift value</span><strong>{totalStars.toLocaleString()}</strong></article>
          <article><Sparkles aria-hidden="true" /><span>Gift bonus EXP</span><strong>{giftBonusExp.toLocaleString()}</strong></article>
        </div>
        <div className="approved-live-daily-progress">
          <div><span>Today</span><strong>{todayExp.toLocaleString()} / {target.toLocaleString()} EXP</strong></div>
          <div className="approved-live-daily-track"><span style={{ width: `${progress}%` }} /></div>
        </div>
        {!isHost ? (
          <button
            type="button"
            className="approved-live-daily-cta"
            onClick={() => {
              onClose();
              onOpenGiftPanel();
            }}
          >
            <Gift aria-hidden="true" /> Send a Gift
          </button>
        ) : null}
      </section>
    </div>
  );
}
