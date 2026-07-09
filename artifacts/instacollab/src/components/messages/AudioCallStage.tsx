import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { ChatGroup, User } from '../../types';
import { handleAvatarError } from '../../lib/utils';
import { db } from '../../lib/db/localDb';
import { findUserById, resolveUser } from '../../lib/safe';
import type { ChatCallPhase, ChatConnectPhase, RemoteCallParticipant } from '../../lib/chat/chatCallKit';
import { resolveParticipantAvatar } from '../../lib/chat/chatCallKit';
import { AudioCallWaveBars } from './AudioCallWaveBars';

export type AudioCallMemberTile = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  connected: boolean;
  isSelf?: boolean;
};

type AudioCallStageProps = {
  phase: ChatCallPhase;
  connectPhase: ChatConnectPhase;
  isGroup: boolean;
  selectedUser: User | ChatGroup;
  currentUserAvatarUrl?: string;
  currentUserId?: string | null;
  remoteParticipants?: RemoteCallParticipant[];
  statusLabel: string;
  error?: string | null;
  isMicMuted?: boolean;
  onRetryConnect?: () => void;
};

function buildMemberTiles(
  isGroup: boolean,
  selectedUser: User | ChatGroup,
  currentUserId: string | null | undefined,
  currentUserAvatarUrl: string | undefined,
  remoteParticipants: RemoteCallParticipant[],
): AudioCallMemberTile[] {
  const connectedIds = new Set(remoteParticipants.map((p) => p.participantId));
  const meId = currentUserId?.trim() || db.currentUserId || '';

  if (!isGroup || !('memberIds' in selectedUser)) {
    const peer = selectedUser as User;
    return [
      {
        id: peer.id,
        displayName: peer.displayName || peer.username || 'Contact',
        avatarUrl: peer.avatarUrl,
        connected: phaseConnected(remoteParticipants.length > 0 || connectedIds.has(peer.id)),
      },
    ];
  }

  const group = selectedUser as ChatGroup;
  const ids = Array.from(
    new Set([...(group.memberIds || []), ...remoteParticipants.map((p) => p.participantId)].filter(Boolean)),
  );

  const tiles: AudioCallMemberTile[] = [];
  if (meId) {
    const me = resolveUser(db.users, findUserById(db.users, meId));
    tiles.push({
      id: meId,
      displayName: 'You',
      avatarUrl: currentUserAvatarUrl || me.avatarUrl,
      connected: true,
      isSelf: true,
    });
  }

  for (const id of ids) {
    if (id === meId) continue;
    const user = resolveUser(db.users, findUserById(db.users, id));
    tiles.push({
      id,
      displayName: user.displayName || user.username || id,
      avatarUrl: user.avatarUrl || resolveParticipantAvatar(id),
      connected: connectedIds.has(id),
    });
  }

  return tiles.length ? tiles : tiles;
}

function phaseConnected(hasRemote: boolean): boolean {
  return hasRemote;
}

