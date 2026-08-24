import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import {
  Camera,
  ChevronLeft,
  Gift,
  MoreHorizontal,
  Mic,
  MicOff,
  ShieldCheck,
  Signal,
  SmilePlus,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import './team-pk-room.css';

export type TeamPkCreatorView = {
  id: string;
  name: string;
  avatarUrl?: string;
  verified?: boolean;
  isCaptain?: boolean;
  score: number;
  giftCount: number;
};

export type TeamPkCommentView = {
  id: string;
  userName: string;
  message: string;
  userAvatarUrl?: string;
  level?: number;
};

export type TeamPkLabels = {
  live: string;
  stable: string;
  connecting: string;
  host: string;
  endPk: string;
  ending: string;
  endPkConfirmTitle: string;
  endPkConfirmBody: string;
  endLive: string;
  endLiveConfirmTitle: string;
  endLiveConfirmBody: string;
  cancel: string;
  leaveRoom: string;
  saySomething: string;
  sticker: string;
  gift: string;
  beauty: string;
  muteMicrophone: string;
  unmuteMicrophone: string;
  flipCamera: string;
  more: string;
  selectGiftTarget: string;
};

export type TeamPkRoomProps = {
  roomId: string;
  hostTeam: TeamPkCreatorView[];
  opponentTeam: TeamPkCreatorView[];
  declaredTeamSize?: 2 | 3 | 4 | 6;
  cameras: Record<string, ReactNode>;
  hostTeamScore: number;
  opponentTeamScore: number;
  remainingSeconds: number;
  multiplier: number;
  viewersLabel: string;
  connectionLabel: string;
  comments: TeamPkCommentView[];
  isHost: boolean;
  isPkEnding: boolean;
  isLiveEnding: boolean;
  muted: boolean;
  selectedGiftReceiverId?: string | null;
  labels?: Partial<TeamPkLabels>;
  locale?: string;
  onLeaveRoom: () => void;
  onEndPk: () => void | Promise<void>;
  onEndLive: () => void | Promise<void>;
  onSendComment: (message: string, clientId: string) => void | Promise<void>;
  onOpenStickers: () => void;
  onOpenGifts: () => void;
  onOpenBeauty: () => void;
  onToggleMicrophone: () => void;
  onFlipCamera: () => void;
  onSelectGiftReceiver?: (userId: string) => void;
};

const DEFAULT_LABELS: TeamPkLabels = {
  live: 'LIVE',
  stable: 'Stable',
  connecting: 'Connecting…',
  host: 'Host',
  endPk: 'End PK',
  ending: 'Ending…',
  endPkConfirmTitle: 'End this Team PK battle?',
  endPkConfirmBody: 'The PK ends, but both live rooms continue.',
  endLive: 'End Live',
  endLiveConfirmTitle: 'End live stream?',
  endLiveConfirmBody: 'This closes your live room. The other team can continue live.',
  cancel: 'Cancel',
  leaveRoom: 'Leave Room',
  saySomething: 'Say something…',
  sticker: 'Sticker',
  gift: 'Gift',
  beauty: 'Beauty',
  muteMicrophone: 'Mute microphone',
  unmuteMicrophone: 'Unmute microphone',
  flipCamera: 'Flip camera',
  more: 'More',
  selectGiftTarget: 'Select gift target',
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function formatCompact(value: number, locale = 'en') {
  const safe = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  if (safe < 1000) return new Intl.NumberFormat(locale).format(safe);
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(safe);
}

function formatFull(value: number, locale = 'en') {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)),
  );
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function CameraTile({
  creator,
  camera,
  side,
  size,
  selected,
  labels,
  locale,
  onSelectGiftReceiver,
}: {
  creator: TeamPkCreatorView | null;
  camera: ReactNode;
  side: 'host' | 'opponent';
  size: 'captain' | 'mate' | 'quad' | 'hex';
  selected: boolean;
  labels: TeamPkLabels;
  locale: string;
  onSelectGiftReceiver?: (userId: string) => void;
}) {
  if (!creator) {
    return (
      <div className={`utpk-tile utpk-tile--${side} utpk-tile--${size} utpk-tile--empty`}>
        {camera}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`utpk-tile utpk-tile--${side} utpk-tile--${size}${selected ? ' is-gift-target' : ''}`}
      onClick={() => onSelectGiftReceiver?.(creator.id)}
      aria-label={`${labels.selectGiftTarget}: ${creator.name}`}
      data-ui-id={`live.pk.team.camera.${creator.id}`}
      data-pk-user-id={creator.id}
      data-pk-role={creator.isCaptain ? 'captain' : 'member'}
      data-pk-side={side}
    >
      <div className="utpk-video-node">{camera}</div>
      {creator.isCaptain ? <span className={`utpk-host-badge utpk-host-badge--${side}`}>{labels.host}</span> : null}
      <div className="utpk-person-meta">
        {creator.avatarUrl ? <img className="utpk-person-avatar" src={creator.avatarUrl} alt="" /> : null}
        <div className="utpk-person-copy">
          <div className="utpk-person-name-row">
            <span className="utpk-person-name">{creator.name}</span>
            {creator.verified ? <ShieldCheck className="utpk-verified" aria-hidden="true" /> : null}
          </div>
          <div className="utpk-person-score">
            <Star aria-hidden="true" />
            <span>{formatCompact(creator.score, locale)}</span>
          </div>
        </div>
      </div>
      <div className="utpk-gift-count" aria-label={`${labels.gift}: ${creator.giftCount}`}>
        <Gift aria-hidden="true" />
        <span>{formatCompact(creator.giftCount, locale)}</span>
      </div>
    </button>
  );
}

