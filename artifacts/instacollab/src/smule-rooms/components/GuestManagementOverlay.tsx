import React, { useMemo, useState } from 'react';
import {
  Camera,
  FlipHorizontal2,
  Grid2X2,
  Info,
  Lock,
  Mic,
  MicOff,
  Plus,
  Settings2,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { safeAvatarUrl } from '../../lib/safe';
import {
  MULTI_GUEST_SEAT_COUNT_OPTIONS,
  formatMultiGuestLayoutOptionLabel,
  getMultiGuestTotalCapacity,
  type MultiGuestSeatCount,
  type PartySeatMap,
  type RoomLayoutMode,
  type RoomSeatKey,
} from '../utils/roomSeats';
import type { RoomMemberRole } from '../utils/roles';
import './live-tools-approved-v15.css';

type GuestRequestLike = {
  id: string;
  userId?: string;
  name?: string;
  avatar?: string;
  avatarUrl?: string;
};

type GuestManagementOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  activeSeats: PartySeatMap;
  onRemoveGuest: (seatKey: string) => void;
  onMuteGuest: (seatKey: string) => void;
  guestRequests: GuestRequestLike[];
  onAcceptRequest: (reqId: string) => void;
  onDeclineRequest: (reqId: string) => void;
  currentUserRole?: RoomMemberRole | string;
  isAllGuestMuted?: boolean;
  onToggleAllMics?: () => void;
  joinWithoutRequest?: boolean;
  onToggleJoinMode?: () => void;
  lockedSeats?: Record<string, boolean>;
  onToggleSeatLock?: (seatKey: string) => void;
  isUserSeated?: boolean;
  onJoinSeat: (seatKey: string) => void;
  hasPendingJoinRequest?: boolean;
  whoCanJoin?: string;
  whoCanBeSeated?: string;
  roomPriority?: string;
  joinPolicySummary?: string;
  guestSeatKeys?: RoomSeatKey[];
  roomLayoutMode?: RoomLayoutMode | string;
  multiGuestSeatCount?: MultiGuestSeatCount | number;
  onMultiGuestSeatCountChange?: (count: MultiGuestSeatCount) => void;
  canBanFromSeats?: boolean;
  seatBannedUserIds?: string[];
  onBanFromSeats?: (userId: string, name: string) => void;
  onUnbanFromSeats?: (userId: string, name: string) => void;
  onToggleSelfMic?: () => void;
  onToggleSelfCamera?: () => void;
  onFlipCamera?: () => void;
  onBeautify?: () => void;
  onInvite?: () => void;
  onLeaveSeat?: () => void;
};

const BADGE_CLASS = ['', 's2', 's3', 's4'] as const;

function guestMicMuted(guest: PartySeatMap[string]): boolean {
  if (!guest) return false;
  return Boolean(guest.isAdminMuted || !guest.isSpeaking);
}

function seatNumber(seatKey: string): number | null {
  const match = /^no(\d+)$/i.exec(seatKey);
  if (match) return Number(match[1]);
  return null;
}

function formatStars(stars: number | undefined): string {
  if (!stars || stars <= 0) return 'Live';
  if (stars >= 1000) return `${(stars / 1000).toFixed(1)}K`;
  return String(stars);
}