export function AudioCallStage({
  phase,
  connectPhase,
  isGroup,
  selectedUser,
  currentUserAvatarUrl,
  currentUserId,
  remoteParticipants = [],
  statusLabel,
  error,
  isMicMuted = false,
  onRetryConnect,
}: AudioCallStageProps) {
  const isConnected = phase === 'connected';
  const isConnecting = connectPhase === 'connecting' || connectPhase === 'slow';
  const memberTiles = buildMemberTiles(
    isGroup,
    selectedUser,
    currentUserId,
    currentUserAvatarUrl,
    remoteParticipants,
  );
  const connectedCount = memberTiles.filter((m) => m.connected && !m.isSelf).length;
  const primaryPeer = !isGroup ? memberTiles[0] : null;
  const showActiveWave = isConnected && !isMicMuted;

  return (
    <div className="relative flex flex-1 min-h-0 flex-col items-center justify-center px-4 pb-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.18),transparent_55%)]" />

      {isGroup ? (
        <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-5">
          <div className="text-center">
            <div
              className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-2 ${
                isConnected ? 'border-emerald-400/60' : 'border-white/20'
              }`}
            >
              <img
                src={selectedUser.avatarUrl || undefined}
                alt=""
                className="h-full w-full object-cover"
                onError={handleAvatarError}
              />
            </div>
            <h2 className="text-xl font-bold text-white">{selectedUser.displayName}</h2>
            <p className="mt-1 text-sm text-white/55">
              {connectedCount > 0
                ? `${connectedCount} in call${memberTiles.length > connectedCount + 1 ? ` · ${memberTiles.length - 1} members` : ''}`
                : `${(selectedUser as ChatGroup).memberIds?.length || 0} members`}
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-3 sm:grid-cols-4">
            {memberTiles.map((member) => (
              <div key={member.id} className="flex flex-col items-center gap-1.5">
                <div className="relative">
                  {member.connected && !member.isSelf ? (
                    <span className="absolute -inset-1 rounded-full bg-emerald-400/25 animate-pulse" />
                  ) : null}
                  <div
                    className={`relative h-16 w-16 overflow-hidden rounded-full border-2 ${
                      member.connected
                        ? member.isSelf
                          ? 'border-blue-400/70'
                          : 'border-emerald-400/80'
                        : 'border-white/15 opacity-55'
                    }`}
                  >
                    <img
                      src={member.avatarUrl || undefined}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={handleAvatarError}
                    />
                  </div>
                </div>
                <span className="max-w-[72px] truncate text-[10px] font-semibold text-white/80">
                  {member.displayName}
                </span>
                {member.connected && !member.isSelf ? (
                  <AudioCallWaveBars active={showActiveWave} bars={3} className="h-3" />
                ) : member.isSelf && isMicMuted ? (
                  <span className="text-[9px] font-bold text-red-400">Muted</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 flex flex-col items-center gap-5 text-center"
        >
          <div className="relative">
            {isConnected ? (
              <>
                <span className="absolute -inset-4 rounded-full bg-emerald-400/15 animate-ping" />
                <span className="absolute -inset-2 rounded-full bg-emerald-400/10" />
              </>
            ) : null}
            <div
              className={`relative h-36 w-36 overflow-hidden rounded-full border-4 sm:h-40 sm:w-40 ${
                isConnected ? 'border-emerald-400/70' : 'border-white/20'
              } shadow-2xl`}
            >
              <img
                src={primaryPeer?.avatarUrl || selectedUser.avatarUrl || undefined}
                alt=""
                className="h-full w-full object-cover"
                onError={handleAvatarError}
              />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">
              {primaryPeer?.displayName || selectedUser.displayName}
            </h2>
            <p className="mt-2 flex items-center justify-center gap-2 text-sm text-white/65">
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {statusLabel}
            </p>
            {isConnected ? (
              <div className="mt-4 flex justify-center">
                <AudioCallWaveBars active={showActiveWave} />
              </div>
            ) : null}
          </div>

          {currentUserAvatarUrl ? (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/45 px-2 py-1.5 backdrop-blur-md sm:bottom-8 sm:left-8">
              <img
                src={currentUserAvatarUrl}
                alt="You"
                className={`h-9 w-9 rounded-full object-cover border-2 ${isMicMuted ? 'border-red-400' : 'border-blue-400/70'}`}
                onError={handleAvatarError}
              />
              <span className="text-[11px] font-semibold text-white/80">
                {isMicMuted ? 'You · muted' : 'You'}
              </span>
            </div>
          ) : null}
        </motion.div>
      )}

      {isGroup ? (
        <div className="relative z-10 mt-6 text-center">
          <p className="flex items-center justify-center gap-2 text-sm text-white/65">
            {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {statusLabel}
          </p>
          {isConnected ? (
            <div className="mt-3 flex justify-center">
              <AudioCallWaveBars active={showActiveWave} />
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="relative z-10 mt-4 max-w-xs text-center text-sm text-red-400">{error}</p> : null}
      {(connectPhase === 'slow' || connectPhase === 'failed') && onRetryConnect ? (
        <button
          type="button"
          onClick={onRetryConnect}
          className="relative z-10 mt-4 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Retry connection
        </button>
      ) : null}
    </div>
  );
}
