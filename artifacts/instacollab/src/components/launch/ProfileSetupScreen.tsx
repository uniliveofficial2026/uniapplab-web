import React, { useEffect, useId, useRef, useState } from 'react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { resolveUser } from '../../lib/safe';
import { APP_DISPLAY_NAME } from '../../lib/appBrand';
import { fileToBase64 } from '../../lib/utils';
import { useAppCamera } from '../../contexts/AppCameraContext';
import { isCloudAuthConfigured } from '../../lib/auth/config';
import {
  getSupabaseSqlEditorUrl,
  probeProfilesTableStatus,
  type ProfilesTableStatus,
} from '../../lib/supabase/profilesTableReady';
import {
  isCloudUsernameAvailable,
} from '../../lib/auth/cloudProfile';
import { commitUserProfile } from '../../lib/auth/userDataFlow';
import { validatePublicUserId } from '../../lib/publicUserId';
import {
  usePublicUserIdAvailability,
} from '../../hooks/usePublicUserIdAvailability';
import { PublicUserIdField } from './PublicUserIdField';
import { LegalAgreementCheckbox } from '../legal/LegalAgreementCheckbox';
import { LEGAL_AGREEMENT_VERSION, writeLegalAcceptanceToStorage } from '../../lib/legalDocs';
import {
  LaunchField,
  LaunchPrimaryButton,
} from './launchUi';
import {
  UniLivesAvatarUploader,
  UniLivesProfileSetupCard,
  UniLivesProfileSetupHeader,
  UniLivesProfileSetupShell,
  UniLivesProfileSetupStatus,
  unilivesProfileSetupInputClass,
} from '../profile-setup/brand';

