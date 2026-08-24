import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Check, ChevronRight, Copy, Crown, Flame, Gift, Package, Pencil, Share, ShoppingBag, UserPlus, X, Zap } from 'lucide-react';
import { formatLiveDuration } from '../../lib/liveLifecycle/hostDashboardStore';
import { safeAvatarUrl } from '../../lib/safe';
import { formatCommercePrice, type CommerceProduct } from '../utils/liveRoomTypes';
import { CommerceProductArt } from './CommerceProductArt';
import './v15-live-room-chrome.css';

export type V15LiveFollowTapper = {
  userId: string;
  name: string;
  avatarUrl?: string;
  followedThisLive?: boolean;
};

export type V15LiveRoomChromeProps = {
  hostName: string;
  hostAvatarUrl?: string;
  roomId?: string;
  caption?: string;
  canEditCaption?: boolean;
  onEditCaption?: () => void;
  roomIdCopied?: boolean;
  onCopyRoomId?: (event: MouseEvent<HTMLButtonElement>) => void;
  popularityLabel?: string;
  isFollowing?: boolean;
  showFollow?: boolean;
  onToggleFollow?: () => void;
  liveFollowCount?: number;
  followerTotal?: number;
  followTappers?: V15LiveFollowTapper[];
  isCommerceLive?: boolean;
  liveStartedAt?: string | null;
  viewerCount?: number;
  viewerAvatars?: Array<{ id: string; avatar?: string }>;
  pkTimerLabel?: string | null;
  legacyHeaderActions?: ReactNode;
  hourlyRankLabel?: string;
  hourlyRankTimerLabel?: string;
  onHourlyTop?: () => void;
  onDailyGift?: () => void;
  onMyGifts?: () => void;
  flashSaleProduct?: CommerceProduct | null;
  flashSaleSalesCount?: number;
  onFlashSale?: () => void;
  onViewers?: () => void;
  onShare?: () => void;
  onClose: () => void;
  closeAriaLabel?: string;
  onHostProfile?: () => void;
  onOpenHostDashboard?: () => void;
};

function compactNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return Math.max(0, Math.round(value)).toLocaleString();
}

