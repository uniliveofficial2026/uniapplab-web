import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bell,
  Check,
  Gift,
  Heart,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Phone,
  PhoneOff,
  Send,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  WandSparkles,
} from 'lucide-react';
import type { ChatMessage } from '../../types';
import { db } from '../../lib/db/localDb';
import { syncCloudChatHistory } from '../../lib/chat/cloudChatSync';
import { findUserById, resolveUser } from '../../lib/safe';
import { handleAvatarError } from '../../lib/utils';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import { UniLivesBrandMark } from '../brand/UniLivesBrandMark';

export function formatCompactCount(value: unknown): string | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 1 : 1)}K`;
  return String(Math.round(n));
}

export function resolveCreatorMetric(entity: unknown): string | null {
  if (!entity || typeof entity !== 'object') return null;
  const record = entity as Record<string, unknown>;
  const candidates = [
    record.followersCount,
    record.followerCount,
    record.followers,
    record.fansCount,
    record.fans,
    record.popularity,
    record.points,
  ];
  for (const candidate of candidates) {
    const formatted = formatCompactCount(candidate);
    if (formatted) return formatted;
  }
  return null;
}

export function useCallElapsed(connectedAt?: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!connectedAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [connectedAt]);

  const seconds = connectedAt ? Math.max(0, Math.floor((now - connectedAt) / 1000)) : 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function VerifiedMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`call-approved-verified-mark inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#139dff] text-white ${className}`}
      aria-label="Verified"
    >
      <Check className="h-3 w-3 stroke-[3]" />
    </span>
  );
}

export function StableCallPill({
  elapsed,
  memberCount,
}: {
  elapsed: string;
  memberCount?: number;
}) {
  return (
    <div className="call-approved-status-row">
      <span className="call-approved-status-pill">
        <span className="call-approved-bars" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>Stable</span>
        <span className="call-approved-status-divider" />
        <span>{elapsed}</span>
      </span>
      {typeof memberCount === 'number' ? (
        <span className="call-approved-member-pill">
          <Users className="h-4 w-4" />
          {memberCount}
        </span>
      ) : null}
    </div>
  );
}

export function SecureLabel({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'call-approved-secure-label compact' : 'call-approved-secure-label'}>
      <Lock className="h-3.5 w-3.5" /> Secure
    </span>
  );
}

export function EncryptionPill() {
  return (
    <div className="call-approved-encryption-pill">
      <Lock className="h-4 w-4" />
      <span>End-to-end Encrypted</span>
      <ShieldCheck className="h-4 w-4 text-emerald-400" />
    </div>
  );
}

export function CallRingingWave({ className = '' }: { className?: string }) {
  return (
    <div className={`call-approved-ringing-wave ${className}`.trim()} aria-hidden data-ui-id="call.ringing.wave">
      {Array.from({ length: 9 }).map((_, index) => (
        <i key={index} style={{ height: `${10 + ((index * 9) % 28)}px` }} />
      ))}
    </div>
  );
}

export function CallRingingAvatar({
  avatarUrl,
  alt,
  ringing = false,
}: {
  avatarUrl?: string;
  alt: string;
  ringing?: boolean;
}) {
  return (
    <div
      className={`call-approved-avatar-ring${ringing ? ' call-approved-avatar-ring--ringing' : ''}`}
      data-ui-id={ringing ? 'call.ringing.avatar' : undefined}
    >
      {ringing ? (
        <>
          <span className="call-approved-avatar-ring-pulse call-approved-avatar-ring-pulse--1" aria-hidden />
          <span className="call-approved-avatar-ring-pulse call-approved-avatar-ring-pulse--2" aria-hidden />
        </>
      ) : null}
      <img src={avatarUrl || undefined} alt={alt} onError={handleAvatarError} />
    </div>
  );
}

export function CallBrand({ callLabel }: { callLabel?: string }) {
  return (
    <div className="call-approved-brand">
      <div className="call-approved-brand-line">
        <span className="call-approved-brand-word">UniLive’s</span>
        <UniLivesBrandMark
          variant="icon"
          context="header"
          className="call-approved-brand-mark"
          imgClassName="object-contain w-full h-full"
          alt={`${APP_DISPLAY_NAME} logo`}
        />
      </div>
      {callLabel ? <div className="call-approved-brand-subtitle">{callLabel}</div> : null}
    </div>
  );
}

