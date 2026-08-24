import { Mic, MicOff, MoreHorizontal } from 'lucide-react';
import type { ChatGroup, User } from '../../types';
import { db } from '../../lib/db/localDb';
import { findUserById, resolveUser } from '../../lib/safe';
import { handleAvatarError } from '../../lib/utils';
import type { ChatCallPhase, ChatConnectPhase, RemoteCallParticipant } from '../../lib/chat/chatCallKit';
import { resolveParticipantAvatar } from '../../lib/chat/chatCallKit';
import {
  InCallChat,
  SecureLabel,
  StableCallPill,
  VerifiedMark,
  formatCompactCount,
  resolveCreatorMetric,
  useCallElapsed,
} from './CallApprovedChrome';

export type AudioCallMemberTile = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  connected: boolean;
  hasAudio: boolean;
  isSelf?: boolean;
  metric?: string | null;
};

type AudioCallStageProps = {
  phase: ChatCallPhase;
  connectPhase: ChatConnectPhase;
  isGroup: boolean;
  selectedUser: User | ChatGroup;
  activeChatId?: string | null;
  connectedAt?: number | null;
  currentUserAvatarUrl?: string;
  currentUserId?: string | null;
  remoteParticipants?: RemoteCallParticipant[];
  statusLabel: string;
  error?: string | null;
  isMicMuted?: boolean;
  onRetryConnect?: () => void;
  onMore?: () => void;
};

function buildMemberTiles(
  isGroup: boolean,
  selectedUser: User | ChatGroup,
  currentUserId: string | null | undefined,
  currentUserAvatarUrl: string | undefined,
  remoteParticipants: RemoteCallParticipant[],
): AudioCallMemberTile[] {
  const remoteMap = new Map(remoteParticipants.map((p) => [p.participantId, p]));
  const meId = currentUserId?.trim() || db.currentUserId || '';

  if (!isGroup || !('memberIds' in selectedUser)) {
    const peer = selectedUser as User;
    const remote = remoteMap.get(peer.id);
    return [
      {
        id: peer.id,
        displayName: peer.displayName || peer.username || 'Contact',
        avatarUrl: peer.avatarUrl,
        connected: Boolean(remote),
        hasAudio: remote?.hasAudio ?? false,
        metric: resolveCreatorMetric(peer),
      },
    ];
  }

  const group = selectedUser as ChatGroup;
  const ids = Array.from(new Set([...(group.memberIds || []), ...remoteMap.keys()].filter(Boolean)));
  const tiles: AudioCallMemberTile[] = [];

  if (meId) {
    const me = resolveUser(db.users, findUserById(db.users, meId));
    tiles.push({
      id: meId,
      displayName: me.displayName || me.username || 'You',
      avatarUrl: currentUserAvatarUrl || me.avatarUrl,
      connected: true,
      hasAudio: true,
      isSelf: true,
      metric: resolveCreatorMetric(me),
    });
  }

  for (const id of ids) {
    if (!id || id === meId) continue;
    const user = resolveUser(db.users, findUserById(db.users, id));
    const remote = remoteMap.get(id);
    tiles.push({
      id,
      displayName: user.displayName || user.username || remote?.participantName || id,
      avatarUrl: user.avatarUrl || resolveParticipantAvatar(id),
      connected: Boolean(remote),
      hasAudio: remote?.hasAudio ?? false,
      metric: resolveCreatorMetric(user),
    });
  }

  return tiles;
}

function AudioWave() {
  return (
    <div className="call-approved-audio-wave" aria-hidden>
      {Array.from({ length: 13 }).map((_, index) => (
        <i key={index} style={{ height: `${8 + ((index * 9) % 30)}px`, animationDelay: `${-(index % 4) * 0.16}s` }} />
      ))}
    </div>
  );
}