function formatSaleCountdown(endAt: number | undefined, now: number) {
  if (!endAt) return '00:00:00';
  const seconds = Math.max(0, Math.ceil((endAt - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining].map((part) => String(part).padStart(2, '0')).join(':');
}

const FLASH_SALE_FALLBACK_MS = 60 * 60 * 1000;

export function V15LiveRoomChrome({
  hostName,
  hostAvatarUrl,
  roomId,
  caption,
  canEditCaption = false,
  onEditCaption,
  roomIdCopied = false,
  onCopyRoomId,
  popularityLabel,
  isFollowing = false,
  showFollow = false,
  onToggleFollow,
  liveFollowCount = 0,
  followerTotal,
  followTappers = [],
  isCommerceLive = false,
  liveStartedAt = null,
  viewerCount,
  viewerAvatars = [],
  pkTimerLabel,
  legacyHeaderActions,
  hourlyRankLabel = 'Hourly Top 1',
  hourlyRankTimerLabel,
  onHourlyTop,
  onDailyGift,
  onMyGifts,
  flashSaleProduct = null,
  flashSaleSalesCount = 0,
  onFlashSale,
  onViewers,
  onShare,
  onClose,
  closeAriaLabel = 'Leave room',
  onHostProfile,
  onOpenHostDashboard,
}: V15LiveRoomChromeProps) {
  const [now, setNow] = useState(() => Date.now());
  const [fallbackFlashEndsAt, setFallbackFlashEndsAt] = useState<number | null>(null);
  const [followsOpen, setFollowsOpen] = useState(false);
  const showFlashSale = Boolean(isCommerceLive && flashSaleProduct);
  const flashSaleEndsAt = flashSaleProduct?.flashSaleEndsAt ?? fallbackFlashEndsAt ?? undefined;
  const visibleFollowCount = Math.max(liveFollowCount, followTappers.length);
  const panelFollowerTotal =
    typeof followerTotal === 'number' && Number.isFinite(followerTotal)
      ? Math.max(followerTotal, visibleFollowCount)
      : visibleFollowCount;

  useEffect(() => {
    if (!flashSaleProduct || flashSaleProduct.flashSaleEndsAt) {
      setFallbackFlashEndsAt(null);
      return;
    }
    setFallbackFlashEndsAt(Date.now() + FLASH_SALE_FALLBACK_MS);
  }, [flashSaleProduct?.id, flashSaleProduct?.flashSaleEndsAt]);

  useEffect(() => {
    if (!liveStartedAt && !showFlashSale) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [liveStartedAt, showFlashSale, flashSaleEndsAt]);

  const liveDuration = liveStartedAt ? formatLiveDuration(liveStartedAt, now) : '00:00:00';
  const visibleViewerCount = typeof viewerCount === 'number' ? viewerCount : viewerAvatars.length;
  const saleCountdown = useMemo(
    () => formatSaleCountdown(flashSaleEndsAt, now),
    [flashSaleEndsAt, now],
  );

  return (
    <header
      className={`v15-live-chrome${showFlashSale ? ' has-flash-sale' : ''}`}
      data-ui-id="live.approved.room-chrome"
    >
      <div className="v15-live-chrome__stack">
        <div className="v15-live-chrome__top">
          <div className="v15-live-host">
            <div className="v15-live-host__primary">
              <div className="v15-live-host__profile">
                <button
                  type="button"
                  className="v15-live-host__avatar-btn"
                  onClick={onHostProfile}
                  aria-label={`${hostName} profile`}
                >
                  <span className="v15-live-host__avatar-frame">
                    <img src={safeAvatarUrl(hostAvatarUrl)} alt="" />
                    <Crown className="v15-live-host__crown" aria-hidden="true" />
                    <span className="v15-live-host__svip-ribbon">SVIP</span>
                  </span>
                </button>

                <div className="v15-live-host__identity">
                  <button
                    type="button"
                    className="v15-live-host__name-row"
                    onClick={onHostProfile}
                    aria-label={`${hostName} profile`}
                  >
                    <strong>{hostName}</strong>
                    {popularityLabel ? (
                      <span className="v15-live-host__popularity"><Flame aria-hidden="true" />{popularityLabel}</span>
                    ) : null}
                  </button>

                  <div className="v15-live-host__meta-row">
                    {onOpenHostDashboard ? (
                      <button
                        type="button"
                        className="v15-live-indicator v15-live-indicator--dashboard"
                        data-ui-id="live.approved.realtime-indicator"
                        aria-live="polite"
                        aria-label="Open live data dashboard"
                        onClick={onOpenHostDashboard}
                      >
                        <strong>Live</strong>
                        <span>{liveDuration}</span>
                      </button>
                    ) : (
                      <span className="v15-live-indicator" data-ui-id="live.approved.realtime-indicator" aria-live="polite">
                        <strong>Live</strong>
                        <span>{liveDuration}</span>
                      </span>
                    )}

                    {roomId ? (
                      <button
                        type="button"
                        className="v15-live-room-id"
                        onClick={onCopyRoomId}
                        disabled={!onCopyRoomId}
                        aria-label={roomIdCopied ? 'Room ID copied' : `Copy room ID ${roomId}`}
                      >
                        <span>Room ID {roomId}</span>
                        {roomIdCopied ? <Check /> : <Copy />}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {showFollow ? (
              <button
                type="button"
                className={`v15-live-host__follow ${isFollowing ? 'is-following' : ''}`}
                onClick={onToggleFollow}
                aria-pressed={isFollowing}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            ) : null}
          </div>

          <div className="v15-live-viewer-actions">
            <button
              type="button"
              className="v15-live-viewers"
              onClick={onViewers}
              aria-label={`${visibleViewerCount.toLocaleString()} viewers`}
            >
              <span className="v15-live-viewers__faces" aria-hidden="true">
                {viewerAvatars.slice(0, 4).map((viewer) => (
                  <img key={viewer.id} src={safeAvatarUrl(viewer.avatar)} alt="" />
                ))}
              </span>
              <span className="v15-live-viewers__count">{compactNumber(visibleViewerCount)}</span>
            </button>
            <div className="v15-live-follow-wrap">
              {followsOpen ? (
                <div className="v15-live-follows-panel" role="dialog" aria-label="Host followers">
                  <header>
                    <div className="v15-live-follows-panel__title">
                      <strong>Followers</strong>
                      <span className="v15-live-follows-panel__count">{compactNumber(panelFollowerTotal)}</span>
                    </div>
                    <button type="button" onClick={() => setFollowsOpen(false)} aria-label="Close followers panel">
                      <X aria-hidden="true" />
                    </button>
                  </header>
                  {showFollow && onToggleFollow ? (
                    <button
                      type="button"
                      className={`v15-live-follows-action ${isFollowing ? 'is-following' : ''}`}
                      onClick={onToggleFollow}
                      aria-pressed={isFollowing}
                    >
                      <UserPlus aria-hidden="true" />
                      {isFollowing ? 'Following' : 'Follow host'}
                    </button>
                  ) : null}
                  <div className="v15-live-follows-list">
                    {followTappers.length === 0 ? (
                      <p className="v15-live-follows-empty">No followers yet</p>
                    ) : (
                      followTappers.map((tapper) => (
                        <div key={tapper.userId} className="v15-live-follows-row">
                          <img src={safeAvatarUrl(tapper.avatarUrl)} alt="" />
                          <div>
                            <strong>{tapper.name}</strong>
                            <small>{tapper.followedThisLive ? 'Followed this live' : 'Follower'}</small>
                          </div>
                          <UserPlus aria-hidden="true" />
                        </div>
                      ))
                    )}
                  </div>
                  <footer>
                    <span>This live</span>
                    <b>+{compactNumber(visibleFollowCount)}</b>
                  </footer>
                </div>
              ) : null}
              <button
                type="button"
                className={`v15-live-follow-action ${followsOpen ? 'is-open' : ''}`}
                onClick={() => setFollowsOpen((open) => !open)}
                aria-label={followsOpen ? 'Hide host followers' : 'Show host followers'}
                aria-expanded={followsOpen}
              >
                <UserPlus aria-hidden="true" />
                <span className="v15-live-follow-count">
                  {compactNumber(panelFollowerTotal)}
                </span>
              </button>
            </div>
            {onShare ? (
              <button
                type="button"
                className="v15-live-share"
                onClick={onShare}
                aria-label="Share live stream"
              >
                <Share aria-hidden="true" />
              </button>
            ) : null}
            <button type="button" className="v15-live-close" aria-label={closeAriaLabel} onClick={onClose}>
              <X aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="v15-live-chrome__body">
          <div className="v15-live-chrome__main">
            <div className="v15-live-status-row">
              {pkTimerLabel ? <span className="v15-live-pk-timer">PK {pkTimerLabel}</span> : null}
              <button type="button" className="v15-live-hourly" onClick={onHourlyTop} disabled={!onHourlyTop}>
                <Flame aria-hidden="true" />
                <strong>{hourlyRankLabel}</strong>
                {hourlyRankTimerLabel ? <span>{hourlyRankTimerLabel}</span> : null}
                <ChevronRight aria-hidden="true" />
              </button>
              {caption || canEditCaption ? (
                <span className="v15-live-caption-wrap">
                  <span className="v15-live-caption" title={caption || 'Live caption'}>{caption || 'Welcome to the room!'}</span>
                  {canEditCaption && onEditCaption ? (
                    <button type="button" onClick={onEditCaption} aria-label="Edit live caption"><Pencil /></button>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>

          <div className="v15-live-chrome__side">
            <div className="v15-live-utility-row" aria-label="Live room insights">
              <button type="button" onClick={onDailyGift} disabled={!onDailyGift}>
                <span className="v15-live-utility-icon"><Gift aria-hidden="true" /></span>
                <span>Daily Gift</span>
              </button>
              <button type="button" onClick={onMyGifts} disabled={!onMyGifts}>
                <span className="v15-live-utility-icon"><Package aria-hidden="true" /></span>
                <span>My Gifts</span>
              </button>
            </div>

            {showFlashSale && flashSaleProduct ? (
              <button
                type="button"
                className="v15-live-flash-sale"
                onClick={onFlashSale}
                disabled={!onFlashSale}
                aria-label={`Open flash sale for ${flashSaleProduct.title}, ${formatCommercePrice(flashSaleProduct)}, ends in ${saleCountdown}`}
              >
                <span className="v15-live-flash-sale__media">
                  <span className="v15-live-flash-sale__art">
                    <CommerceProductArt
                      product={flashSaleProduct}
                      fallback={<ShoppingBag aria-hidden="true" />}
                    />
                  </span>
                </span>
                <span className="v15-live-flash-sale__body">
                  <span className="v15-live-flash-sale__eyebrow">Flash Deal</span>
                  <strong className="v15-live-flash-sale__name">{flashSaleProduct.title}</strong>
                  <b className="v15-live-flash-sale__price">{formatCommercePrice(flashSaleProduct)}</b>
                  <span className="v15-live-flash-sale__countdown">
                    <span>Ends</span>
                    <time dateTime={flashSaleEndsAt ? new Date(flashSaleEndsAt).toISOString() : undefined}>
                      {saleCountdown}
                    </time>
                  </span>
                  <span className="v15-live-flash-sale__cta">
                    <Zap aria-hidden="true" /> Buy Now
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {legacyHeaderActions ? <div className="v15-live-legacy-actions">{legacyHeaderActions}</div> : null}
    </header>
  );
}
