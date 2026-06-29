import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Pencil, X } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useRoomSettingsNavigateBack } from '../context/RoomFlowContext';
import {
  RoomSettingsDetailRow,
  RoomSettingsGlassCard,
  RoomSettingsHeader,
  RoomSettingsHeroCard,
  RoomSettingsMiniProgressTrack,
  RoomSettingsPill,
  RoomSettingsProgressTrack,
  RoomSettingsScroll,
  RoomSettingsSection,
  RoomSettingsShell,
} from '../components/RoomSettingsShell';
import { ensureRoomSettingsSeeded, getRoomSettings, type RoomSettings } from '../utils/storage';
import { formatRoomRoleLabel } from '../utils/roles';
import { getAppUserId } from '../../lib/appUserId';
import { getRoomExpProgress, type RoomExpProgress } from '../utils/roomExp';
import { getManagedRoomById, getManagedRooms } from '../utils/managedRooms';
import { formatRoomHostMeta, resolveRoomHostDisplay } from '../utils/roomHostDisplay';
import {
  displaySettingValue,
  resolveRoomCoverUrl,
  ensureDemoRoomMediaRegistry,
} from '../utils/roomMedia';
import {
  getPrivilegesForLevel,
  getRoomLevelPrivileges,
  type RoomLevelPrivilege,
} from '../utils/roomLevelPrivileges';
import {
  canEditRoomForUser,
  ensureRoomRoleUserIds,
  resolveEffectiveMemberRole,
} from '../utils/roomRoleUsers';
import {
  resolveCoOwnerMemberIdentity,
  resolveRoleMemberIdentities,
} from '../utils/roomMemberProfile';
import { MemberAvatarStack } from '../components/MemberAvatarStack';
import { RoomOwnerSocialControls } from '../components/RoomOwnerSocialControls';
import { useRoomOwnerSocial } from '../hooks/useRoomOwnerSocial';
import { RoomAnnouncementEditor } from '../components/RoomAnnouncementEditor';