export function TeamPkRoom({
  roomId,
  hostTeam,
  opponentTeam,
  declaredTeamSize,
  cameras,
  hostTeamScore,
  opponentTeamScore,
  remainingSeconds,
  multiplier,
  viewersLabel,
  connectionLabel,
  comments,
  isHost,
  isPkEnding,
  isLiveEnding,
  muted,
  selectedGiftReceiverId,
  labels: labelsInput,
  locale = 'en',
  onLeaveRoom,
  onEndPk,
  onEndLive,
  onSendComment,
  onOpenStickers,
  onOpenGifts,
  onOpenBeauty,
  onToggleMicrophone,
  onFlipCamera,
  onSelectGiftReceiver,
}: TeamPkRoomProps) {
  const labels = useMemo(() => ({ ...DEFAULT_LABELS, ...labelsInput }), [labelsInput]);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'pk' | 'live' | null>(null);

  const total = Math.max(0, hostTeamScore) + Math.max(0, opponentTeamScore);
  const leftRatio = total > 0 ? clamp01(hostTeamScore / total) : 0.5;
  const boundary = `${Math.max(3, Math.min(97, leftRatio * 100))}%`;
  // Prefer declared challenge size so sparse early joins do not collapse 6v6 → 4v4.
  const teamSize = (
    declaredTeamSize === 2 || declaredTeamSize === 3 || declaredTeamSize === 4 || declaredTeamSize === 6
      ? declaredTeamSize
      : Math.max(hostTeam.length, opponentTeam.length) >= 6
        ? 6
        : Math.max(hostTeam.length, opponentTeam.length) >= 4
          ? 4
          : Math.max(hostTeam.length, opponentTeam.length) >= 3
            ? 3
            : 2
  ) as 2 | 3 | 4 | 6;
  const hostCaptain = hostTeam[0] ?? null;
  const opponentCaptain = opponentTeam[0] ?? null;
  const hostMates = [hostTeam[1] ?? null, ...(teamSize >= 3 ? [hostTeam[2] ?? null] : [])];
  const opponentMates = [opponentTeam[1] ?? null, ...(teamSize >= 3 ? [opponentTeam[2] ?? null] : [])];
  const hostQuad = Array.from({ length: 4 }, (_, index) => hostTeam[index] ?? null);
  const opponentQuad = Array.from({ length: 4 }, (_, index) => opponentTeam[index] ?? null);
  const hostHex = Array.from({ length: 6 }, (_, index) => hostTeam[index] ?? null);
  const opponentHex = Array.from({ length: 6 }, (_, index) => opponentTeam[index] ?? null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void onSendComment(text, `team-pk-comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  };

  const renderTile = (creator: TeamPkCreatorView | null, side: 'host' | 'opponent', size: 'captain' | 'mate' | 'quad' | 'hex', index: number) => (
    <CameraTile
      key={creator?.id || `${side}-${size}-empty-${index}`}
      creator={creator}
      camera={creator ? cameras[creator.id] : <div className="utpk-camera-waiting">{labels.connecting}</div>}
      side={side}
      size={size}
      selected={Boolean(creator?.id && creator.id === selectedGiftReceiverId)}
      labels={labels}
      locale={locale}
      onSelectGiftReceiver={onSelectGiftReceiver}
    />
  );

  return (
    <section
      className="utpk-root"
      data-ui-id="live.pk.team.room"
      data-pk-room-id={roomId}
      data-pk-team-size={teamSize}
      style={{ '--utpk-boundary': boundary } as CSSProperties}
    >
      <header className="utpk-header" data-ui-id="live.pk.team.header">
        <button type="button" className="utpk-back" onClick={onLeaveRoom} aria-label={labels.leaveRoom}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="utpk-brand">UniLive’s</div>
        <div className="utpk-live-badge">{labels.live}</div>
        <div className="utpk-header-spacer" />
        <div className="utpk-connection" aria-label={connectionLabel}>
          <Signal aria-hidden="true" />
          <span>{connectionLabel || labels.stable}</span>
          <i aria-hidden="true" />
        </div>
        <div className="utpk-viewers"><span className="utpk-viewer-icon">♙</span>{viewersLabel}</div>
        <button
          type="button"
          className="utpk-header-more"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label={labels.more}
          aria-expanded={menuOpen}
        >
          <MoreHorizontal aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div className="utpk-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onLeaveRoom(); }}>
              {labels.leaveRoom}
            </button>
            {isHost ? (
              <button
                type="button"
                className="utpk-menu-danger"
                role="menuitem"
                onClick={() => { setMenuOpen(false); setConfirmAction('live'); }}
              >
                {labels.endLive}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="utpk-score-system" data-ui-id="live.pk.team.score-system">
        <div className="utpk-score-time">
          <span data-ui-id="live.pk.team.timer">{formatTime(remainingSeconds)}</span>
          {multiplier > 1 ? <b data-ui-id="live.pk.team.multiplier">x{multiplier}</b> : null}
        </div>
        <div className="utpk-score-rail" data-ui-id="live.pk.team.score.bar">
          <div className="utpk-score-left" />
          <div className="utpk-score-right" />
          <div className="utpk-score-diamond" aria-hidden="true" />
          <div className="utpk-team-score utpk-team-score--left" data-ui-id="live.pk.team.score.left">
            {formatFull(hostTeamScore, locale)}
          </div>
          <div className="utpk-team-score utpk-team-score--right" data-ui-id="live.pk.team.score.right">
            {formatFull(opponentTeamScore, locale)}
          </div>
        </div>
      </div>

      <div
        className={`utpk-camera-stage${teamSize === 6 ? ' utpk-camera-stage--6v6' : teamSize === 4 ? ' utpk-camera-stage--4v4' : ''}`}
        data-ui-id="live.pk.team.camera-stage"
      >
        {teamSize === 6 ? (
          <div className="utpk-6v6-grid" data-ui-id="live.pk.team.6v6.grid">
            <div className="utpk-6v6-side utpk-6v6-side--host" data-ui-id="live.pk.team.6v6.host-side">
              {hostHex.map((creator, index) => renderTile(creator, 'host', 'hex', index))}
            </div>
            <div className="utpk-6v6-side utpk-6v6-side--opponent" data-ui-id="live.pk.team.6v6.opponent-side">
              {opponentHex.map((creator, index) => renderTile(creator, 'opponent', 'hex', index))}
            </div>
          </div>
        ) : teamSize === 4 ? (
          <div className="utpk-4v4-grid" data-ui-id="live.pk.team.4v4.grid">
            <div className="utpk-4v4-side utpk-4v4-side--host" data-ui-id="live.pk.team.4v4.host-side">
              {hostQuad.map((creator, index) => renderTile(creator, 'host', 'quad', index))}
            </div>
            <div className="utpk-4v4-side utpk-4v4-side--opponent" data-ui-id="live.pk.team.4v4.opponent-side">
              {opponentQuad.map((creator, index) => renderTile(creator, 'opponent', 'quad', index))}
            </div>
          </div>
        ) : (
          <>
            <div className="utpk-captain-row" data-ui-id="live.pk.team.captains">
              {renderTile(hostCaptain, 'host', 'captain', 0)}
              {renderTile(opponentCaptain, 'opponent', 'captain', 0)}
            </div>
            <div className={`utpk-mates-row utpk-mates-row--${teamSize}v${teamSize}`} data-ui-id="live.pk.team.members">
              <div className="utpk-mates-side utpk-mates-side--host">
                {hostMates.map((creator, index) => renderTile(creator, 'host', 'mate', index))}
              </div>
              <div className="utpk-mates-side utpk-mates-side--opponent">
                {opponentMates.map((creator, index) => renderTile(creator, 'opponent', 'mate', index))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="utpk-lower">
        <div className="utpk-comments" data-ui-id="live.pk.team.comments" aria-live="polite">
          {comments.slice(-3).map((comment) => (
            <div className="utpk-comment" key={comment.id}>
              <div className="utpk-comment-avatar" aria-hidden="true">
                {comment.userAvatarUrl ? <img src={comment.userAvatarUrl} alt="" /> : comment.userName.slice(0, 1).toUpperCase()}
              </div>
              <div className="utpk-comment-copy">
                <div className="utpk-comment-name">
                  {comment.userName}
                  {comment.level ? <span className="utpk-level">◆ {comment.level}</span> : null}
                </div>
                <div className="utpk-comment-message">{comment.message}</div>
              </div>
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            type="button"
            className="utpk-end-pk"
            data-ui-id="live.pk.team.action.end-pk"
            onClick={() => setConfirmAction('pk')}
            disabled={isPkEnding}
          >
            <ShieldCheck aria-hidden="true" />
            <span>{isPkEnding ? labels.ending : labels.endPk}</span>
          </button>
        ) : null}
      </div>

      <div className="utpk-controls" data-ui-id="live.pk.team.controls">
        <form className="utpk-composer" onSubmit={submit}>
          <input
            data-ui-id="live.pk.team.comment-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={labels.saySomething}
            maxLength={500}
          />
          <button
            type="button"
            className="utpk-sticker"
            data-ui-id="live.pk.team.action.sticker"
            onClick={onOpenStickers}
            aria-label={labels.sticker}
          >
            <SmilePlus aria-hidden="true" />
          </button>
        </form>
        <button type="button" className="utpk-control" data-ui-id="live.pk.team.action.gift" onClick={onOpenGifts} aria-label={labels.gift}>
          <Gift aria-hidden="true" />
        </button>
        <button type="button" className="utpk-control" data-ui-id="live.pk.team.action.beauty" onClick={onOpenBeauty} aria-label={labels.beauty}>
          <Sparkles aria-hidden="true" />
        </button>
        <button type="button" className={`utpk-control${muted ? ' is-active' : ''}`} data-ui-id="live.pk.team.action.microphone" onClick={onToggleMicrophone} aria-label={muted ? labels.unmuteMicrophone : labels.muteMicrophone}>
          {muted ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
        </button>
        <button type="button" className="utpk-control" data-ui-id="live.pk.team.action.camera" onClick={onFlipCamera} aria-label={labels.flipCamera}>
          <Camera aria-hidden="true" />
        </button>
        <button type="button" className="utpk-control" data-ui-id="live.pk.team.action.more" onClick={() => setMenuOpen((value) => !value)} aria-label={labels.more}>
          <MoreHorizontal aria-hidden="true" />
        </button>
      </div>

      {confirmAction ? (
        <div className="utpk-confirm-backdrop" role="presentation" onMouseDown={() => setConfirmAction(null)}>
          <div className="utpk-confirm" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="utpk-confirm-close" onClick={() => setConfirmAction(null)} aria-label={labels.cancel}>
              <X aria-hidden="true" />
            </button>
            <h2>{confirmAction === 'pk' ? labels.endPkConfirmTitle : labels.endLiveConfirmTitle}</h2>
            <p>{confirmAction === 'pk' ? labels.endPkConfirmBody : labels.endLiveConfirmBody}</p>
            <div className="utpk-confirm-actions">
              <button type="button" onClick={() => setConfirmAction(null)}>{labels.cancel}</button>
              <button
                type="button"
                className="utpk-confirm-danger"
                disabled={confirmAction === 'pk' ? isPkEnding : isLiveEnding}
                onClick={() => {
                  const action = confirmAction;
                  setConfirmAction(null);
                  if (action === 'pk') void onEndPk();
                  else void onEndLive();
                }}
              >
                {confirmAction === 'pk' ? labels.endPk : labels.endLive}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
