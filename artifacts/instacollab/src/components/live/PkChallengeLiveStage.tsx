import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ElementType,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import {
  BadgeCheck,
  Camera,
  ChevronLeft,
  Clock3,
  Gift,
  Mic,
  MicOff,
  MoreVertical,
  Smile,
  Sparkles,
  Swords,
  UsersRound,
  Video,
} from 'lucide-react';
import './pk-challenge-live-stage.css';

export const PK_CHALLENGE_UI_IDS = {
  stage: 'live.pk.1v1.challenge.stage',
  camera: 'live.pk.1v1.challenge.camera',
  header: 'live.pk.1v1.challenge.header',
  leaveRoom: 'live.pk.1v1.challenge.leave-room',
  card: 'live.pk.1v1.challenge.card',
  challenger: 'live.pk.1v1.challenge.challenger',
  expires: 'live.pk.1v1.challenge.expires',
  accept: 'live.pk.1v1.challenge.accept',
  decline: 'live.pk.1v1.challenge.decline',
  composer: 'live.pk.1v1.challenge.composer',
  sticker: 'live.pk.1v1.challenge.sticker',
  gift: 'live.pk.1v1.challenge.gift',
  beauty: 'live.pk.1v1.challenge.beauty',
  microphone: 'live.pk.1v1.challenge.microphone',
  cameraFlip: 'live.pk.1v1.challenge.camera-flip',
  more: 'live.pk.1v1.challenge.more',
  endLive: 'live.pk.1v1.challenge.end-live',
} as const;

export interface PkChallengeCreatorView {
  /** Canonical auth user_id. Never email, username, display name, or array position. */
  id: string;
  name: string;
  avatarUrl?: string;
  verified?: boolean;
}

export interface PkChallengeLabels {
  live: string;
  stable: string;
  challengeTitle: string;
  challengingYou: string;
  mutualHosts: string;
  videoPk: string;
  roundDuration: string;
  stableConnection: string;
  respondIn: string;
  acceptPk: string;
  accepting: string;
  decline: string;
  declining: string;
  liveContinues: string;
  saySomething: string;
  sticker: string;
  gift: string;
  beauty: string;
  muteMicrophone: string;
  unmuteMicrophone: string;
  flipCamera: string;
  more: string;
  leaveRoom: string;
  endLive: string;
  endLiveTitle: string;
  endLiveBody: string;
  cancel: string;
  ending: string;
}

export interface PkChallengeLiveStageProps {
  roomId: string;
  /** Existing mounted live camera/video presentation. Never a screenshot or WebP fallback in production. */
  camera: ReactNode;
  challenger: PkChallengeCreatorView;
  /** Optional real avatars for the two mutual hosts shown under the challenger copy. */
  mutualHostAvatars?: string[];
  viewersLabel: string;
  connectionLabel?: string;
  durationSeconds?: number;
  /** Authoritative server expiry timestamp. UI countdown is derived from this value. */
  expiresAt: string | number | Date;
  labels?: Partial<PkChallengeLabels>;
  muted?: boolean;
  isAccepting?: boolean;
  isDeclining?: boolean;
  isLiveEnding?: boolean;
  onAcceptPk: () => Promise<void> | void;
  onDeclinePk: () => Promise<void> | void;
  onChallengeExpired: () => Promise<void> | void;
  onLeaveRoom: () => void;
  onEndLive: () => Promise<void> | void;
  onSendComment: (message: string, clientId: string) => Promise<void> | void;
  onOpenStickers: () => void;
  onOpenGifts: () => void;
  onOpenBeauty: () => void;
  onToggleMicrophone: () => void;
  onFlipCamera: () => void;
  CommentInput?: ElementType<{
    value: string;
    placeholder: string;
    'aria-label': string;
    dir: 'auto';
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  }>;
}

const DEFAULT_LABELS: PkChallengeLabels = {
  live: 'LIVE',
  stable: 'Stable',
  challengeTitle: 'PK Challenge',
  challengingYou: 'Challenging you to a PK!',
  mutualHosts: 'You’re both mutual hosts',
  videoPk: '1v1 Video PK',
  roundDuration: '3 min round',
  stableConnection: 'Stable connection',
  respondIn: 'Respond in',
  acceptPk: 'Accept PK',
  accepting: 'Accepting…',
  decline: 'Decline',
  declining: 'Declining…',
  liveContinues: 'Your live continues either way.',
  saySomething: 'Say something…',
  sticker: 'Sticker',
  gift: 'Gift',
  beauty: 'Beauty',
  muteMicrophone: 'Mute microphone',
  unmuteMicrophone: 'Unmute microphone',
  flipCamera: 'Flip camera',
  more: 'More',
  leaveRoom: 'Leave Room',
  endLive: 'End Live',
  endLiveTitle: 'End live stream?',
  endLiveBody: 'This closes your live for every viewer. The PK challenge will be cancelled.',
  cancel: 'Cancel',
  ending: 'Ending…',
};

function createClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `pk-challenge-comment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toMs(value: string | number | Date) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min round`;
}

function SignalBars() {
  return (
    <span className="u1pkc-signal" aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}

function Avatar({ src, name }: { src?: string; name: string }) {
  return src ? <img src={src} alt={`${name} avatar`} /> : <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>;
}

export function PkChallengeLiveStage({
  roomId,
  camera,
  challenger,
  mutualHostAvatars = [],
  viewersLabel,
  connectionLabel = 'Stable',
  durationSeconds = 180,
  expiresAt,
  labels,
  muted = false,
  isAccepting = false,
  isDeclining = false,
  isLiveEnding = false,
  onAcceptPk,
  onDeclinePk,
  onChallengeExpired,
  onLeaveRoom,
  onEndLive,
  onSendComment,
  onOpenStickers,
  onOpenGifts,
  onOpenBeauty,
  onToggleMicrophone,
  onFlipCamera,
  CommentInput = 'input',
}: PkChallengeLiveStageProps) {
  const text = useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
  const expiryMs = useMemo(() => toMs(expiresAt), [expiresAt]);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmEndLive, setConfirmEndLive] = useState(false);
  const expiredOnce = useRef(false);
  const dialogId = useId();
  const remaining = Math.max(0, Math.ceil((expiryMs - now) / 1000));
  const busy = isAccepting || isDeclining;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining > 0 || expiredOnce.current) return;
    expiredOnce.current = true;
    void onChallengeExpired();
  }, [remaining, onChallengeExpired]);

  useEffect(() => {
    expiredOnce.current = false;
  }, [expiryMs, challenger.id]);

  async function submitComment() {
    const next = message.trim();
    if (!next) return;
    setMessage('');
    try {
      await onSendComment(next, createClientId());
    } catch {
      setMessage(next);
    }
  }

  return (
    <main className="u1pkc-stage" data-room-id={roomId} data-ui-id={PK_CHALLENGE_UI_IDS.stage}>
      <section className="u1pkc-camera" data-ui-id={PK_CHALLENGE_UI_IDS.camera} aria-label="Current live camera">
        {camera}
      </section>
      <div className="u1pkc-camera-shade" aria-hidden="true" />

      <header className="u1pkc-header" data-ui-id={PK_CHALLENGE_UI_IDS.header}>
        <button type="button" className="u1pkc-header-icon u1pkc-back" aria-label={text.leaveRoom} data-ui-id={PK_CHALLENGE_UI_IDS.leaveRoom} onClick={onLeaveRoom}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <strong className="u1pkc-brand">UniLive’s</strong>
        <span className="u1pkc-live-chip">{text.live}</span>
        <span className="u1pkc-connection"><i />{connectionLabel}</span>
        <span className="u1pkc-viewers"><UsersRound aria-hidden="true" />{viewersLabel}</span>
        <button type="button" className="u1pkc-header-icon" aria-label={text.more} onClick={() => setMoreOpen((v) => !v)}>
          <MoreVertical aria-hidden="true" />
        </button>
      </header>

      <section className="u1pkc-card" data-ui-id={PK_CHALLENGE_UI_IDS.card} aria-label={text.challengeTitle}>
        <div className="u1pkc-title-row"><span /><Swords aria-hidden="true" /><strong>{text.challengeTitle}</strong><span /></div>

        <div className="u1pkc-challenger-avatar" data-user-id={challenger.id}>
          <Avatar src={challenger.avatarUrl} name={challenger.name} />
          <i className="u1pkc-status-dot" aria-hidden="true" />
        </div>

        <div className="u1pkc-challenger-name" data-ui-id={PK_CHALLENGE_UI_IDS.challenger}>
          <strong>{challenger.name}</strong>
          {challenger.verified !== false ? <BadgeCheck aria-label="Verified" /> : null}
        </div>
        <p className="u1pkc-challenging-copy">{text.challengingYou}</p>

        <div className="u1pkc-mutual-row">
          <div className="u1pkc-mutual-avatars" aria-hidden="true">
            {mutualHostAvatars.slice(0, 2).map((src, index) => <img src={src} alt="" key={`${src}-${index}`} />)}
          </div>
          <span>{text.mutualHosts}</span>
        </div>

        <div className="u1pkc-facts">
          <div><i><Video aria-hidden="true" /></i><span>{text.videoPk}</span></div>
          <div><i><Clock3 aria-hidden="true" /></i><span>{labels?.roundDuration ?? formatDuration(durationSeconds)}</span></div>
          <div><i><SignalBars /></i><span>{text.stableConnection}</span></div>
        </div>

        <div className="u1pkc-respond" data-ui-id={PK_CHALLENGE_UI_IDS.expires}>
          <Clock3 aria-hidden="true" />
          <span>{text.respondIn}</span>
          <strong>{remaining}s</strong>
        </div>

        <button type="button" className="u1pkc-accept" data-ui-id={PK_CHALLENGE_UI_IDS.accept} disabled={busy || remaining <= 0} onClick={() => void onAcceptPk()}>
          {isAccepting ? text.accepting : text.acceptPk}
        </button>
        <button type="button" className="u1pkc-decline" data-ui-id={PK_CHALLENGE_UI_IDS.decline} disabled={busy} onClick={() => void onDeclinePk()}>
          {isDeclining ? text.declining : text.decline}
        </button>
        <p className="u1pkc-live-continues">{text.liveContinues}</p>
      </section>

      <footer className="u1pkc-command-row">
        <div className="u1pkc-composer" data-ui-id={PK_CHALLENGE_UI_IDS.composer}>
          <CommentInput
            value={message}
            placeholder={text.saySomething}
            aria-label={text.saySomething}
            dir="auto"
            onChange={(event: ChangeEvent<HTMLInputElement>) => setMessage(event.target.value)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submitComment();
              }
            }}
          />
          <button type="button" className="u1pkc-sticker" data-ui-id={PK_CHALLENGE_UI_IDS.sticker} aria-label={text.sticker} onClick={onOpenStickers}><Smile aria-hidden="true" /></button>
        </div>
        <button type="button" className="u1pkc-action u1pkc-gift" data-ui-id={PK_CHALLENGE_UI_IDS.gift} aria-label={text.gift} onClick={onOpenGifts}><Gift aria-hidden="true" /></button>
        <button type="button" className="u1pkc-action" data-ui-id={PK_CHALLENGE_UI_IDS.beauty} aria-label={text.beauty} onClick={onOpenBeauty}><Sparkles aria-hidden="true" /><span>{text.beauty}</span></button>
        <button type="button" className="u1pkc-action" data-ui-id={PK_CHALLENGE_UI_IDS.microphone} aria-label={muted ? text.unmuteMicrophone : text.muteMicrophone} onClick={onToggleMicrophone}>{muted ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}</button>
        <button type="button" className="u1pkc-action" data-ui-id={PK_CHALLENGE_UI_IDS.cameraFlip} aria-label={text.flipCamera} onClick={onFlipCamera}><Camera aria-hidden="true" /></button>
        <button type="button" className="u1pkc-action" data-ui-id={PK_CHALLENGE_UI_IDS.more} aria-label={text.more} onClick={() => setMoreOpen((v) => !v)}><MoreVertical aria-hidden="true" /></button>
      </footer>

      {moreOpen ? (
        <div className="u1pkc-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); onLeaveRoom(); }}>{text.leaveRoom}</button>
          <button type="button" role="menuitem" className="u1pkc-danger" data-ui-id={PK_CHALLENGE_UI_IDS.endLive} onClick={() => { setMoreOpen(false); setConfirmEndLive(true); }}>{text.endLive}…</button>
        </div>
      ) : null}

      {confirmEndLive ? (
        <div className="u1pkc-modal-backdrop">
          <section className="u1pkc-confirm" role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-title`}>
            <strong id={`${dialogId}-title`}>{text.endLiveTitle}</strong>
            <p>{text.endLiveBody}</p>
            <div>
              <button type="button" onClick={() => setConfirmEndLive(false)}>{text.cancel}</button>
              <button type="button" className="u1pkc-danger" disabled={isLiveEnding} onClick={() => void onEndLive()}>{isLiveEnding ? text.ending : text.endLive}</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
