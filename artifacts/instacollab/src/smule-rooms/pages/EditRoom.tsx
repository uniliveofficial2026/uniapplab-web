import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ensureRoomSettingsSeeded,
  getRoomSettings,
  saveRoomSettings,
  type RoomMode,
  type RoomSettings,
} from '../utils/storage';
import { getAppUserId } from '../../lib/appUserId';
import { formatRoomModeLabel, getManagedRoomById, getManagedRooms, syncManagedRoomFromActiveSession, upsertManagedRoom } from '../utils/managedRooms';
import { useRoomSettingsNavigateBack } from '../context/RoomFlowContext';
import type { RoomSettingsNavState } from '../context/roomFlowContextCore';
import { normalizeRoomRole } from '../utils/roles';
import { formatRoomPrivacyLabel, resolveRoomPrivacy, resolveRoomKey, roomPrivacyPatch, verifyRoomKey } from '../utils/roomPrivacy';
import {
  ensureDemoRoomMediaRegistry,
  formatSettingPreview,
  isPlaceholderSetting,
  resolveRoomCoverUrl,
  setRoomCoverPhoto,
} from '../utils/roomMedia';
import {
  canEditRoomForUser,
  ensureRoomRoleUserIds,
} from '../utils/roomRoleUsers';
import {
  resolveCoOwnerMemberIdentity,
  resolveRoleMemberIdentities,
} from '../utils/roomMemberProfile';
import { formatRoomBackgroundLabel } from '../utils/roomBackground';
import {
  RoomSettingsBackgroundEditor,
  RoomSettingsCoverEditor,
  RoomSettingsOptionPicker,
  RoomSettingsTextEditor,
} from '../components/RoomSettingsEditors';
import { RoomModeSettingsSheet } from '../components/RoomModeSettingsSheet';
import { MemberAvatarStack } from '../components/MemberAvatarStack';
import { RoomOwnerSocialControls } from '../components/RoomOwnerSocialControls';
import { useRoomOwnerSocial } from '../hooks/useRoomOwnerSocial';
import {
  RoomSettingsEditRow,
  RoomSettingsGlassCard,
  RoomSettingsHeader,
  RoomSettingsScroll,
  RoomSettingsSection,
  RoomSettingsShell,
} from '../components/RoomSettingsShell';

type TextEditorState = {
  kind: 'text';
  key: keyof RoomSettings;
  title: string;
  multiline?: boolean;
  placeholder?: string;
};

type OptionEditorState = {
  kind: 'options';
  key: keyof RoomSettings;
  title: string;
  options: string[];
  formatOptionLabel?: (option: string) => string;
};

type EditorState =
  | TextEditorState
  | OptionEditorState
  | { kind: 'roomMode' }
  | { kind: 'cover' }
  | { kind: 'background' }
  | null;

function readSettingText(value: string | undefined, fallback = ''): string {
  return isPlaceholderSetting(value) ? fallback : value!.trim();
}

