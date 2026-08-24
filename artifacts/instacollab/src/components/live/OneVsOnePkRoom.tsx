import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ChangeEventHandler,
  type ElementType,
  type KeyboardEvent as ReactKeyboardEvent,
  type KeyboardEventHandler,
  type ReactNode,
} from 'react';
import {
  Camera,
  ChevronLeft,
  CircleUserRound,
  Gem,
  Gift,
  Mic,
  MicOff,
  MoreHorizontal,
  MoreVertical,
  SmilePlus,
  Square,
  Sparkles,
  Star,
  UsersRound,
} from 'lucide-react';
import './one-vs-one-pk-room.css';

export type PkSide = 'left' | 'right';

export const ONE_VS_ONE_PK_UI_IDS = {
  room: 'live.pk.1v1.room',
  cameraStage: 'live.pk.1v1.camera-stage',
  leftCamera: 'live.pk.1v1.camera.left',
  rightCamera: 'live.pk.1v1.camera.right',
  header: 'live.pk.1v1.header',
  leaveRoom: 'live.pk.1v1.action.leave-room',
  roomMenu: 'live.pk.1v1.action.room-menu',
  leftCreator: 'live.pk.1v1.creator.left',
  rightCreator: 'live.pk.1v1.creator.right',
  scoreSystem: 'live.pk.1v1.score-system',
  leftScore: 'live.pk.1v1.score.left',
  rightScore: 'live.pk.1v1.score.right',
  scoreBar: 'live.pk.1v1.score.bar',
  timer: 'live.pk.1v1.timer',
  comments: 'live.pk.1v1.comments',
  commentInput: 'live.pk.1v1.comment-input',
  sticker: 'live.pk.1v1.action.sticker',
  gift: 'live.pk.1v1.action.gift',
  beauty: 'live.pk.1v1.action.beauty',
  microphone: 'live.pk.1v1.action.microphone',
  camera: 'live.pk.1v1.action.camera',
  more: 'live.pk.1v1.action.more',
  endPk: 'live.pk.1v1.action.end-pk',
  endLive: 'live.pk.1v1.action.end-live',
} as const;

export interface PkCreatorView {
  /** Canonical user_id. Never email/display-name/list-index. */
  id: string;
  name: string;
  audienceLabel: string;
  avatarUrl?: string;
  verified?: boolean;
}

export interface PkCommentView {
  id: string;
  userName: string;
  userAvatarUrl?: string;
  badgeLabel?: string;
  message: string;
  stickerAssetUrl?: string;
  stickerId?: string;
}

export interface OneVsOnePkLabels {
  live: string;
  camerasLabel: string;
  scoreLabel: string;
  commentsLabel: string;
  leaveRoom: string;
  roomMenu: string;
  endPk: string;
  ending: string;
  endPkConfirmTitle: string;
  endPkConfirmBody: string;
  endLive: string;
  endLiveConfirmTitle: string;
  endLiveConfirmBody: string;
  cancel: string;
  saySomething: string;
  openStickers: string;
  gift: string;
  beauty: string;
  muteMicrophone: string;
  unmuteMicrophone: string;
  flipCamera: string;
  more: string;
}

export interface OneVsOnePkTheme {
  leftColor: string;
  leftHighlight: string;
  rightColor: string;
  rightHighlight: string;
  accentColor: string;
  roomBackground: string;
}

type CommentInputProps = {
  value: string;
  'aria-label': string;
  placeholder: string;
  dir: 'auto';
  onChange: ChangeEventHandler<HTMLInputElement>;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
};

