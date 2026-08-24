import { useMemo, useState } from 'react';
import { MicOff, Signal } from 'lucide-react';
import type { RemoteCallParticipant, RemoteCallVideo } from '../../lib/chat/chatCallKit';
import { db } from '../../lib/db/localDb';
import { findUserById, resolveUser } from '../../lib/safe';
import { handleAvatarError } from '../../lib/utils';
import { CallVideoSurface } from './CallVideoSurface';
import { VerifiedMark } from './CallApprovedChrome';

const PAGE_SIZE = 9;

type GroupVideoCallStageProps = {
  remoteVideos: RemoteCallVideo[];
  remoteParticipants?: RemoteCallParticipant[];
  localStream?: MediaStream | null;
  currentUserId?: string | null;
  currentUserAvatarUrl?: string;
  groupMemberIds?: string[];
  hostUserId?: string | null;
  localLabel?: string;
};

type GroupTile = {
  id: string;
  name: string;
  avatarUrl?: string;
  stream?: MediaStream | null;
  mirrored?: boolean;
  muted: boolean;
  isLocal?: boolean;
};

export function GroupVideoCallStage({
  remoteVideos,
  remoteParticipants = [],
  localStream = null,
  currentUserId,
  currentUserAvatarUrl,
  groupMemberIds = [],
  hostUserId = null,
  localLabel = 'You',
}: GroupVideoCallStageProps) {
  const [page, setPage] = useState(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const tiles = useMemo<GroupTile[]>(() => {
    const videoMap = new Map(remoteVideos.map((video) => [video.participantId, video]));
    const participantMap = new Map(remoteParticipants.map((participant) => [participant.participantId, participant]));
    const meId = currentUserId || db.currentUserId || '__local__';
    const ordered = Array.from(
      new Set([
        ...groupMemberIds,
        ...remoteParticipants.map((participant) => participant.participantId),
        ...remoteVideos.map((video) => video.participantId),
      ].filter(Boolean)),
    ).filter((id) => id !== meId);

    const localUser = currentUserId ? resolveUser(db.users, findUserById(db.users, currentUserId)) : null;
    const result: GroupTile[] = [
      {
        id: meId,
        name: localUser?.displayName || localUser?.username || localLabel,
        avatarUrl: currentUserAvatarUrl || localUser?.avatarUrl,
        stream: localStream,
        mirrored: true,
        muted: false,
        isLocal: true,
      },
    ];

    for (const id of ordered) {
      const video = videoMap.get(id);
      const participant = participantMap.get(id);
      const user = resolveUser(db.users, findUserById(db.users, id));
      result.push({
        id,
        name: user.displayName || user.username || participant?.participantName || video?.participantName || id,
        avatarUrl: user.avatarUrl,
        stream: video?.stream,
        mirrored: false,
        muted: participant ? !participant.hasAudio : false,
      });
    }
    return result;
  }, [currentUserAvatarUrl, currentUserId, groupMemberIds, localLabel, localStream, remoteParticipants, remoteVideos]);

  const maxPage = Math.max(0, Math.ceil(tiles.length / PAGE_SIZE) - 1);
  const safePage = Math.min(page, maxPage);
  const visible = tiles.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const focused = focusedId ? tiles.find((tile) => tile.id === focusedId) || null : null;

  if (focused) {
    return (
      <div className="relative h-full min-h-[300px] overflow-hidden rounded-2xl border border-white/10 bg-black" data-ui-id="call.group.video.focus">
        {focused.stream ? (
          <CallVideoSurface stream={focused.stream} mirrored={focused.mirrored} layout="fill" label={`${focused.name} camera`} />
        ) : (
          <img src={focused.avatarUrl || undefined} alt={focused.name} className="h-full w-full object-cover" onError={handleAvatarError} />
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
          <span className="flex items-center gap-2 text-sm font-semibold">{focused.name}<VerifiedMark className="!h-[15px] !w-[15px]" /></span>
          <button type="button" onClick={() => setFocusedId(null)} className="rounded-full bg-black/55 px-3 py-1.5 text-xs text-white backdrop-blur-md">Grid view</button>
        </div>
      </div>
    );
  }

  return (
    <div data-ui-id="call.group.video.grid">
      <div className="call-approved-group-grid">
        {visible.map((tile, index) => (
          <button
            key={tile.id}
            type="button"
            className="call-approved-group-tile text-left"
            onClick={() => setFocusedId(tile.id)}
            aria-label={`Focus ${tile.name}`}
          >
            {tile.stream ? (
              <CallVideoSurface stream={tile.stream} mirrored={tile.mirrored} layout="fill" label={`${tile.name} camera`} />
            ) : (
              <img src={tile.avatarUrl || undefined} alt={tile.name} onError={handleAvatarError} />
            )}
            {tile.id === hostUserId ? <span className="host-tag">Host</span> : null}
            {tile.muted ? <span className="tile-mic"><MicOff className="h-3.5 w-3.5" /></span> : null}
            <span className="tile-name">{tile.name}<VerifiedMark className="!h-[14px] !w-[14px]" /></span>
            <span className="tile-bars"><Signal className="h-4 w-4" /></span>
          </button>
        ))}
      </div>
      {maxPage > 0 ? (
        <div className="mt-2 flex justify-center gap-1.5" aria-label="Participant pages">
          {Array.from({ length: maxPage + 1 }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setPage(index)}
              className={`h-2 rounded-full transition-all ${safePage === index ? 'w-6 bg-violet-500' : 'w-2 bg-white/25'}`}
              aria-label={`Participant page ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
