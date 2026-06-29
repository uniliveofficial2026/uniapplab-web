import React, { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { resolveUser } from '../../lib/safe';
import { handleAvatarError, fileToBase64 } from '../../lib/utils';
import { isCloudAuthConfigured } from '../../lib/auth/config';
import {
  getSupabaseSqlEditorUrl,
  probeProfilesTableStatus,
  type ProfilesTableStatus,
} from '../../lib/supabase/profilesTableReady';
import {
  isCloudPublicUserIdAvailable,
  isCloudUsernameAvailable,
  pushCloudProfile,
} from '../../lib/auth/cloudProfile';
import { isLocalPublicUserIdAvailable, validatePublicUserId } from '../../lib/publicUserId';
import { PublicUserIdField } from './PublicUserIdField';
import {
  LaunchField,
  LaunchPrimaryButton,
  LaunchShell,
  launchInputClass,
} from './launchUi';

export function ProfileSetupScreen() {
  const db = useDB();
  const { showToast } = useToast();
  const me = resolveUser(db.users, db.currentUser);
  const avatarInputId = useId();
  const publicUserIdInputId = useId();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(me.displayName || '');
  const [username, setUsername] = useState(me.username || '');
  const [publicUserId, setPublicUserId] = useState(
    me.publicUserId || me.username || ''
  );
  const [bio, setBio] = useState(me.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(me.avatarUrl || '');
  const [busy, setBusy] = useState(false);
  const [profilesTable, setProfilesTable] = useState<ProfilesTableStatus>('unknown');

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

    setBusy(true);
    try {
      if (isCloudAuthConfigured()) {
        const usernameFree = await isCloudUsernameAvailable(trimmedUser, me.id);
        if (!usernameFree) {
          showToast('Username is taken');
          return;
        }
        const userIdFree = await isCloudPublicUserIdAvailable(idCheck.value, me.id);
        if (!userIdFree) {
          showToast('User ID is taken');
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
        if (!isLocalPublicUserIdAvailable(db.users, idCheck.value, me.id)) {
          showToast('User ID is taken');
          return;
        }
      }

      const rawAvatar = avatarUrl.trim() || me.avatarUrl;
      const changedAt = Date.now();
      const nextUser = {
        ...me,
        displayName: trimmedName,
        username: trimmedUser,
        publicUserId: idCheck.value,
        publicUserIdChangedAt: changedAt,
        bio: bio.trim(),
        avatarUrl: rawAvatar,
      };

      if (isCloudAuthConfigured()) {
        await pushCloudProfile(nextUser, { profileSetupComplete: true });
      }

      db.updateUser(me.id, () => nextUser);

      db.completeProfileSetup();
      showToast('Profile ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save profile';
      showToast(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LaunchShell className="p-4 sm:p-6 overflow-y-auto">
      <div className="flex flex-1 w-full min-h-0 flex-col items-center justify-center py-6 sm:py-10">
        <div className="w-full max-w-[420px] flex flex-col items-center gap-8">
          <header className="flex w-full flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-black tracking-tight">Set up your profile</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[320px]">
              Tell people who you are before you join the feed.
              {isCloudAuthConfigured() ? ' Synced to your cloud account.' : ''}
            </p>
          </header>

          <div className="w-full flex flex-col gap-5">
            {profilesTable === 'missing' ? (
              <div
                className="w-full rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-left text-sm text-foreground"
                role="alert"
              >
                <p className="font-semibold text-amber-700 dark:text-amber-300">
                  Cloud database setup required
                </p>
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  The <code className="text-xs">profiles</code> table does not exist on your Supabase
                  project yet. Profile save will fail until you run the SQL once.
                </p>
                <ol className="mt-2 list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                  <li>
                    In <strong>Terminal</strong> (not SQL Editor):{' '}
                    <code className="rounded bg-muted px-1">npm run auth:bootstrap-db</code> — copies
                    SQL to clipboard
                  </li>
                  <li>
                    In <strong>Supabase SQL Editor</strong>: paste SQL (starts with{' '}
                    <code className="text-[10px]">-- InstaCollab</code>) → Run
                  </li>
                  <li>Hard-refresh this page, then Continue</li>
                </ol>
                <a
                  href={getSupabaseSqlEditorUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
                >
                  Open Supabase SQL Editor →
                </a>
              </div>
            ) : null}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-border shadow-lg group"
              >
                <img
                  src={avatarUrl || me.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={handleAvatarError}
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/35 transition-colors">
                  <ImagePlus className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 drop-shadow" />
                </span>
              </button>
              <input
                ref={avatarInputRef}
                id={avatarInputId}
                type="file"
                className="sr-only"
                accept="image/*,image/svg+xml,.svg,.webp"
                onChange={(e) => void onPickAvatar(e)}
              />
              <label
                htmlFor={avatarInputId}
                className="text-xs font-semibold text-primary cursor-pointer hover:underline"
              >
                Upload profile photo
              </label>
            </div>

            <LaunchField label="Display name">
              <input
                className={launchInputClass}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </LaunchField>
            <LaunchField label="Username">
              <input
                className={launchInputClass}
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
              hint="Choose your public User ID now. After setup you can change it once every 7 days in profile settings."
            />
            <LaunchField label="Bio">
              <textarea
                className={`${launchInputClass} min-h-[88px] resize-none`}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short intro..."
                maxLength={150}
              />
            </LaunchField>
            <LaunchField label="Avatar URL (optional)">
              <input
                className={launchInputClass}
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </LaunchField>

            <LaunchPrimaryButton
              onClick={() => void onSave()}
              disabled={busy || profilesTable === 'missing'}
            >
              {busy ? 'Saving…' : profilesTable === 'missing' ? 'Set up database first' : 'Continue'}
            </LaunchPrimaryButton>
          </div>
        </div>
      </div>
    </LaunchShell>
  );
}