function LevelPrivilegeSheet({
  open,
  onClose,
  currentLevel,
}: {
  open: boolean;
  onClose: () => void;
  currentLevel: number;
}) {
  if (!open) return null;

  const privileges = getRoomLevelPrivileges();
  const active = getPrivilegesForLevel(currentLevel);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Close level privileges"
        onClick={onClose}
      />
      <div className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[24px] border border-border bg-card/90 shadow-2xl backdrop-blur-2xl sm:max-w-md sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <h3 className="text-lg font-bold text-foreground">Level Privileges</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-secondary/60"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-4 scrollbar-hide">
          {active && (
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 backdrop-blur-md">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">
                Current · LV.{currentLevel}
              </p>
              <ul className="mt-2 space-y-1">
                {active.perks.map((perk) => (
                  <li key={perk} className="flex gap-2 text-sm text-foreground">
                    <span className="text-primary">•</span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {privileges.map((entry: RoomLevelPrivilege) => (
            <div
              key={entry.level}
              className={`rounded-2xl border p-4 backdrop-blur-md ${
                entry.level === currentLevel
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border/60 bg-secondary/20'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-extrabold text-foreground">LV.{entry.level}</span>
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  {entry.expRequired.toLocaleString()} EXP
                </span>
              </div>
              <ul className="space-y-1">
                {entry.perks.map((perk) => (
                  <li key={perk} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="text-muted-foreground/60">•</span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const RoomDetails = ({
  roomId: roomIdProp,
  onBack: onBackProp,
  onOpenEdit: onOpenEditProp,
}: {
  roomId?: string;
  onBack?: () => void;
  onOpenEdit?: () => void;
} = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams();
  const roomId = roomIdProp ?? routeId ?? '1181033';
  const navigateSettingsBack = useRoomSettingsNavigateBack();
  const onBack = onBackProp ?? navigateSettingsBack;
  const openEdit =
    onOpenEditProp ??
    (() => {
      if (routeId) {
        navigate(`/room/edit/${routeId}`, { state: location.state });
      }
    });
  const [settings, setSettings] = useState<RoomSettings>(() => getRoomSettings(roomId));
  const managedRoom = getManagedRoomById(roomId);
  const viewerRole = resolveEffectiveMemberRole(settings, getAppUserId(), {
    sessionRole: managedRoom?.role ?? null,
    sessionUserId: getAppUserId(),
  });
  const isAuthorizedToEdit = canEditRoomForUser(settings, getAppUserId(), {
    sessionRole: managedRoom?.role ?? null,
  });
  const [expProgress, setExpProgress] = useState<RoomExpProgress>(() => getRoomExpProgress(roomId));
  const [showLevelPrivileges, setShowLevelPrivileges] = useState(false);
  const [isAnnouncementEditorOpen, setIsAnnouncementEditorOpen] = useState(false);
  const [mediaVersion, setMediaVersion] = useState(0);
  const viewerUserId = getAppUserId();
  const ownerSocial = useRoomOwnerSocial(roomId, settings, viewerUserId);

  const refreshSettings = useCallback(() => {
    getManagedRooms();
    setSettings(ensureRoomRoleUserIds(roomId));
  }, [roomId]);

  const refreshExp = useCallback(() => {
    setExpProgress(getRoomExpProgress(roomId));
  }, [roomId]);

  useEffect(() => {
    refreshSettings();
    refreshExp();
    ensureDemoRoomMediaRegistry();
    setMediaVersion((v) => v + 1);
  }, [refreshSettings, refreshExp, roomId]);

  useEffect(() => {
    const onSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string }>).detail;
      if (!detail?.roomId || detail.roomId === roomId) refreshSettings();
    };
    const onExpUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string }>).detail;
      if (!detail?.roomId || detail.roomId === roomId) refreshExp();
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key.includes(roomId) || event.key === 'roomSettings') {
        refreshSettings();
        refreshExp();
      }
    };

    const onMediaUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string }>).detail;
      if (!detail?.roomId || detail.roomId === roomId) {
        setMediaVersion((v) => v + 1);
      }
    };

    window.addEventListener('room-settings-updated', onSettingsUpdated);
    window.addEventListener('room-exp-updated', onExpUpdated);
    window.addEventListener('managed-rooms-updated', refreshSettings);
    window.addEventListener('room-member-avatars-updated', onMediaUpdated);
    window.addEventListener('room-cover-updated', onMediaUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('room-settings-updated', onSettingsUpdated);
      window.removeEventListener('room-exp-updated', onExpUpdated);
      window.removeEventListener('managed-rooms-updated', refreshSettings);
      window.removeEventListener('room-member-avatars-updated', onMediaUpdated);
      window.removeEventListener('room-cover-updated', onMediaUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [roomId, refreshSettings, refreshExp]);

  const coOwnerIdentity = resolveCoOwnerMemberIdentity(settings, 80);
  const adminMembers = resolveRoleMemberIdentities(settings, 'admin', 80);
  const leadSingerMembers = resolveRoleMemberIdentities(settings, 'leadSinger', 80);
  const coverUrl = resolveRoomCoverUrl(settings.coverPhoto, roomId, settings.roomName);
  const roomTitle = settings.roomName?.trim() || managedRoom?.name || `Room ${roomId}`;
  const announcement = displaySettingValue(
    settings.bulletin,
    displaySettingValue(settings.greetings, 'Welcome to the room!'),
  );
  const ownerHost = resolveRoomHostDisplay(roomId, managedRoom?.hostName);
  const ownerBadgeLabel = `${formatRoomHostMeta(ownerHost)} · Room Owner`;

  return (
    <RoomSettingsShell>
      <RoomSettingsHeader
        title="Room Details"
        onBack={onBack}
        rightAction={
          isAuthorizedToEdit ? (
            <button
              type="button"
              onClick={openEdit}
              title={`Edit room (${formatRoomRoleLabel(viewerRole)})`}
              aria-label={`Edit room as ${formatRoomRoleLabel(viewerRole)}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/60 text-muted-foreground backdrop-blur-md transition hover:bg-secondary/80 hover:text-foreground"
            >
              <Pencil size={18} />
            </button>
          ) : undefined
        }
      />

      <RoomSettingsScroll>
        <RoomSettingsHeroCard>
          <div className="relative z-10 mb-5 flex items-start space-x-4">
            <div className="relative shrink-0">
              <img
                key={`cover-${mediaVersion}`}
                src={coverUrl}
                className="h-[84px] w-[84px] rounded-[18px] border-2 border-border object-cover shadow-md"
                alt={`${roomTitle} cover`}
              />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="break-words text-xl font-extrabold uppercase leading-tight tracking-tight text-foreground">
                {roomTitle}
              </h2>
              <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground opacity-80">
                ID:{settings.roomId || roomId}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <RoomSettingsPill>
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary text-[10px] text-primary-foreground">
                    🏠
                  </div>
                  <span className="truncate text-[10px] font-extrabold uppercase tracking-tight text-primary">
                    {ownerBadgeLabel}
                  </span>
                </RoomSettingsPill>
                <div className="inline-flex rounded-2xl bg-black/90 px-1 py-1 backdrop-blur-md">
                  <RoomOwnerSocialControls
                    name={ownerSocial.ownerIdentity.name}
                    avatarUrl={ownerSocial.ownerIdentity.avatarUrl}
                    starCount={ownerSocial.starCount}
                    isFollowing={ownerSocial.isFollowingOwner}
                    onToggleFollow={ownerSocial.toggleFollowOwner}
                    showFollowButton={!ownerSocial.isSelfOwner}
                    nameMaxLength={16}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowLevelPrivileges(true)}
              className="flex shrink-0 items-center self-center rounded-full bg-primary px-3 py-1.5 text-[10px] font-bold text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              Level Privilege <ChevronRight size={12} className="ml-0.5" />
            </button>
          </div>

          <div className="relative z-10 space-y-4">
            <div>
              <div className="mb-2 flex items-end justify-between text-[11px] font-extrabold uppercase tracking-wide text-foreground">
                <span>
                  LV.{expProgress.level}{' '}
                  <span className="font-bold normal-case text-muted-foreground opacity-70">
                    {' '}
                    / Room EXP
                  </span>
                </span>
                <span className="text-primary">LV.{expProgress.nextLevel}</span>
              </div>
              <RoomSettingsProgressTrack
                value={expProgress.levelProgressPercent}
                className="bg-primary"
              />
              <div className="mt-1.5 flex justify-end">
                <span className="text-[10px] font-bold tracking-tight text-muted-foreground">
                  {expProgress.expInLevel}/{expProgress.expToNextLevel}
                </span>
              </div>
            </div>

            <div className="pt-1">
              <div className="mb-2 flex justify-between text-[11px] font-extrabold uppercase tracking-wide text-foreground">
                <span>Today&apos;s EXP</span>
                <span className="font-extrabold normal-case text-muted-foreground">
                  {expProgress.todayExp}/{expProgress.dailyCap}
                  {expProgress.todayOverDailyTarget ? '+' : ''}
                </span>
              </div>
              <RoomSettingsProgressTrack
                value={Math.min(100, (expProgress.todayExp / expProgress.dailyCap) * 100)}
                className="bg-sky-400"
              />
              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[8px] font-bold">
                    <span className="flex items-center gap-1 uppercase tracking-tighter text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-[#63e6be]" />
                      Empty room (1 EXP/s)
                    </span>
                    <span className="text-muted-foreground">
                      {expProgress.todayEmptyRoomFreeExp}/{expProgress.dailyEmptyRoomFreeCap}
                    </span>
                  </div>
                  <RoomSettingsMiniProgressTrack
                    value={
                      (expProgress.todayEmptyRoomFreeExp / expProgress.dailyEmptyRoomFreeCap) * 100
                    }
                    className="bg-[#63e6be]"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[8px] font-bold">
                    <span className="flex items-center gap-1 uppercase tracking-tighter text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-[#38d9a9]" />
                      Seated guests (1 EXP/s)
                    </span>
                    <span className="text-muted-foreground">
                      {expProgress.todaySeatedFreeExp}/{expProgress.dailySeatedFreeCap}
                    </span>
                  </div>
                  <RoomSettingsMiniProgressTrack
                    value={
                      (expProgress.todaySeatedFreeExp / expProgress.dailySeatedFreeCap) * 100
                    }
                    className="bg-[#38d9a9]"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[8px] font-bold">
                    <span className="flex items-center gap-1 uppercase tracking-tighter text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-[#fcc419]" />
                      Gold (gifts)
                    </span>
                    <span className="text-muted-foreground">
                      {expProgress.todayGoldExp}/{expProgress.dailyGoldCap}
                      {expProgress.todayGoldExp > expProgress.dailyGoldCap ? '+' : ''}
                    </span>
                  </div>
                  <RoomSettingsMiniProgressTrack
                    value={(expProgress.todayGoldExp / expProgress.dailyGoldCap) * 100}
                    className="bg-[#fcc419]"
                  />
                </div>
              </div>
            </div>
          </div>
        </RoomSettingsHeroCard>

        <RoomSettingsSection title="Room Announcement">
          <RoomSettingsGlassCard className="p-4">
            <button
              type="button"
              disabled={!isAuthorizedToEdit}
              onClick={() => isAuthorizedToEdit && setIsAnnouncementEditorOpen(true)}
              className={`flex w-full items-center space-x-3 text-left text-sm ${
                isAuthorizedToEdit
                  ? 'cursor-pointer rounded-xl transition hover:bg-secondary/30'
                  : 'cursor-default'
              }`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                <span className="text-xl text-emerald-500">❇️</span>
              </div>
              <span className="min-w-0 flex-1 font-medium text-foreground">{announcement}</span>
              {isAuthorizedToEdit ? (
                <Pencil size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : null}
            </button>
          </RoomSettingsGlassCard>
        </RoomSettingsSection>

        <RoomSettingsSection title="Room Admin">
          <RoomSettingsGlassCard>
            <RoomSettingsDetailRow
              label="Owner"
              subtitle={ownerSocial.ownerIdentity.name}
              value={
                <img
                  key={`owner-${mediaVersion}`}
                  src={ownerSocial.ownerIdentity.avatarUrl}
                  className="h-10 w-10 rounded-full border-2 border-border object-cover shadow-sm"
                  alt={ownerSocial.ownerIdentity.name}
                />
              }
              hasArrow={false}
            />
            <RoomSettingsDetailRow
              label="Co-owner"
              subtitle={coOwnerIdentity?.name}
              value={
                coOwnerIdentity ? (
                  <img
                    key={`coowner-${mediaVersion}`}
                    src={coOwnerIdentity.avatarUrl}
                    className="h-10 w-10 rounded-full border-2 border-border object-cover shadow-sm"
                    alt={coOwnerIdentity.name}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Not set</span>
                )
              }
              hasArrow={false}
            />
            <RoomSettingsDetailRow
              label="Admin"
              subtitle={
                adminMembers.length > 0
                  ? adminMembers.map((member) => member.name).join(', ')
                  : undefined
              }
              value={
                <MemberAvatarStack
                  members={adminMembers.map((member) => ({
                    userId: member.userId,
                    name: member.name,
                  }))}
                  roomId={roomId}
                  mediaVersion={mediaVersion}
                />
              }
              hasArrow={false}
            />
            <RoomSettingsDetailRow
              label="Lead Singer"
              subtitle={
                leadSingerMembers.length > 0
                  ? leadSingerMembers.map((member) => member.name).join(', ')
                  : undefined
              }
              value={
                leadSingerMembers.length > 0 ? (
                  <MemberAvatarStack
                    members={leadSingerMembers.map((member) => ({
                      userId: member.userId,
                      name: member.name,
                    }))}
                    roomId={roomId}
                    mediaVersion={mediaVersion}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Not set</span>
                )
              }
              hasArrow={false}
            />
          </RoomSettingsGlassCard>
        </RoomSettingsSection>
      </RoomSettingsScroll>

      <LevelPrivilegeSheet
        open={showLevelPrivileges}
        onClose={() => setShowLevelPrivileges(false)}
        currentLevel={expProgress.level}
      />

      <RoomAnnouncementEditor
        open={isAnnouncementEditorOpen}
        onClose={() => setIsAnnouncementEditorOpen(false)}
        roomId={roomId}
        settings={settings}
        onSaved={() => refreshSettings()}
      />
    </RoomSettingsShell>
  );
};

export { RoomDetails as RoomDetailsScreen };
export default RoomDetails;