export function GuestManagementOverlay({
  isOpen,
  onClose,
  activeSeats,
  onRemoveGuest,
  onMuteGuest,
  guestRequests,
  onAcceptRequest,
  onDeclineRequest,
  currentUserRole,
  isAllGuestMuted = false,
  onToggleAllMics,
  joinWithoutRequest = false,
  onToggleJoinMode,
  lockedSeats = {},
  isUserSeated = false,
  onJoinSeat,
  hasPendingJoinRequest = false,
  guestSeatKeys = [],
  roomLayoutMode = 'MultiGuest',
  multiGuestSeatCount = 16,
  onMultiGuestSeatCountChange,
  canBanFromSeats = false,
  seatBannedUserIds = [],
  onBanFromSeats,
  onUnbanFromSeats,
  joinPolicySummary,
  onToggleSelfMic,
  onToggleSelfCamera,
  onFlipCamera,
  onBeautify,
  onInvite,
  onLeaveSeat,
}: GuestManagementOverlayProps) {
  const [subview, setSubview] = useState<'main' | 'layout' | 'manage' | 'requests'>('main');
  const isHostControl = ['owner', 'host', 'co-owner', 'admin', 'moderator'].includes(
    (currentUserRole ?? '').toLowerCase(),
  );

  const stageCapacity = getMultiGuestTotalCapacity(
    (MULTI_GUEST_SEAT_COUNT_OPTIONS as readonly number[]).includes(Number(multiGuestSeatCount))
      ? (Number(multiGuestSeatCount) as MultiGuestSeatCount)
      : 16,
  );

  const stageCards = useMemo(() => {
    const keys = guestSeatKeys.length
      ? guestSeatKeys
      : (Object.keys(activeSeats) as RoomSeatKey[]);
    const ordered: Array<[string, NonNullable<PartySeatMap[string]>]> = [];
    if (activeSeats.host) ordered.push(['host', activeSeats.host]);
    for (const key of keys) {
      if (key === 'host') continue;
      const guest = activeSeats[key];
      if (guest) ordered.push([key, guest]);
    }
    return ordered;
  }, [activeSeats, guestSeatKeys]);

  const occupiedCount = stageCards.length;
  const maxGuests = stageCapacity;

  if (!isOpen) return null;

  const openInvite = () => {
    if (onInvite) {
      onInvite();
      return;
    }
    try {
      void navigator.clipboard.writeText(window.location.href);
    } catch {
      /* ignore */
    }
  };

  const requestJoin = () => {
    const key = guestSeatKeys.find((k) => !activeSeats[k] && !lockedSeats[k]);
    if (key) onJoinSeat(key);
  };

  return (
    <div className="lt15-overlay lt15-overlay--guests" data-ui-id="live.guests.v14.exact">
      <button type="button" className="lt15-scrim" aria-label="Close guests panel" onClick={onClose} />
      <section className="lt15-sheet lt15-guests">
        <div className="lt15-handle" />

        {subview === 'main' ? (
          <>
            <div className="lt15-head lt15-guest-head">
              <div className="lt15-title">
                Guests ({occupiedCount}/{maxGuests}) <Info size={12} opacity={0.55} />
              </div>
              <div className="lt15-guest-head-btns">
                <button type="button" className="lt15-soft-btn" onClick={() => setSubview('layout')}>
                  <Grid2X2 size={13} /> Layout
                </button>
                <button type="button" className="lt15-soft-btn" onClick={() => setSubview('manage')}>
                  <Settings2 size={13} /> Manage
                </button>
                {guestRequests.length > 0 && isHostControl ? (
                  <button type="button" className="lt15-soft-btn" onClick={() => setSubview('requests')}>
                    {guestRequests.length}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="lt15-guest-cards">
              {stageCards.slice(0, 4).map(([seatKey, guest], visualIndex) => {
                const avatar = safeAvatarUrl(guest.avatar || '');
                const muted = guestMicMuted(guest);
                const isHost = seatKey === 'host' || Boolean(guest.isOwner);
                const number = isHost ? null : seatNumber(seatKey) ?? visualIndex;
                const badgeTone = BADGE_CLASS[(number ?? 1) % 4] || '';
                return (
                  <button
                    type="button"
                    className="lt15-guest-card"
                    key={seatKey}
                    onClick={() => {
                      if (isHostControl && !isHost) onMuteGuest(seatKey);
                    }}
                  >
                    <span className={`lt15-seat-badge ${badgeTone}`}>{isHost ? 1 : number}</span>
                    {muted && !isHost ? (
                      <span className="lt15-mic-off">
                        <MicOff size={10} />
                      </span>
                    ) : null}
                    {avatar ? (
                      <img src={avatar} alt="" />
                    ) : (
                      <div className="lt15-guest-avatar-fallback"><User size={30} aria-hidden /></div>
                    )}
                    <div className="lt15-guest-meta">
                      {isHost ? <span className="lt15-host-pill">Host</span> : null}
                      <div>{guest.name || (isHost ? 'Host' : 'Guest')}</div>
                      <div style={{ color: '#ffd048' }}>★ {formatStars(guest.stars)}</div>
                    </div>
                  </button>
                );
              })}
              <button type="button" className="lt15-guest-card lt15-invite-card" onClick={openInvite}>
                <div>
                  <b><Plus size={30} aria-hidden /></b>
                  <span>Invite</span>
                </div>
              </button>
            </div>

            <div className="lt15-guest-actions">
              <button className="lt15-mini-action" type="button" onClick={onToggleSelfMic} disabled={!onToggleSelfMic}>
                <i>
                  <Mic size={17} />
                </i>
                <span>Mic</span>
              </button>
              <button className="lt15-mini-action" type="button" onClick={onToggleSelfCamera} disabled={!onToggleSelfCamera}>
                <i>
                  <Camera size={17} />
                </i>
                <span>Camera</span>
              </button>
              <button className="lt15-mini-action" type="button" onClick={onFlipCamera} disabled={!onFlipCamera}>
                <i>
                  <FlipHorizontal2 size={17} />
                </i>
                <span>Flip</span>
              </button>
              <button className="lt15-mini-action" type="button" onClick={onBeautify} disabled={!onBeautify}>
                <i>
                  <Sparkles size={17} />
                </i>
                <span>Beautify</span>
              </button>
              {isHostControl ? null : isUserSeated ? (
                <button
                  type="button"
                  className="lt15-request"
                  onClick={onLeaveSeat}
                  disabled={!onLeaveSeat}
                >
                  Leave Seat
                </button>
              ) : (
                <button
                  type="button"
                  className="lt15-request"
                  disabled={hasPendingJoinRequest}
                  onClick={requestJoin}
                >
                  {hasPendingJoinRequest ? 'Request Pending' : 'Request to Join'}
                </button>
              )}
            </div>
          </>
        ) : null}

        {subview === 'layout' ? (
          <div className="lt15-subpanel">
            <div className="lt15-head">
              <div className="lt15-title">
                <Grid2X2 size={17} /> Layout
              </div>
              <button type="button" className="lt15-icon-btn" onClick={() => setSubview('main')} aria-label="Back">
                <X size={16} />
              </button>
            </div>
            <div className="lt15-layout-grid">
              {MULTI_GUEST_SEAT_COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`lt15-layout-btn ${Number(multiGuestSeatCount) === count ? 'is-active' : ''}`}
                  disabled={!isHostControl || !onMultiGuestSeatCountChange}
                  onClick={() => onMultiGuestSeatCountChange?.(count)}
                >
                  {formatMultiGuestLayoutOptionLabel(count)}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.55)', marginTop: 10 }}>
              {roomLayoutMode} · {joinPolicySummary || 'Room seat policy remains server-authoritative.'}
            </div>
            {isHostControl && onToggleJoinMode ? (
              <button type="button" className="lt15-soft-btn" style={{ marginTop: 12, width: '100%' }} onClick={onToggleJoinMode}>
                Join mode: {joinWithoutRequest ? 'Open seats' : 'Approval required'} <Lock size={12} />
              </button>
            ) : null}
          </div>
        ) : null}

        {subview === 'manage' ? (
          <div className="lt15-subpanel">
            <div className="lt15-head">
              <div className="lt15-title">
                <Settings2 size={17} /> Manage
              </div>
              <button type="button" className="lt15-icon-btn" onClick={() => setSubview('main')} aria-label="Back">
                <X size={16} />
              </button>
            </div>
            {isHostControl && onToggleAllMics ? (
              <button type="button" className="lt15-soft-btn" style={{ marginBottom: 10 }} onClick={onToggleAllMics}>
                {isAllGuestMuted ? 'Unmute all guests' : 'Mute all guests'}
              </button>
            ) : null}
            <div style={{ maxHeight: 160, overflow: 'auto' }}>
              {stageCards
                .filter(([key]) => key !== 'host')
                .map(([seatKey, guest]) => {
                  const userId = guest.userId ?? '';
                  const banned = Boolean(userId && seatBannedUserIds.includes(userId));
                  const muted = guestMicMuted(guest);
                  return (
                    <div key={seatKey} className="lt15-manage-row">
                      <span style={{ flex: 1 }}>{guest.name || seatKey}</span>
                      <button type="button" className="lt15-preview" onClick={() => onMuteGuest(seatKey)}>
                        {muted ? 'Unmute' : 'Mute'}
                      </button>
                      <button type="button" className="lt15-preview" onClick={() => onRemoveGuest(seatKey)}>
                        Remove
                      </button>
                      {canBanFromSeats && userId ? (
                        <button
                          type="button"
                          className="lt15-preview"
                          onClick={() =>
                            banned
                              ? onUnbanFromSeats?.(userId, guest.name || 'Guest')
                              : onBanFromSeats?.(userId, guest.name || 'Guest')
                          }
                        >
                          {banned ? 'Unban' : 'Ban'}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </div>
        ) : null}

        {subview === 'requests' ? (
          <div className="lt15-subpanel">
            <div className="lt15-head">
              <div className="lt15-title">Guest requests</div>
              <button type="button" className="lt15-icon-btn" onClick={() => setSubview('main')} aria-label="Back">
                <X size={16} />
              </button>
            </div>
            <div style={{ maxHeight: 160, overflow: 'auto' }}>
              {guestRequests.length ? (
                guestRequests.map((req) => (
                  <div key={req.id} className="lt15-manage-row">
                    <span style={{ flex: 1 }}>{req.name || 'Viewer'}</span>
                    {isHostControl ? (
                      <>
                        <button type="button" className="lt15-preview" onClick={() => onDeclineRequest(req.id)}>
                          Decline
                        </button>
                        <button type="button" className="lt15-primary" onClick={() => onAcceptRequest(req.id)}>
                          Accept
                        </button>
                      </>
                    ) : null}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)' }}>No join requests.</div>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