export interface OneVsOnePkRoomProps {
  roomId: string;
  leftCreator: PkCreatorView;
  rightCreator: PkCreatorView;
  leftCamera: ReactNode;
  rightCamera: ReactNode;
  leftScore: number;
  rightScore: number;
  remainingSeconds: number;
  multiplier?: number;
  viewersLabel: string;
  connectionLabel?: string;
  locale?: string;
  labels?: Partial<OneVsOnePkLabels>;
  theme?: Partial<OneVsOnePkTheme>;
  comments: PkCommentView[];
  isHost: boolean;
  isPkEnding?: boolean;
  isLiveEnding?: boolean;
  muted?: boolean;
  onLeaveRoom: () => void;
  onEndPk: () => Promise<void> | void;
  onEndLive: () => Promise<void> | void;
  onSendComment: (message: string, clientId: string) => Promise<void> | void;
  CommentInput?: ElementType<CommentInputProps>;
  onOpenStickers: () => void;
  onOpenGifts: () => void;
  onOpenBeauty: () => void;
  onToggleMicrophone: () => void;
  onFlipCamera: () => void;
}

const defaultLabels: OneVsOnePkLabels = {
  live: 'LIVE',
  camerasLabel: '1v1 live cameras',
  scoreLabel: 'Realtime PK score',
  commentsLabel: 'Live comments',
  leaveRoom: 'Leave Room',
  roomMenu: 'Room menu',
  endPk: 'End PK',
  ending: 'Ending…',
  endPkConfirmTitle: 'End this PK battle?',
  endPkConfirmBody: 'The battle ends, but the live room continues.',
  endLive: 'End Live',
  endLiveConfirmTitle: 'End live stream?',
  endLiveConfirmBody: 'This closes the room for the host and every viewer.',
  cancel: 'Cancel',
  saySomething: 'Say something…',
  openStickers: 'Open stickers',
  gift: 'Gift',
  beauty: 'Beauty',
  muteMicrophone: 'Mute microphone',
  unmuteMicrophone: 'Unmute microphone',
  flipCamera: 'Flip camera',
  more: 'More',
};