export function CallDynamicIsland({
  callerName,
  callerAvatarUrl,
  subtitle,
  incoming = false,
  onAccept,
  onDecline,
  onExpand,
}: {
  callerName: string;
  callerAvatarUrl?: string;
  subtitle: string;
  incoming?: boolean;
  onAccept?: () => void;
  onDecline: () => void;
  /** Unlocked-device compact chrome — tap to open the full incoming/outgoing screen. */
  onExpand?: () => void;
}) {
  return (
    <div className="call-approved-island" data-ui-id={incoming ? 'call.incoming.dynamic-island' : 'call.outgoing.dynamic-island'}>
      {onExpand ? (
        <button type="button" className="call-approved-island-person call-approved-island-expand" onClick={onExpand}>
          <span className="call-approved-island-dot" />
          <img src={callerAvatarUrl || undefined} alt="" onError={handleAvatarError} />
          <div className="call-approved-island-copy">
            <strong>{callerName}</strong>
            <span>{subtitle}</span>
          </div>
        </button>
      ) : (
        <div className="call-approved-island-person">
          <span className="call-approved-island-dot" />
          <img src={callerAvatarUrl || undefined} alt="" onError={handleAvatarError} />
          <div className="call-approved-island-copy">
            <strong>{callerName}</strong>
            <span>{subtitle}</span>
          </div>
        </div>
      )}
      <div className="call-approved-wave-mini" aria-hidden>
        {Array.from({ length: 9 }).map((_, index) => (
          <i key={index} style={{ height: `${8 + ((index * 7) % 21)}px` }} />
        ))}
      </div>
      <div className="call-approved-island-actions">
        <button type="button" className="call-approved-island-decline" onClick={onDecline} aria-label="Decline call">
          <PhoneOff className="h-5 w-5" />
        </button>
        {incoming && onAccept ? (
          <button type="button" className="call-approved-island-accept" onClick={onAccept} aria-label="Accept call">
            <Phone className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CreatorIdentity({
  name,
  verified = true,
  metric,
  large = false,
}: {
  name: string;
  verified?: boolean;
  metric?: string | null;
  large?: boolean;
}) {
  return (
    <div className={large ? 'call-approved-creator large' : 'call-approved-creator'}>
      <div className="call-approved-creator-name">
        <strong>{name}</strong>
        {verified ? <VerifiedMark /> : null}
      </div>
      {metric ? (
        <span className="call-approved-creator-metric">
          <span aria-hidden>🌸</span> {metric}
        </span>
      ) : null}
    </div>
  );
}

export function CallCircleAction({
  icon,
  label,
  active = false,
  danger = false,
  onClick,
  dataUiId,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  dataUiId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-ui-id={dataUiId}
      className={`call-approved-circle-action${active ? ' active' : ''}${danger ? ' danger' : ''}`}
      aria-label={label}
    >
      <span className="call-approved-circle-action-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function getMessageTimestamp(message: ChatMessage): number {
  if (typeof message.timestamp === 'number') return message.timestamp;
  if (typeof message.timestamp === 'string') {
    const parsed = Date.parse(message.timestamp);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }
  return Date.now();
}

function resolveMessageSender(message: ChatMessage, currentUserId?: string | null) {
  const senderId = message.isAuthor ? currentUserId || db.currentUserId : typeof message.from === 'string' ? message.from : '';
  if (!senderId) {
    return { id: '', name: message.isAuthor ? 'You' : 'Member', avatarUrl: undefined as string | undefined };
  }
  const user = resolveUser(db.users, findUserById(db.users, senderId));
  return {
    id: senderId,
    name: message.isAuthor ? 'You' : user.displayName || user.username || 'Member',
    avatarUrl: user.avatarUrl,
  };
}

function threadSignature(messages: readonly ChatMessage[]): string {
  const tail = messages.slice(-8);
  return tail.map((m) => `${m.id || ''}:${m.timestamp || ''}:${m.text || ''}:${m.deliveryStatus || ''}`).join('|');
}

export function InCallChat({
  chatId,
  currentUserId,
  maxMessages = 4,
  showComposer = true,
  className = '',
}: {
  chatId?: string | null;
  currentUserId?: string | null;
  maxMessages?: number;
  showComposer?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!chatId) return undefined;
    // The inline call chat is the same canonical Messages thread. Pull history when
    // the call surface mounts, then converge through the normal realtime/local DB path.
    void syncCloudChatHistory(chatId).catch(() => undefined);
    let last = threadSignature((db.messages[chatId] || []) as ChatMessage[]);
    const refresh = () => {
      const next = threadSignature((db.messages[chatId] || []) as ChatMessage[]);
      if (next !== last) {
        last = next;
        setVersion((v) => v + 1);
      }
    };
    const onActivity = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId?: string }>).detail;
      if (!detail?.chatId || detail.chatId === chatId) refresh();
    };
    window.addEventListener('chat-inbox-activity', onActivity);
    const id = window.setInterval(refresh, 650);
    return () => {
      window.removeEventListener('chat-inbox-activity', onActivity);
      window.clearInterval(id);
    };
  }, [chatId]);

  const visibleMessages = useMemo(() => {
    void version;
    if (!chatId) return [] as ChatMessage[];
    return ((db.messages[chatId] || []) as ChatMessage[])
      .filter((message) => !message.isCallEvent && Boolean(String(message.text || '').trim()))
      .slice(-maxMessages);
  }, [chatId, maxMessages, version]);

  useEffect(() => {
    if (!chatId || visibleMessages.length === 0) return;
    const latestInbound = [...visibleMessages]
      .reverse()
      .find((message) => !message.isAuthor);
    if (!latestInbound) return;
    const timestamp = getMessageTimestamp(latestInbound);
    if (timestamp > db.getChatReadAt(chatId)) db.setChatReadAt(chatId, timestamp);
  }, [chatId, visibleMessages]);

  const send = () => {
    const text = draft.trim();
    const senderId = currentUserId || db.currentUserId;
    if (!chatId || !senderId || !text) return;
    const now = Date.now();
    const id = `callmsg_${senderId}_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const message: ChatMessage = {
      id,
      clientId: id,
      text,
      isAuthor: true,
      from: senderId,
      timestamp: now,
      deliveryStatus: 'sending',
    } as ChatMessage;
    // db.addMessage is the single optimistic-send entrypoint. It persists locally,
    // emits chat activity, and enqueues exactly one idempotent cloud/outbox send.
    db.addMessage(chatId, message);
    setDraft('');
    setVersion((v) => v + 1);
  };

  return (
    <section className={`call-approved-chat ${className}`} data-ui-id="call.chat.inline">
      <div className="call-approved-chat-list" aria-live="polite">
        {visibleMessages.length ? (
          visibleMessages.map((message, index) => {
            const sender = resolveMessageSender(message, currentUserId);
            const ts = getMessageTimestamp(message);
            return (
              <div className="call-approved-chat-row" key={`${message.id || ts}-${index}`}>
                <img src={sender.avatarUrl || undefined} alt="" onError={handleAvatarError} />
                <div className="call-approved-chat-copy">
                  <div className="call-approved-chat-meta">
                    <strong>{sender.name}</strong>
                    <span>{new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p>{String(message.text || '')}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="call-approved-chat-empty">Call chat is ready.</div>
        )}
      </div>
      {showComposer ? (
        <div className="call-approved-chat-compose">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Type a message..."
            aria-label="Call chat message"
          />
          <button type="button" onClick={send} disabled={!draft.trim()} aria-label="Send message">
            <Send className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function SecondaryCallActions({
  onMessage,
  onRemind,
}: {
  onMessage: () => void;
  onRemind: () => void;
}) {
  return (
    <div className="call-approved-secondary-actions">
      <button type="button" onClick={onRemind}>
        <Bell className="h-5 w-5" />
        <span>Remind Me</span>
      </button>
      <button type="button" onClick={onMessage}>
        <MessageCircle className="h-5 w-5" />
        <span>Message</span>
      </button>
    </div>
  );
}

export function CallInfoCard({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="call-approved-info-card">
      {icon ? <span className="call-approved-info-icon">{icon}</span> : null}
      <div>{children}</div>
    </div>
  );
}

export function CallToolIcon({ kind }: { kind: 'gift' | 'sticker' | 'beauty' | 'more' | 'invite' | 'heart' }) {
  if (kind === 'gift') return <Gift className="h-5 w-5" />;
  if (kind === 'sticker') return <Sparkles className="h-5 w-5" />;
  if (kind === 'beauty') return <WandSparkles className="h-5 w-5" />;
  if (kind === 'invite') return <UserPlus className="h-5 w-5" />;
  if (kind === 'heart') return <Heart className="h-5 w-5" />;
  return <MoreHorizontal className="h-5 w-5" />;
}