export function ProfileSetupScreen() {
  const db = useDB();
  const { showToast } = useToast();
  const me = resolveUser(db.users, db.currentUser);
  const avatarInputId = useId();
  const publicUserIdInputId = useId();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { isAvailable: cameraAvailable, openCamera } = useAppCamera();
  const [displayName, setDisplayName] = useState(me.displayName || '');
  const [username, setUsername] = useState(me.username || '');
  const [publicUserId, setPublicUserId] = useState(
    me.publicUserId || me.username || ''
  );
  const [bio, setBio] = useState(me.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(me.avatarUrl || '');
  const [legalAccepted, setLegalAccepted] = useState(
    () => Boolean(me.legalAgreementAcceptedAt) || db.hasAcceptedLegalAgreement(me.id),
  );
  const [busy, setBusy] = useState(false);
  const [profilesTable, setProfilesTable] = useState<ProfilesTableStatus>('unknown');
  const publicUserIdStatus = usePublicUserIdAvailability(publicUserId, {
    exceptUserId: me.id,
    currentPublicUserId: me.publicUserId || me.username,
  });

  useEffect(() => {
    if (!isCloudAuthConfigured()) {
      setProfilesTable('not_configured');
      return;
    }
    let cancelled = false;
    void probeProfilesTableStatus().then((status) => {
      if (!cancelled) setProfilesTable(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onCopyUserId = async () => {
    const validated = validatePublicUserId(publicUserId);
    const copyValue = validated.ok ? validated.value : publicUserId.trim();
    try {
      await navigator.clipboard.writeText(copyValue);
      showToast('User ID copied');
    } catch {
      showToast('Unable to copy User ID');
    }
  };

  const onPickAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setAvatarUrl(await fileToBase64(file));
    } catch {
      showToast('Could not load that image');
    }
  };

  const onSave = async () => {
    const trimmedName = displayName.trim();
    const trimmedUser = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const idCheck = validatePublicUserId(publicUserId);
    if (!idCheck.ok) {
      showToast(idCheck.reason);
      return;
    }
    if (trimmedName.length < 2) {
      showToast('Add a display name');
      return;
    }
    if (trimmedUser.length < 3) {
      showToast('Username must be at least 3 characters');
      return;
    }
    if (!legalAccepted) {
      showToast('Confirm you are 18+ and agree to Privacy Policy & Terms to continue');
      return;
    }

    setBusy(true);
    try {
      if (isCloudAuthConfigured()) {
        const usernameFree = await isCloudUsernameAvailable(trimmedUser, me.id);
        if (!usernameFree) {
          showToast('Username is taken');
          return;
        }
      } else {
        const taken = db.users.some(
          (u) => u.id !== me.id && u.username.toLowerCase() === trimmedUser
        );
        if (taken) {
          showToast('Username is taken');
          return;
        }
      }

      const idGateCheck = validatePublicUserId(publicUserId);
      if (!idGateCheck.ok) {
        showToast(idGateCheck.reason);
        return;
      }

      const rawAvatar = avatarUrl.trim() || me.avatarUrl;
      const acceptedAt = Date.now();
      writeLegalAcceptanceToStorage(me.id, acceptedAt);

      const result = await commitUserProfile(
        me.id,
        {
          displayName: trimmedName,
          username: trimmedUser,
          publicUserId: idGateCheck.value,
          publicUserIdChangedAt: Date.now(),
          bio: bio.trim(),
          avatarUrl: rawAvatar,
          legalAgreementAcceptedAt: acceptedAt,
          legalAgreementVersion: LEGAL_AGREEMENT_VERSION,
        },
        {
          profileSetupComplete: true,
          enforceUniquePublicUserId: true,
          localOnly: !isCloudAuthConfigured(),
        },
      );
      if (!result.ok) {
        showToast(result.reason);
        return;
      }

      showToast('Profile ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save profile';
      showToast(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <UniLivesProfileSetupShell section="welcome">
      <div className="flex flex-1 w-full min-h-0 flex-col items-center py-6 sm:py-10">
        {/* my-auto: centered when short, scrollable to top/bottom when tall */}
        <div className="my-auto w-full max-w-[420px] flex flex-col items-center gap-8">
          <UniLivesProfileSetupHeader
            title="Set up your profile"
            subtitle={`Tell people who you are before you join the feed.${
              isCloudAuthConfigured() ? ' Synced to your cloud account.' : ''
            }`}
          />

          <UniLivesProfileSetupCard>
            {profilesTable === 'missing' ? (
              <UniLivesProfileSetupStatus tone="warning" role="alert">
                <p className="font-semibold text-amber-700 dark:text-amber-300">
                  Cloud database setup required
                </p>
                <p className="mt-1 text-[color:var(--color-unilives-profile-setup-muted)] leading-relaxed">
                  The <code className="text-xs">profiles</code> table does not exist on your Supabase
                  project yet. Profile save will fail until you run the SQL once.
                </p>
                <ol className="mt-2 list-decimal list-inside space-y-1 text-[color:var(--color-unilives-profile-setup-muted)] text-xs">
                  <li>
                    In <strong>Terminal</strong> (not SQL Editor):{' '}
                    <code className="rounded bg-muted px-1">npm run auth:bootstrap-db</code> — copies
                    SQL to clipboard
                  </li>
                  <li>
                    In <strong>Supabase SQL Editor</strong>: paste SQL (starts with{' '}
                    <code className="text-[10px]">-- {APP_DISPLAY_NAME}</code>) → Run
                  </li>
                  <li>Hard-refresh this page, then Continue</li>
                </ol>
                <a
                  href={getSupabaseSqlEditorUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs font-semibold text-[color:var(--color-unilives-primary)] hover:underline"
                >
                  Open Supabase SQL Editor →
                </a>
              </UniLivesProfileSetupStatus>
            ) : null}
            <UniLivesAvatarUploader
              previewUrl={avatarUrl}
              fallbackUrl={me.avatarUrl}
              fileInputRef={avatarInputRef}
              fileInputId={avatarInputId}
              onFileChange={(e) => void onPickAvatar(e)}
              onOpenPicker={() => {
                if (cameraAvailable) {
                  openCamera({
                    title: 'Profile photo',
                    onCaptured: ({ kind, url }) => {
                      if (kind === 'photo') setAvatarUrl(url);
                    },
                  });
                  return;
                }
                avatarInputRef.current?.click();
              }}
              onUploadClick={() => avatarInputRef.current?.click()}
            />

            <LaunchField label="Display name">
              <input
                className={unilivesProfileSetupInputClass}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </LaunchField>
            <LaunchField label="Username">
              <input
                className={unilivesProfileSetupInputClass}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="creative_you"
                required
                minLength={3}
              />
            </LaunchField>
            <PublicUserIdField
              id={publicUserIdInputId}
              value={publicUserId}
              onChange={setPublicUserId}
              onCopy={() => void onCopyUserId()}
              availability={publicUserIdStatus}
              inputClass={unilivesProfileSetupInputClass}
              hint="Choose your public User ID now. It must be unique. After setup you can change it once every 7 days in profile settings."
            />
            <LaunchField label="Bio">
              <textarea
                className={`${unilivesProfileSetupInputClass} min-h-[88px] resize-none`}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short intro..."
                maxLength={150}
              />
            </LaunchField>
            <LaunchField label="Avatar URL (optional)">
              <input
                className={unilivesProfileSetupInputClass}
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </LaunchField>

            <LegalAgreementCheckbox checked={legalAccepted} onChange={setLegalAccepted} />

            <LaunchPrimaryButton
              tone="onboarding"
              onClick={() => void onSave()}
              disabled={
                busy ||
                profilesTable === 'missing' ||
                !legalAccepted ||
                publicUserIdStatus === 'taken' ||
                publicUserIdStatus === 'checking' ||
                publicUserIdStatus === 'invalid'
              }
            >
              {busy ? 'Saving…' : profilesTable === 'missing' ? 'Set up database first' : 'Continue'}
            </LaunchPrimaryButton>
          </UniLivesProfileSetupCard>
        </div>
      </div>
    </UniLivesProfileSetupShell>
  );
}