const EditRoom = ({
  roomId: roomIdProp,
  onBack: onBackProp,
  embedded = false,
}: {
  roomId?: string;
  onBack?: () => void;
  embedded?: boolean;
} = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams();
  const roomId = roomIdProp ?? routeId ?? getRoomSettings().roomId;
  const navigateSettingsBack = useRoomSettingsNavigateBack();
  const onBack = onBackProp ?? navigateSettingsBack;
  const [settings, setSettings] = useState<RoomSettings>(() =>
    ensureRoomSettingsSeeded(roomId),
  );
  const managedRoom = getManagedRoomById(roomId);
  const sessionRole =
    managedRoom?.role ??
    normalizeRoomRole(localStorage.getItem('currentUserRole') || 'user');
  const isAuthorized = canEditRoomForUser(settings, getAppUserId(), {
    sessionRole: sessionRole === 'user' ? null : sessionRole,
  });
  const [editor, setEditor] = useState<EditorState>(null);
  const [mediaVersion, setMediaVersion] = useState(0);

  const refreshSettings = useCallback(() => {
    getManagedRooms();
    ensureDemoRoomMediaRegistry();
    setSettings(ensureRoomRoleUserIds(roomId));
    setMediaVersion((version) => version + 1);
  }, [roomId]);

  const persistField = useCallback(
    (key: keyof RoomSettings, value: string) => {
      saveRoomSettings(roomId, { [key]: value } as Partial<RoomSettings>);
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        const managed = getManagedRoomById(roomId);
        if (managed) {
          upsertManagedRoom({
            ...managed,
            name: next.roomName?.trim() || managed.name,
            roomMode: (next.roomMode ?? managed.roomMode) as RoomMode,
            hostName: managed.hostName ?? next.owner,
          });
        }
        return next;
      });
    },
    [roomId],
  );

  useEffect(() => {
    if (!isAuthorized && routeId && !embedded) {
      navigate(`/room/details/${routeId}`, {
        replace: true,
        state: location.state as RoomSettingsNavState | undefined,
      });
    }
  }, [isAuthorized, routeId, embedded, navigate, location.state]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    const onSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string }>).detail;
      if (!detail?.roomId || detail.roomId === roomId) {
        refreshSettings();
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key.includes(roomId) || event.key === 'roomSettings') {
        refreshSettings();
      }
    };

    window.addEventListener('room-settings-updated', onSettingsUpdated);
    window.addEventListener('managed-rooms-updated', refreshSettings);
    window.addEventListener('room-cover-updated', onSettingsUpdated);
    window.addEventListener('room-member-avatars-updated', onSettingsUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('room-settings-updated', onSettingsUpdated);
      window.removeEventListener('managed-rooms-updated', refreshSettings);
      window.removeEventListener('room-cover-updated', onSettingsUpdated);
      window.removeEventListener('room-member-avatars-updated', onSettingsUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [roomId, refreshSettings]);

  const viewerUserId = getAppUserId();
  const ownerSocial = useRoomOwnerSocial(roomId, settings, viewerUserId);

  if (!isAuthorized) {
    if (embedded) {
      return (
        <RoomSettingsShell>
          <RoomSettingsHeader title="Edit the room" onBack={onBack} />
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            You don&apos;t have permission to edit this room.
          </div>
        </RoomSettingsShell>
      );
    }
    return null;
  }

  const coOwnerIdentity = resolveCoOwnerMemberIdentity(settings, 64);
  const adminMembers = resolveRoleMemberIdentities(settings, 'admin', 64);
  const leadSingerMembers = resolveRoleMemberIdentities(settings, 'leadSinger', 64);
  const coverUrl = resolveRoomCoverUrl(settings.coverPhoto, roomId, settings.roomName);
  const roomTitle = settings.roomName?.trim() || managedRoom?.name || `Room ${roomId}`;

  const openTextEditor = (
    key: keyof RoomSettings,
    title: string,
    options?: { multiline?: boolean; placeholder?: string },
  ) => {
    setEditor({
      kind: 'text',
      key,
      title,
      multiline: options?.multiline,
      placeholder: options?.placeholder,
    });
  };

  const openOptionEditor = (
    key: keyof RoomSettings,
    title: string,
    options: string[],
    formatOptionLabel?: (option: string) => string,
  ) => {
    setEditor({ kind: 'options', key, title, options, formatOptionLabel });
  };

  const handleCoverUrlSave = (url: string) => {
    persistField('coverPhoto', url);
    if (url.startsWith('http')) {
      setRoomCoverPhoto(roomId, url);
    }
  };

  const handleCoverFileSave = (dataUrl: string) => {
    persistField('coverPhoto', dataUrl);
  };

  return (
    <RoomSettingsShell>
      <RoomSettingsHeader title={roomTitle} subtitle="Edit the room" onBack={onBack} />

      <RoomSettingsScroll>
        <RoomSettingsSection title="Basic Information">
          <RoomSettingsGlassCard>
            <RoomSettingsEditRow
              label="Room Name"
              value={roomTitle}
              onClick={() =>
                openTextEditor('roomName', 'Room Name', {
                  placeholder: 'Display name for this room',
                })
              }
            />
            <RoomSettingsEditRow
              label="Cover Photo"
              value={
                <img
                  src={coverUrl}
                  className="h-8 w-8 rounded-full border border-border object-cover"
                  alt="Cover"
                />
              }
              onClick={() => setEditor({ kind: 'cover' })}
            />
            <RoomSettingsEditRow
              label="Background"
              value={formatRoomBackgroundLabel(settings.background)}
              onClick={() => setEditor({ kind: 'background' })}
            />
            <RoomSettingsEditRow
              label="Bulletin"
              value={formatSettingPreview(settings.bulletin, 'No bulletin set')}
              onClick={() =>
                openTextEditor('bulletin', 'Bulletin', {
                  multiline: true,
                  placeholder: 'Room announcement shown to guests',
                })
              }
            />
            <RoomSettingsEditRow
              label="Greetings"
              value={formatSettingPreview(settings.greetings, 'No greeting set')}
              onClick={() =>
                openTextEditor('greetings', 'Greetings', {
                  multiline: true,
                  placeholder: 'Welcome message for new guests',
                })
              }
            />
            <RoomSettingsEditRow
              label="Room Mode"
              value={`${formatRoomModeLabel(settings.roomMode)} · ${formatRoomPrivacyLabel(resolveRoomPrivacy(settings))}`}
              onClick={() => setEditor({ kind: 'roomMode' })}
            />
          </RoomSettingsGlassCard>
        </RoomSettingsSection>

        <RoomSettingsSection title="Room Admin">
          <RoomSettingsGlassCard>
            <RoomSettingsEditRow
              label="Owner"
              value={
                <div className="inline-flex rounded-2xl bg-black/90 px-1 py-1 backdrop-blur-md">
                  <RoomOwnerSocialControls
                    name={ownerSocial.ownerIdentity.name}
                    avatarUrl={ownerSocial.ownerIdentity.avatarUrl}
                    starCount={ownerSocial.starCount}
                    isFollowing={ownerSocial.isFollowingOwner}
                    onToggleFollow={ownerSocial.toggleFollowOwner}
                    showFollowButton={!ownerSocial.isSelfOwner}
                    nameMaxLength={12}
                  />
                </div>
              }
              onClick={() => openTextEditor('owner', 'Owner')}
            />
            <RoomSettingsEditRow
              label="Co-owner"
              value={
                coOwnerIdentity ? (
                  <span className="flex max-w-[11rem] items-center gap-2">
                    <img
                      src={coOwnerIdentity.avatarUrl}
                      className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
                      alt={coOwnerIdentity.name}
                    />
                    <span className="truncate text-sm text-foreground">{coOwnerIdentity.name}</span>
                  </span>
                ) : (
                  'Not set'
                )
              }
              onClick={() => openTextEditor('coOwner', 'Co-owner', { placeholder: 'Username' })}
            />
            <RoomSettingsEditRow
              label="Admin"
              value={
                adminMembers.length > 0 ? (
                  <span className="flex max-w-[12rem] items-center gap-2">
                    <MemberAvatarStack
                      members={adminMembers.map((member) => ({
                        userId: member.userId,
                        name: member.name,
                      }))}
                      roomId={roomId}
                      mediaVersion={mediaVersion}
                      size="sm"
                      max={2}
                    />
                    <span className="truncate text-sm text-muted-foreground">
                      {adminMembers.map((member) => member.name).join(', ')}
                    </span>
                  </span>
                ) : (
                  'Not set'
                )
              }
              onClick={() =>
                openTextEditor('admin', 'Admin', {
                  placeholder: 'Admin 1, Admin 2',
                })
              }
            />
            <RoomSettingsEditRow
              label="Lead Singer"
              value={
                leadSingerMembers.length > 0 ? (
                  <span className="flex max-w-[12rem] items-center gap-2">
                    <MemberAvatarStack
                      members={leadSingerMembers.map((member) => ({
                        userId: member.userId,
                        name: member.name,
                      }))}
                      roomId={roomId}
                      mediaVersion={mediaVersion}
                      size="sm"
                      max={2}
                    />
                    <span className="truncate text-sm text-muted-foreground">
                      {leadSingerMembers.map((member) => member.name).join(', ')}
                    </span>
                  </span>
                ) : (
                  'Not set'
                )
              }
              onClick={() =>
                openTextEditor('leadSinger', 'Lead Singer', {
                  placeholder: 'Singer 1, Singer 2',
                })
              }
            />
          </RoomSettingsGlassCard>
        </RoomSettingsSection>

        <RoomSettingsSection title="Room Management">
          <RoomSettingsGlassCard>
            <RoomSettingsEditRow
              label="Room Elites take priority in queuing for Seat"
              value={settings.roomPriority}
              onClick={() =>
                openOptionEditor('roomPriority', 'Seat priority for elites', ['YES', 'NO'])
              }
            />
            <RoomSettingsEditRow
              label="Who Can Join"
              value={settings.whoCanJoin}
              onClick={() =>
                openOptionEditor('whoCanJoin', 'Who Can Join', [
                  'Anyone',
                  'Following',
                  "Room Owner's Following",
                ])
              }
            />
            <RoomSettingsEditRow
              label="Who can be seated"
              value={settings.whoCanBeSeated}
              onClick={() =>
                openOptionEditor('whoCanBeSeated', 'Who can be seated', [
                  'Anyone',
                  'Followers',
                  'Elite Only',
                ])
              }
            />
            <RoomSettingsEditRow
              label="Manage Recommendations"
              value={formatSettingPreview(
                settings.manageRecommendations,
                'Not configured',
              )}
              onClick={() =>
                openTextEditor('manageRecommendations', 'Manage Recommendations', {
                  multiline: true,
                })
              }
            />
            <RoomSettingsEditRow
              label="Chat Room Singing Management"
              value={settings.singingManagement}
              onClick={() =>
                openOptionEditor('singingManagement', 'Singing management', [
                  'Enabled',
                  'Disabled',
                ])
              }
            />
            <RoomSettingsEditRow
              label="Song List"
              value={formatSettingPreview(settings.songList, 'No songs added')}
              onClick={() =>
                openTextEditor('songList', 'Song List', {
                  multiline: true,
                  placeholder: 'Playlist name or description',
                })
              }
            />
            <RoomSettingsEditRow
              label="Block List"
              value={formatSettingPreview(settings.blockList, 'No blocked users')}
              onClick={() =>
                openTextEditor('blockList', 'Block List', {
                  multiline: true,
                  placeholder: 'Blocked usernames',
                })
              }
            />
          </RoomSettingsGlassCard>
        </RoomSettingsSection>
      </RoomSettingsScroll>

      <RoomSettingsCoverEditor
        open={editor?.kind === 'cover'}
        coverUrl={coverUrl}
        onClose={() => setEditor(null)}
        onSaveUrl={handleCoverUrlSave}
        onSaveFile={handleCoverFileSave}
      />

      <RoomSettingsBackgroundEditor
        open={editor?.kind === 'background'}
        storedValue={settings.background}
        onClose={() => setEditor(null)}
        onSave={(value) => persistField('background', value)}
      />

      {editor?.kind === 'text' ? (
        <RoomSettingsTextEditor
          open
          title={editor.title}
          value={readSettingText(String(settings[editor.key] ?? ''))}
          placeholder={editor.placeholder}
          multiline={editor.multiline}
          onClose={() => setEditor(null)}
          onSave={(value) => {
            persistField(editor.key, value);
            setEditor(null);
          }}
        />
      ) : null}

      {editor?.kind === 'roomMode' ? (
        <RoomModeSettingsSheet
          open
          onClose={() => setEditor(null)}
          roomMode={String(settings.roomMode ?? 'Chat')}
          privacy={resolveRoomPrivacy(settings)}
          roomKey={resolveRoomKey(settings)}
          canManageRoomKey={false}
          canSetPrivate={resolveRoomPrivacy(settings) === 'Private'}
          onSave={({ roomMode: nextMode, privacy: nextPrivacy, publicKeyConfirm }) => {
            const storedKey = resolveRoomKey(settings);
            const wasPrivate = resolveRoomPrivacy(settings) === 'Private';
            if (wasPrivate && nextPrivacy === 'Public' && storedKey) {
              if (!verifyRoomKey(storedKey, publicKeyConfirm ?? '')) {
                return;
              }
            }
            const patch = {
              roomMode: nextMode,
              ...roomPrivacyPatch(
                nextPrivacy,
                nextPrivacy === 'Private' ? resolveRoomKey(settings) : undefined,
              ),
            };
            saveRoomSettings(roomId, patch);
            setSettings((prev) => {
              const next = { ...prev, ...patch };
              const managed = getManagedRoomById(roomId);
              if (managed) {
                upsertManagedRoom({
                  ...managed,
                  name: next.roomName?.trim() || managed.name,
                  roomMode: (next.roomMode ?? managed.roomMode) as RoomMode,
                });
              } else if (managedRoom) {
                syncManagedRoomFromActiveSession(roomId, managedRoom.role, {
                  name: next.roomName?.trim(),
                  roomMode: next.roomMode as RoomMode,
                });
              }
              return next;
            });
            setEditor(null);
          }}
        />
      ) : null}

      {editor?.kind === 'options' ? (
        <RoomSettingsOptionPicker
          open
          title={editor.title}
          value={String(settings[editor.key] ?? '')}
          options={editor.options}
          formatOptionLabel={editor.formatOptionLabel}
          onClose={() => setEditor(null)}
          onSelect={(value) => persistField(editor.key, value)}
        />
      ) : null}
    </RoomSettingsShell>
  );
};

export { EditRoom as EditRoomScreen };
export default EditRoom;
