import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crown, Mic2, Shield, User, UserMinus, UserPlus, UserX } from 'lucide-react';
import { ShareIcon } from '../../components/common/ShareIcon';
import { ShareModal } from '../../components/feed/ShareModal';
import type { ProfileSharePayload } from '../../lib/profileShare';
import { buildContextualProfileSharePayload } from '../../lib/profileShare';
import { KaraokeProfileBackground } from '../../components/karaoke/KaraokeProfileBackground';
import { FollowListModal } from '../../components/profile/FollowListModal';
import { CreatorProgressModal } from '../../components/profile/CreatorProgressModal';
import { useDbRevision } from '../../lib/useDB';
import { useProfileStats } from '../../lib/useProfileStats';
import { listKaraokeCoverRecordingsForUser } from '../../lib/karaokeRecordings';
import type { RoomProfilePreview } from '../utils/roomProfilePreview';
import { openAppProfileFromPartyRoom, openKaraokeProfileFromPartyRoom } from '../utils/roomProfileNavigate';
import { canOpenKnownAppProfile, isKaraokeProfileSurface } from '../../lib/profileSurface';
import { getPartyRoomProfilePreviewPortal } from '../utils/roomProfilePreviewPortal';

type RoomProfilePreviewModalProps = {
  preview: RoomProfilePreview;
  onClose: () => void;
  onToggleFollow: () => void;
  onMention?: () => void;
  onKick?: () => void;
  showKick?: boolean;
};

function StatButton({
  value,
  label,
  disabled,
  onClick,
  valueClassName = 'text-xs font-black text-white',
}: {
  value: string;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  valueClassName?: string;
}) {
  const body = (
    <>
      <div className={valueClassName}>{value}</div>
      <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{label}</div>
    </>
  );

  if (disabled || !onClick) {
    return <div className="opacity-80">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-1 py-0.5 transition hover:bg-white/10 active:scale-95 cursor-pointer"
    >
      {body}
    </button>
  );
}

