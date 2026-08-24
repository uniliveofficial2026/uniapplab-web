import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Camera, User as UserIcon, AtSign, Globe, Check } from 'lucide-react';
import { LanguageSelector } from '../common/LanguageSelector';
import { LegalAgreementCheckbox } from '../legal/LegalAgreementCheckbox';
import { PublicUserIdField } from '../launch/PublicUserIdField';
import { useAuth } from '../../lib/AuthContext';
import { useAppCamera } from '../../contexts/AppCameraContext';
import { db } from '../../lib/db/localDb';
import { markOnboardingSeenOnDevice } from '../../lib/splashSession';
import { isCloudAuthConfigured } from '../../lib/auth/config';
import { isCloudUsernameAvailable } from '../../lib/auth/cloudProfile';
import { commitUserProfile } from '../../lib/auth/userDataFlow';
import { LEGAL_AGREEMENT_VERSION, writeLegalAcceptanceToStorage } from '../../lib/legalDocs';
import {
  usePublicUserIdAvailability,
} from '../../hooks/usePublicUserIdAvailability';
import type { User } from '../../types';
import { localeEnglishName } from '../../lib/i18n/locales';
import { useI18n } from '../../lib/i18n/I18nContext';

/**
 * Firebase-primary profile setup — same commit path as Launch ProfileSetupScreen.
 */