const defaultTheme: OneVsOnePkTheme = {
  leftColor: '#126cff',
  leftHighlight: '#4ec8ff',
  rightColor: '#ff294d',
  rightHighlight: '#ff6d80',
  accentColor: '#6e32ff',
  roomBackground: '#01040c',
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function formatTimer(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60).toString().padStart(2, '0');
  const seconds = (safe % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function createClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `pk-comment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ActionButton({
  label,
  uiId,
  children,
  onClick,
  className,
}: {
  label: string;
  uiId: string;
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx('u1pk-icon-button', className)}
      aria-label={label}
      title={label}
      data-ui-id={uiId}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CreatorBadge({ creator, side }: { creator: PkCreatorView; side: PkSide }) {
  return (
    <div
      className={cx('u1pk-creator', `u1pk-creator--${side}`)}
      data-ui-id={side === 'left' ? ONE_VS_ONE_PK_UI_IDS.leftCreator : ONE_VS_ONE_PK_UI_IDS.rightCreator}
      data-user-id={creator.id}
    >
      <div className="u1pk-avatar-ring">
        {creator.avatarUrl ? (
          <img src={creator.avatarUrl} alt={`${creator.name} avatar`} />
        ) : (
          <CircleUserRound aria-hidden="true" />
        )}
      </div>
      <div className="u1pk-creator-copy">
        <div className="u1pk-creator-host">Host</div>
        <div className="u1pk-creator-name">
          <span>{creator.name}</span>
        </div>
        <div className="u1pk-audience">
          <Star aria-hidden="true" />
          <span>{creator.audienceLabel}</span>
        </div>
      </div>
    </div>
  );
}

function CommentRow({ comment }: { comment: PkCommentView }) {
  return (
    <div className="u1pk-comment-row" data-comment-id={comment.id}>
      <div className="u1pk-comment-avatar">
        {comment.userAvatarUrl ? <img src={comment.userAvatarUrl} alt="" /> : <CircleUserRound aria-hidden="true" />}
      </div>
      <div className="u1pk-comment-content">
        <div className="u1pk-comment-meta">
          <strong>{comment.userName}</strong>
          {comment.badgeLabel ? (
            <span className="u1pk-comment-badge">
              <Gem aria-hidden="true" />
              {comment.badgeLabel}
            </span>
          ) : null}
        </div>
        {comment.stickerAssetUrl ? (
          <img className="u1pk-sticker-art" src={comment.stickerAssetUrl} alt="" />
        ) : (
          <span dir="auto">{comment.message}</span>
        )}
      </div>
    </div>
  );
}

function ConnectionBars() {
  return (
    <span className="u1pk-signal-bars" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function EndPkGlyph() {
  return (
    <span className="u1pk-end-pk-glyph" aria-hidden="true">
      <Square />
    </span>
  );
}

export function OneVsOnePkRoom({
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
  connectionLabel = 'Stable',
  locale,
  labels,
  theme,
  comments,
  isHost,
  isPkEnding = false,
  isLiveEnding = false,
  muted = false,
  onLeaveRoom,
  onEndPk,
  onEndLive,
  onSendComment,
  CommentInput = 'input',
  onOpenStickers,
  onOpenGifts,
  onOpenBeauty,
  onToggleMicrophone,
  onFlipCamera,
}: OneVsOnePkRoomProps) {
  const [message, setMessage] = useState('');
  const text = useMemo(() => ({ ...defaultLabels, ...labels }), [labels]);
  const visualTheme = useMemo(() => ({ ...defaultTheme, ...theme }), [theme]);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmEndPk, setConfirmEndPk] = useState(false);
  const [confirmEndLive, setConfirmEndLive] = useState(false);
  const [scoreDirection, setScoreDirection] = useState<PkSide | null>(null);
  const [scoreDelta, setScoreDelta] = useState<{ side: PkSide; amount: number; nonce: number } | null>(null);
  const previousScores = useRef({ left: leftScore, right: rightScore });
  const motionTimer = useRef<number | null>(null);
  const dialogId = useId();
  const totalScore = leftScore + rightScore;
  const leftPercent = totalScore > 0 ? Math.min(100, Math.max(0, (leftScore / totalScore) * 100)) : 50;
  const visibleComments = useMemo(() => comments.slice(-3), [comments]);
  const roomStyle = {
    '--u1pk-blue': visualTheme.leftColor,
    '--u1pk-blue-hot': visualTheme.leftHighlight,
    '--u1pk-coral': visualTheme.rightColor,
    '--u1pk-coral-hot': visualTheme.rightHighlight,
    '--u1pk-violet': visualTheme.accentColor,
    '--u1pk-room-background': visualTheme.roomBackground,
  } as CSSProperties;

  useEffect(() => {
    const previous = previousScores.current;
    const leftDelta = Math.max(0, leftScore - previous.left);
    const rightDelta = Math.max(0, rightScore - previous.right);
    previousScores.current = { left: leftScore, right: rightScore };
    if (leftDelta === 0 && rightDelta === 0) return;

    const side: PkSide = leftDelta >= rightDelta ? 'left' : 'right';
    const amount = side === 'left' ? leftDelta : rightDelta;
    setScoreDirection(side);
    setScoreDelta({ side, amount, nonce: Date.now() });

    if (motionTimer.current) window.clearTimeout(motionTimer.current);
    motionTimer.current = window.setTimeout(() => {
      setScoreDirection(null);
      setScoreDelta(null);
    }, 900);
  }, [leftScore, rightScore]);

  useEffect(() => {
    function closeTransientUi(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (confirmEndLive) setConfirmEndLive(false);
      else if (confirmEndPk) setConfirmEndPk(false);
      else if (menuOpen) setMenuOpen(false);
      else onLeaveRoom();
    }
    window.addEventListener('keydown', closeTransientUi);
    return () => {
      window.removeEventListener('keydown', closeTransientUi);
      if (motionTimer.current) window.clearTimeout(motionTimer.current);
    };
  }, [confirmEndLive, confirmEndPk, menuOpen, onLeaveRoom]);

  async function submitMessage() {
    const nextMessage = message.trim();
    if (!nextMessage) return;
    setMessage('');
    try {
      await onSendComment(nextMessage, createClientId());
    } catch {
      setMessage(nextMessage);
    }
  }

  async function confirmPkEnd() {
    try {
      await onEndPk();
      setConfirmEndPk(false);
    } catch {
      /* keep confirm open so the host can retry */
    }
  }

  async function confirmLiveEnd() {
    try {
      await onEndLive();
      setConfirmEndLive(false);
    } catch {
      /* keep confirm open so the host can retry */
    }
  }

  return (
    <main
      className="u1pk-room"
      style={roomStyle}
      data-room-id={roomId}
      data-ui-id={ONE_VS_ONE_PK_UI_IDS.room}
      data-testid="one-vs-one-pk-room"
    >
      <section className="u1pk-camera-stage" aria-label={text.camerasLabel} data-ui-id={ONE_VS_ONE_PK_UI_IDS.cameraStage}>
        <div className="u1pk-camera-panel u1pk-camera-panel--left" data-ui-id={ONE_VS_ONE_PK_UI_IDS.leftCamera}>
          {leftCamera}
        </div>
        <div className="u1pk-camera-panel u1pk-camera-panel--right" data-ui-id={ONE_VS_ONE_PK_UI_IDS.rightCamera}>
          {rightCamera}
        </div>
        <div className="u1pk-camera-divider" aria-hidden="true" />

        <header className="u1pk-header" data-ui-id={ONE_VS_ONE_PK_UI_IDS.header}>
          <ActionButton label={text.leaveRoom} uiId={ONE_VS_ONE_PK_UI_IDS.leaveRoom} className="u1pk-header-button" onClick={onLeaveRoom}>
            <ChevronLeft aria-hidden="true" />
          </ActionButton>
          <div className="u1pk-brand">UniLive’s</div>
          <span className="u1pk-live-chip">{text.live}</span>
          <span className="u1pk-connection">
            <ConnectionBars />
            <span>{connectionLabel}</span>
            <i className="u1pk-stable-dot" aria-hidden="true" />
          </span>
          <span className="u1pk-viewers">
            <UsersRound aria-hidden="true" />
            {viewersLabel}
          </span>
          <ActionButton label={text.roomMenu} uiId={ONE_VS_ONE_PK_UI_IDS.roomMenu} className="u1pk-header-button u1pk-header-menu-button" onClick={() => setMenuOpen((value) => !value)}>
            <MoreVertical aria-hidden="true" />
          </ActionButton>
        </header>

        <CreatorBadge creator={leftCreator} side="left" />
        <CreatorBadge creator={rightCreator} side="right" />
      </section>

      <section className="u1pk-score-system" aria-label={text.scoreLabel} data-ui-id={ONE_VS_ONE_PK_UI_IDS.scoreSystem}>
        <output className="u1pk-score-card u1pk-score-card--left" aria-label={`${leftCreator.name} score`} data-ui-id={ONE_VS_ONE_PK_UI_IDS.leftScore}>
          {numberFormatter.format(leftScore)}
        </output>
        <div className="u1pk-timer" data-ui-id={ONE_VS_ONE_PK_UI_IDS.timer}>{formatTimer(remainingSeconds)}</div>
        {multiplier > 1 ? <div className="u1pk-multiplier">x{multiplier}</div> : null}
        <output className="u1pk-score-card u1pk-score-card--right" aria-label={`${rightCreator.name} score`} data-ui-id={ONE_VS_ONE_PK_UI_IDS.rightScore}>
          {numberFormatter.format(rightScore)}
        </output>

        {scoreDelta ? (
          <div key={scoreDelta.nonce} className={cx('u1pk-score-delta', `u1pk-score-delta--${scoreDelta.side}`)} aria-hidden="true">
            +{numberFormatter.format(scoreDelta.amount)}
          </div>
        ) : null}

        <div className="u1pk-score-bar" data-ui-id={ONE_VS_ONE_PK_UI_IDS.scoreBar} style={{ '--u1pk-left-score': `${leftPercent}%` } as CSSProperties}>
          <div className="u1pk-score-fill u1pk-score-fill--left" />
          <div className="u1pk-score-fill u1pk-score-fill--right" />
          <div className={cx('u1pk-score-marker', scoreDirection && `u1pk-score-marker--${scoreDirection}`)} />
        </div>
      </section>

      <section className="u1pk-activity-panel">
        <div className="u1pk-comments" aria-live="polite" aria-label={text.commentsLabel} data-ui-id={ONE_VS_ONE_PK_UI_IDS.comments}>
          {visibleComments.map((comment) => <CommentRow key={comment.id} comment={comment} />)}
        </div>

        {isHost ? (
          <button type="button" className="u1pk-end-pk" data-ui-id={ONE_VS_ONE_PK_UI_IDS.endPk} disabled={isPkEnding} onClick={() => setConfirmEndPk(true)}>
            <EndPkGlyph />
            <span>{isPkEnding ? text.ending : text.endPk}</span>
          </button>
        ) : null}

        <footer className="u1pk-command-row">
          <div className="u1pk-composer" data-ui-id={ONE_VS_ONE_PK_UI_IDS.commentInput}>
            <CommentInput
              value={message}
              aria-label={text.saySomething}
              placeholder={text.saySomething}
              dir="auto"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setMessage(event.target.value)}
              onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submitMessage();
                }
              }}
            />
          </div>
          <ActionButton label={text.openStickers} uiId={ONE_VS_ONE_PK_UI_IDS.sticker} onClick={onOpenStickers}>
            <SmilePlus aria-hidden="true" />
          </ActionButton>
          <ActionButton label={text.gift} uiId={ONE_VS_ONE_PK_UI_IDS.gift} onClick={onOpenGifts}><Gift aria-hidden="true" /></ActionButton>
          <ActionButton label={text.beauty} uiId={ONE_VS_ONE_PK_UI_IDS.beauty} onClick={onOpenBeauty}><Sparkles aria-hidden="true" /></ActionButton>
          <ActionButton label={muted ? text.unmuteMicrophone : text.muteMicrophone} uiId={ONE_VS_ONE_PK_UI_IDS.microphone} className={muted ? 'u1pk-icon-button--active' : undefined} onClick={onToggleMicrophone}>
            {muted ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
          </ActionButton>
          <ActionButton label={text.flipCamera} uiId={ONE_VS_ONE_PK_UI_IDS.camera} onClick={onFlipCamera}><Camera aria-hidden="true" /></ActionButton>
          <ActionButton label={text.more} uiId={ONE_VS_ONE_PK_UI_IDS.more} onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal aria-hidden="true" /></ActionButton>
        </footer>
      </section>

      {menuOpen ? (
        <div className="u1pk-room-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onLeaveRoom(); }}>{text.leaveRoom}</button>
          {isHost ? (
            <button type="button" role="menuitem" className="u1pk-danger" data-ui-id={ONE_VS_ONE_PK_UI_IDS.endLive} onClick={() => { setMenuOpen(false); setConfirmEndLive(true); }}>
              {text.endLive}…
            </button>
          ) : null}
        </div>
      ) : null}

      {confirmEndPk ? (
        <div className="u1pk-modal-backdrop">
          <section className="u1pk-confirm-card" role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-end-pk-title`}>
            <strong id={`${dialogId}-end-pk-title`}>{text.endPkConfirmTitle}</strong>
            <p>{text.endPkConfirmBody}</p>
            <div>
              <button type="button" onClick={() => setConfirmEndPk(false)}>{text.cancel}</button>
              <button type="button" className="u1pk-danger" disabled={isPkEnding} onClick={() => void confirmPkEnd()}>{isPkEnding ? text.ending : text.endPk}</button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmEndLive ? (
        <div className="u1pk-modal-backdrop">
          <section className="u1pk-confirm-card" role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-end-live-title`}>
            <strong id={`${dialogId}-end-live-title`}>{text.endLiveConfirmTitle}</strong>
            <p>{text.endLiveConfirmBody}</p>
            <div>
              <button type="button" onClick={() => setConfirmEndLive(false)}>{text.cancel}</button>
              <button type="button" className="u1pk-danger" disabled={isLiveEnding} onClick={() => void confirmLiveEnd()}>{isLiveEnding ? text.ending : text.endLive}</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