export function RoomProfilePreviewModal({
  preview,
  onClose,
  onToggleFollow,
  onMention,
  onKick,
  showKick = false,
}: RoomProfilePreviewModalProps) {
  useDbRevision();
  const [mounted, setMounted] = useState(false);
  const profileUserId = preview.resolvedUserId;
  const canOpenProfiles = canOpenKnownAppProfile({
    userId: profileUserId ?? preview.id,
    displayName: preview.displayName,
    username: preview.handle.replace(/^@/, '') || undefined,
    isSelf: preview.isSelf,
  });
  const canOpenLists = Boolean(profileUserId);
  const [followListMode, setFollowListMode] = useState<'followers' | 'following' | null>(null);
  const [showCreatorProgress, setShowCreatorProgress] = useState(false);
  const [profileShareModal, setProfileShareModal] = useState<ProfileSharePayload | null>(null);

  const { followerCount, followingCount, creatorProgress } = useProfileStats(
    profileUserId ? { id: profileUserId } : null,
    profileUserId,
  );

  const recordingCount = useMemo(() => {
    if (!profileUserId) return 0;
    return listKaraokeCoverRecordingsForUser(profileUserId).length;
  }, [profileUserId]);

  const level = profileUserId ? creatorProgress.level : preview.level;
  const onKaraokeSurface = isKaraokeProfileSurface();

  const dismissPreview = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleBackdropPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dismissPreview();
    },
    [dismissPreview],
  );

  const openRecordings = () => {
    if (!canOpenProfiles) return;
    dismissPreview();
    openKaraokeProfileFromPartyRoom({
      userId: profileUserId,
      displayName: preview.displayName,
      username: preview.handle.replace(/^@/, '') || undefined,
      profileTab: 'covers',
      isSelf: preview.isSelf,
    });
  };

  const openMainProfile = () => {
    if (!canOpenProfiles) return;
    dismissPreview();
    openAppProfileFromPartyRoom(
      profileUserId,
      preview.isSelf,
      preview.displayName,
      preview.handle.replace(/^@/, '') || undefined,
    );
  };

  const openKStarProfile = () => {
    if (!canOpenProfiles) return;
    dismissPreview();
    openKaraokeProfileFromPartyRoom({
      userId: profileUserId,
      displayName: preview.displayName,
      username: preview.handle.replace(/^@/, '') || undefined,
      isSelf: preview.isSelf,
    });
  };

  const openProfileShareModal = () => {
    if (!profileUserId && !preview.handle) return;
    setProfileShareModal(
      buildContextualProfileSharePayload({
        user: {
          id: profileUserId ?? preview.id,
          username: preview.handle.replace(/^@/, ''),
          displayName: preview.displayName,
          handle: preview.handle,
        },
        isSelf: preview.isSelf,
        surface: onKaraokeSurface ? 'karaoke' : 'app',
      }),
    );
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissPreview();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismissPreview]);

  if (!mounted) return null;

  const portalTarget = getPartyRoomProfilePreviewPortal();

  return createPortal(
    <div
      className="karaoke-room-profile-preview pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in text-gray-100"
      role="dialog"
      aria-modal="true"
      aria-label={`${preview.displayName} profile preview`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        aria-label="Close profile preview"
        onPointerDown={handleBackdropPointerDown}
      />
      <div
        className="pointer-events-auto relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-sm animate-scale-in flex-col overflow-hidden rounded-[28px] border border-purple-500/30 bg-[#1c1130] shadow-[0_0_50px_rgba(168,85,247,0.35)]"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <KaraokeProfileBackground
          url={preview.backgroundUrl}
          mediaId={preview.backgroundMediaId}
          mimeType={preview.backgroundMimeType}
          mediaKind={preview.backgroundMediaKind}
          focus={preview.backgroundFocus}
          className="relative h-44 sm:h-48 shrink-0 overflow-hidden"
          overlayClassName="absolute inset-0 bg-gradient-to-t from-[#1c1130] via-[#1c1130]/35 via-[58%] to-black/15"
        >
          {profileUserId || preview.handle ? (
            <div className="pointer-events-auto absolute top-3 right-3 z-20">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openProfileShareModal();
                }}
                className="group cursor-pointer rounded-full border border-white/20 bg-black/55 p-2 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70 active:scale-90"
                title="Share profile"
                aria-label="Share profile"
              >
                <ShareIcon size="room" tone="inherit" className="text-current group-hover:text-white" />
              </button>
            </div>
          ) : null}
        </KaraokeProfileBackground>

        <div className="relative z-10 -mt-16 sm:-mt-20 flex flex-col items-center px-6 text-center">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={openMainProfile}
              disabled={!canOpenProfiles}
              className={`rounded-full ${canOpenProfiles ? 'cursor-pointer transition hover:ring-2 hover:ring-purple-400/60' : 'cursor-default'}`}
            >
              <img
                src={preview.avatar}
                alt={preview.displayName}
                className="h-24 w-24 rounded-full border-[4px] border-[#1c1130] object-cover shadow-[0_4px_15px_rgba(0,0,0,0.5)] sm:h-28 sm:w-28"
              />
            </button>
            <button
              type="button"
              onClick={() => canOpenLists && setShowCreatorProgress(true)}
              disabled={!canOpenLists}
              className={`absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#1c1130] bg-purple-600 text-[9px] font-black text-white shadow-lg ${
                canOpenLists ? 'cursor-pointer hover:bg-purple-500' : 'cursor-default'
              }`}
              title={canOpenLists ? 'Creator level' : undefined}
            >
              {level}
            </button>
          </div>

          <h3 className="mt-3 flex flex-wrap items-center justify-center space-x-1.5 text-base font-black text-white">
            <span>{preview.displayName}</span>
            {preview.isOwner ? (
              <span className="flex items-center space-x-0.5 rounded bg-gradient-to-r from-purple-600 to-pink-500 px-1.5 py-0.5 text-[8px] font-bold text-white shadow">
                <Crown size={8} /> <span>Owner</span>
              </span>
            ) : null}
            {preview.isCoOwner ? (
              <span className="flex items-center space-x-0.5 rounded border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold text-amber-300 shadow">
                <Crown size={8} /> <span>Co-owner</span>
              </span>
            ) : null}
            {preview.isAdmin ? (
              <span className="flex items-center space-x-0.5 rounded border border-yellow-500/30 bg-yellow-500/20 px-1.5 py-0.5 text-[8px] font-bold text-yellow-400 shadow">
                <Shield size={8} /> <span>Admin</span>
              </span>
            ) : null}
          </h3>
          {preview.showHandle ? (
            <p className="mt-0.5 text-[10px] font-semibold text-gray-400">{preview.handle}</p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-3">
          <div className="grid w-full grid-cols-3 gap-2 rounded-2xl border border-white/5 bg-black/35 p-3">
            <StatButton
              value={recordingCount.toLocaleString()}
              label="Recordings"
              disabled={!canOpenLists}
              onClick={openRecordings}
            />
            <StatButton
              value={followerCount.toLocaleString()}
              label="Followers"
              valueClassName="text-sm font-black text-white"
              disabled={!canOpenLists}
              onClick={() => setFollowListMode('followers')}
            />
            <StatButton
              value={followingCount.toLocaleString()}
              label="Following"
              valueClassName="text-sm font-black text-white"
              disabled={!canOpenLists}
              onClick={() => setFollowListMode('following')}
            />
          </div>

          <p className="mt-3 min-h-[48px] w-full rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left text-xs font-medium leading-relaxed text-gray-300">
            {preview.bio || 'No bio yet.'}
          </p>

          <div className="mt-4 flex w-full flex-col gap-2.5">
            {!preview.isSelf ? (
              <button
                type="button"
                onClick={onToggleFollow}
                className={`flex w-full cursor-pointer items-center justify-center space-x-1.5 rounded-full py-2 text-xs font-bold transition active:scale-95 ${
                  preview.isFollowing
                    ? 'border border-white/10 bg-white/10 text-gray-300'
                    : 'bg-[#FF3B70] text-white shadow-lg shadow-pink-500/15 hover:bg-pink-500'
                }`}
              >
                {preview.isFollowing ? <UserMinus size={12} /> : <UserPlus size={12} />}
                <span>{preview.isFollowing ? 'Following' : 'Follow'}</span>
              </button>
            ) : null}

            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={openMainProfile}
                disabled={!canOpenProfiles}
                className="flex flex-1 cursor-pointer items-center justify-center space-x-1 rounded-full border border-white/10 bg-white/10 py-2 text-xs font-bold text-gray-100 transition hover:bg-white/15 active:scale-95 disabled:cursor-default disabled:opacity-50"
              >
                <User size={12} />
                <span>InstaCollab</span>
              </button>
              <button
                type="button"
                onClick={openKStarProfile}
                disabled={!canOpenProfiles}
                className="flex flex-1 cursor-pointer items-center justify-center space-x-1 rounded-full bg-purple-600 py-2 text-xs font-bold text-white shadow-lg shadow-purple-600/15 transition hover:bg-purple-500 active:scale-95 disabled:cursor-default disabled:opacity-50"
              >
                <Mic2 size={12} />
                <span>K-Star</span>
              </button>
            </div>
          </div>

          {!preview.isSelf && onMention ? (
            <button
              type="button"
              onClick={onMention}
              className="mt-3 flex w-full cursor-pointer items-center justify-center space-x-1.5 rounded-full border border-blue-400/20 bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-xs font-black text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02] active:scale-95"
            >
              <span className="text-sm font-extrabold text-yellow-300">@</span>
              <span>Mention in Chat Input</span>
            </button>
          ) : null}

          {showKick && onKick ? (
            <button
              type="button"
              onClick={onKick}
              className="mt-3 flex w-full cursor-pointer items-center justify-center space-x-1.5 rounded-full border border-red-500/20 bg-gradient-to-r from-red-600 to-red-700 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-500/20 transition hover:from-red-500 hover:to-red-600 active:scale-95"
            >
              <UserX size={13} />
              <span>Kick User from Room</span>
            </button>
          ) : null}
        </div>
      </div>

      {followListMode && profileUserId ? (
        <FollowListModal
          profileUserId={profileUserId}
          mode={followListMode}
          onClose={() => setFollowListMode(null)}
        />
      ) : null}

      {showCreatorProgress && profileUserId ? (
        <CreatorProgressModal
          progress={creatorProgress}
          username={preview.displayName}
          onClose={() => setShowCreatorProgress(false)}
        />
      ) : null}

      <ShareModal
        isOpen={Boolean(profileShareModal)}
        onClose={() => setProfileShareModal(null)}
        shareUrl={profileShareModal?.shareUrl ?? ''}
        itemTitle={profileShareModal?.itemTitle ?? 'Share Profile'}
        shareText={profileShareModal?.shareText ?? 'Shared a profile'}
        kind={profileShareModal?.kind ?? 'profile'}
        notificationText={profileShareModal?.notificationText}
      />
    </div>,
    portalTarget,
  );
}