export function ProfileSetup() {
  const { user, setProfile } = useAuth();
  const i18n = useI18n();
  const [username, setUsername] = useState('');
  const [publicUserId, setPublicUserId] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState('');
  const [language, setLanguage] = useState(localeEnglishName(i18n.locale));
  const [loading, setLoading] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.photoURL || '');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { isAvailable: cameraAvailable, openCamera } = useAppCamera();
  const exceptUserId = user?.uid || '';
  const publicUserIdStatus = usePublicUserIdAvailability(publicUserId || username, {
    exceptUserId,
    enabled: Boolean(exceptUserId),
  });

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size too large (max 5MB)');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    if (!legalAccepted) {
      alert('Confirm you are 18+ and agree to the Privacy Policy and Terms to continue.');
      return;
    }

    const trimmedUser = username.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9_.]/g, '');
    if (trimmedUser.length < 3) {
      alert('Username must be at least 3 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isCloudAuthConfigured()) {
        const usernameFree = await isCloudUsernameAvailable(trimmedUser, user.uid);
        if (!usernameFree) {
          alert('Username is taken. Choose a different one.');
          return;
        }
      }

      // Ensure a local user row exists for commitUserProfile.
      if (!db.users.some((u) => u.id === user.uid)) {
        const seed: User = {
          id: user.uid,
          username: trimmedUser,
          displayName: displayName || user.displayName || trimmedUser,
          avatarUrl: avatarUrl || user.photoURL || '',
          bio: '',
          followers: 0,
          following: 0,
        };
        db.syncAuthUser(seed);
      }

      const acceptedAt = Date.now();
      writeLegalAcceptanceToStorage(user.uid, acceptedAt);

      const result = await commitUserProfile(
        user.uid,
        {
          username: trimmedUser,
          publicUserId: publicUserId || trimmedUser,
          publicUserIdChangedAt: Date.now(),
          displayName: displayName || user.displayName || trimmedUser,
          avatarUrl:
            avatarUrl ||
            user.photoURL ||
            `https://api.dicebear.com/7.x/adventurer/svg?seed=${trimmedUser}`,
          bio,
          legalAgreementAcceptedAt: acceptedAt,
          legalAgreementVersion: LEGAL_AGREEMENT_VERSION,
        },
        {
          profileSetupComplete: true,
          enforceUniquePublicUserId: true,
          email: user.email,
          localOnly: !isCloudAuthConfigured(),
        },
      );

      if (!result.ok) {
        alert(result.reason);
        return;
      }

      setProfile(result.user);
      try {
        localStorage.setItem('local_profile_' + user.uid, JSON.stringify(result.user));
        markOnboardingSeenOnDevice();
      } catch {
        /* quota */
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      alert(`Could not save profile: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-[color:var(--color-unilives-profile-setup-background)] z-[1100] flex items-center justify-center p-6 overflow-y-auto"
      data-unilives-profile-setup-legacy=""
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-[color:var(--color-unilives-profile-setup-surface)] border border-[color:var(--color-unilives-profile-setup-border)] shadow-2xl rounded-[32px] p-8"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-[color:var(--color-unilives-profile-setup-text)]">Set Up Profile</h2>
          <p className="text-[color:var(--color-unilives-profile-setup-muted)] mt-2">Almost there! Tell us about yourself.</p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-center mb-8">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-secondary overflow-hidden border-4 border-background shadow-lg">
                <img
                  src={avatarUrl || undefined}
                  className="w-full h-full object-cover"
                  alt="Avatar"
                />
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarSelect}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => {
                  if (cameraAvailable) {
                    openCamera({
                      title: 'Profile photo',
                      onCaptured: ({ kind, url }) => {
                        if (kind === 'photo') setAvatarUrl(url);
                      },
                    });
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                aria-label="Take profile photo"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[color:var(--color-unilives-profile-setup-muted)] uppercase ml-2 flex items-center gap-1">
                <AtSign className="w-3 h-3" /> Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  const next = e.target.value;
                  setUsername(next);
                  if (!publicUserId.trim()) setPublicUserId(next);
                }}
                className="w-full h-12 bg-[color:var(--color-unilives-profile-setup-surface)] rounded-xl border border-[color:var(--color-unilives-profile-setup-border)] px-4 focus:ring-2 focus:ring-[color:var(--color-unilives-profile-setup-focus)] outline-none transition-all"
                placeholder="unique_handle"
              />
            </div>

            <PublicUserIdField
              value={publicUserId}
              onChange={setPublicUserId}
              availability={publicUserIdStatus}
              inputClass="w-full h-12 bg-[color:var(--color-unilives-profile-setup-surface)] rounded-xl border border-[color:var(--color-unilives-profile-setup-border)] px-4 focus:ring-2 focus:ring-[color:var(--color-unilives-profile-setup-focus)] outline-none transition-all"
              onCopy={() => {
                void navigator.clipboard.writeText(publicUserId || username).catch(() => undefined);
              }}
              hint="Must be unique — cannot match another account’s User ID or username."
            />

            <div className="space-y-2">
              <label className="text-xs font-bold text-[color:var(--color-unilives-profile-setup-muted)] uppercase ml-2 flex items-center gap-1">
                <UserIcon className="w-3 h-3" /> Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full h-12 bg-[color:var(--color-unilives-profile-setup-surface)] rounded-xl border border-[color:var(--color-unilives-profile-setup-border)] px-4 focus:ring-2 focus:ring-[color:var(--color-unilives-profile-setup-focus)] outline-none transition-all"
                placeholder="Full Name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-[color:var(--color-unilives-profile-setup-muted)] uppercase ml-2 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Language Preference
              </label>
              <LanguageSelector value={language} onChange={setLanguage} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-[color:var(--color-unilives-profile-setup-muted)] uppercase ml-2">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full h-32 bg-[color:var(--color-unilives-profile-setup-surface)] rounded-xl border border-[color:var(--color-unilives-profile-setup-border)] p-4 focus:ring-2 focus:ring-[color:var(--color-unilives-profile-setup-focus)] outline-none transition-all resize-none"
                placeholder="Tell the world who you are..."
              />
            </div>
          </div>

          <LegalAgreementCheckbox checked={legalAccepted} onChange={setLegalAccepted} />

          <button
            onClick={() => void handleComplete()}
            disabled={
              loading ||
              !username ||
              !legalAccepted ||
              publicUserIdStatus === 'taken' ||
              publicUserIdStatus === 'checking' ||
              publicUserIdStatus === 'unreachable' ||
              publicUserIdStatus === 'invalid'
            }
            className="w-full h-14 bg-[color:var(--color-unilives-primary)] text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all active:scale-95 shadow-lg mt-4"
          >
            {loading ? (
              'Finalizing...'
            ) : (
              <>
                Complete Setup <Check className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