export function AudioCallStage({
  phase,
  connectPhase,
  isGroup,
  selectedUser,
  activeChatId,
  connectedAt,
  currentUserAvatarUrl,
  currentUserId,
  remoteParticipants = [],
  statusLabel,
  error,
  isMicMuted = false,
  onRetryConnect,
  onMore,
}: AudioCallStageProps) {
  const isConnected = phase === 'connected';
  const elapsed = useCallElapsed(connectedAt);
  const members = buildMemberTiles(isGroup, selectedUser, currentUserId, currentUserAvatarUrl, remoteParticipants);
  const meId = currentUserId?.trim() || db.currentUserId || '';

  if (isGroup) {
    const group = selectedUser as ChatGroup;
    const connectedCount = members.filter((member) => member.connected).length;
    return (
      <div className="call-approved-mobile-shell call-approved-audio-page" data-ui-id="call.group.audio.active">
        <div className="call-approved-topbar">
          <button type="button" onClick={onMore} aria-label="Call menu"><MoreHorizontal className="h-5 w-5" /></button>
          <div>
            <div className="flex items-center gap-2">
              <span className="brand">UniLive’s</span>
              <span className="tag">AUDIO CALL</span>
            </div>
            <SecureLabel />
          </div>
          <span className="grow" />
          <StableCallPill elapsed={elapsed} memberCount={Math.max(connectedCount, group.memberIds?.length || 0)} />
        </div>

        <div className="call-approved-audio-header">
          <div>
            <h1>{group.displayName || 'Group Audio Call'}</h1>
            <p>ID: {group.id}</p>
          </div>
        </div>

        <div className="call-approved-audio-grid" data-ui-id="call.group.audio.participants">
          {members.slice(0, 12).map((member, index) => {
            const muted = member.isSelf ? isMicMuted : !member.hasAudio;
            return (
              <div className="member" key={member.id}>
                <div className="avatar">
                  <img src={member.avatarUrl || undefined} alt={member.displayName} onError={handleAvatarError} />
                  {member.id === group.createdBy ? <span className="absolute -left-1 -top-1 rounded-md bg-violet-700 px-2 py-1 text-[9px] font-semibold">Host</span> : null}
                  <span className={`mic-state${muted ? ' muted' : ''}`}>
                    {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </span>
                </div>
                <div className="member-name">
                  <span className="truncate">{member.isSelf ? 'You' : member.displayName}</span>
                  {!member.isSelf ? <VerifiedMark className="!h-[14px] !w-[14px]" /> : null}
                </div>
                <div className="member-stat">{member.metric ? `🌸 ${member.metric}` : member.connected ? 'In call' : 'Waiting'}</div>
              </div>
            );
          })}
        </div>

        <InCallChat chatId={activeChatId || selectedUser.id} currentUserId={meId} maxMessages={4} />

        {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
        {(connectPhase === 'slow' || connectPhase === 'failed') && onRetryConnect ? (
          <button type="button" onClick={onRetryConnect} className="mx-auto rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold">
            Retry connection
          </button>
        ) : null}
      </div>
    );
  }

  const peer = members[0];
  const me = meId ? resolveUser(db.users, findUserById(db.users, meId)) : null;
  const meName = me?.displayName || me?.username || 'You';
  const meMetric = resolveCreatorMetric(me);
  const peerMetric = peer?.metric || resolveCreatorMetric(selectedUser);

  return (
    <div className="call-approved-mobile-shell call-approved-audio-page" data-ui-id="call.1v1.audio.active">
      <div className="call-approved-topbar">
        <button type="button" onClick={onMore} aria-label="Call menu"><MoreHorizontal className="h-5 w-5" /></button>
        <div>
          <div className="brand">1v1 Audio Call</div>
          <SecureLabel />
        </div>
        <span className="grow" />
        <StableCallPill elapsed={elapsed} />
      </div>

      <div className="call-approved-audio-duo">
        <div className="call-approved-audio-person">
          <div className="avatar">
            <img src={currentUserAvatarUrl || me?.avatarUrl || undefined} alt={meName} onError={handleAvatarError} />
            <span className="mic-dot">{isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</span>
          </div>
          <h2>{meName}<VerifiedMark /></h2>
          <p>{meMetric ? `🌸 ${meMetric}` : 'Host'}</p>
        </div>
        <AudioWave />
        <div className="call-approved-audio-person remote">
          <div className="avatar">
            <img src={peer?.avatarUrl || selectedUser.avatarUrl || undefined} alt={peer?.displayName || selectedUser.displayName} onError={handleAvatarError} />
            <span className="mic-dot">{peer?.hasAudio ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</span>
          </div>
          <h2>{peer?.displayName || selectedUser.displayName}<VerifiedMark /></h2>
          <p>{peerMetric ? `🌸 ${peerMetric}` : isConnected ? 'Connected' : 'Connecting'}</p>
        </div>
      </div>

      <div className="call-approved-private-card">
        <span className="hearts" aria-hidden>💜💜</span>
        <p>You are having a 1v1.<br />Enjoy your private conversation.</p>
        <span className="ml-auto text-xs text-white/45">{elapsed}</span>
      </div>

      <InCallChat chatId={activeChatId || selectedUser.id} currentUserId={meId} maxMessages={4} />

      <p className="text-center text-xs text-white/45">{statusLabel}</p>
      {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
      {(connectPhase === 'slow' || connectPhase === 'failed') && onRetryConnect ? (
        <button type="button" onClick={onRetryConnect} className="mx-auto rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold">
          Retry connection
        </button>
      ) : null}
    </div>
  );
}
