import React, { useEffect, useState } from 'react';
import {
  Settings,
  Shield,
  Download,
  Bell,
  Palette,
  Database,
  Cloud,
  UserX,
  ChevronRight,
  Crown,
  CheckCircle2,
  LogOut,
  UserPlus,
  Trash2,
  CheckCircle,
  X,
} from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';
import {
  formatPremiumExpiryDate,
  getProfilePremiumAccessStatus,
} from '../../lib/premium';
import { handleAvatarError } from '../../lib/utils';
import { resolveUser } from '../../lib/safe';
import { applyDocumentTheme } from '../../lib/theme';
import { isCloudAuthConfigured } from '../../lib/auth/config';
import {
  isCloudPublicUserIdAvailable,
  scheduleCloudProfileSync,
} from '../../lib/auth/cloudProfile';
import {
  canChangePublicUserId,
  isLocalPublicUserIdAvailable,
  publicUserIdCooldownMessage,
  resolvePublicUserId,
  validatePublicUserId,
} from '../../lib/publicUserId';
import { PublicUserIdField } from '../launch/PublicUserIdField';
import type { User } from '../../types';
import type { AppSettings } from '../../lib/dbTypes';
import { ProfileCloudSystemsModal } from './ProfileCloudSystemsModal';


export type ProfileEditSettingsModalProps = {
  onClose: () => void;
  onOpenSettings: () => void;
  targetUser: User;
  isCurrentUser: boolean;
  localUser: User;
  setLocalUser: React.Dispatch<React.SetStateAction<User>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onOpenBlockedUsers: () => void;
  onOpenAccountSwitcher?: () => void;
  onRequestVerification?: () => void;
  onDeleteAccount?: () => void | Promise<void>;
  onLogout?: () => void | Promise<void>;
};


export function ProfileEditSettingsModal({
  onClose,
  onOpenSettings,
  targetUser: _targetUser,
  isCurrentUser: _isCurrentUser,
  localUser,
  setLocalUser,
  fileInputRef,
  handleAvatarChange,
  onOpenBlockedUsers,
  onOpenAccountSwitcher,
  onRequestVerification,
  onDeleteAccount,
  onLogout,
}: ProfileEditSettingsModalProps) {
  const db = useDB();
  const { showToast } = useToast();
  const hasProfilePremium = db.hasProfilePremium();
  const profilePremiumStatus = getProfilePremiumAccessStatus(db.currentUser);

  const [showCloudSystems, setShowCloudSystems] = useState(false);
  const [storageStats, setStorageStats] = useState(db.getStorageStats());
  const [settings, setSettings] = useState(db.settings);
  const [publicUserIdDraft, setPublicUserIdDraft] = useState(() => resolvePublicUserId(localUser));
  const canEditPublicUserId =
    canChangePublicUserId(localUser.publicUserIdChangedAt) || !localUser.publicUserId;
  const publicUserIdHint = canEditPublicUserId
    ? 'You can change your User ID once every 7 days.'
    : publicUserIdCooldownMessage(localUser.publicUserIdChangedAt);
  const profileVisitorsEnabled = settings.profileVisitorsEnabled !== false;

  const openWalletTab = () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'wallet' } }));
  };



  useEffect(() => {
    setSettings(db.settings);
    refreshStorageStats();
  }, [db]);

  const refreshStorageStats = (opts?: { refreshDevice?: boolean }) => {
    setStorageStats(db.getStorageStats());
    if (!opts?.refreshDevice) return;
    void db.refreshStorageDeviceEstimate().then(() => {
      setStorageStats(db.getStorageStats());
    });
  };


  const cloudConnections = Array.isArray(settings.cloudConnections)
    ? settings.cloudConnections
    : (settings.cloudConnection?.connected ? [{ ...settings.cloudConnection, id: settings.cloudConnection.id || 'legacy_connection' }] : []);

  const handleClearCache = () => {
    if (
      window.confirm(
        'Clear temporary storage cache? Your posts, stories, messages, and account settings will stay on this device.',
      )
    ) {
      db.clearCache();
      setTimeout(() => refreshStorageStats({ refreshDevice: true }), 400);
      setSettings(db.settings);
      showToast('Storage cache cleared');
    }
  };

  const updateSetting = (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    db.updateSettings({ [key]: value });

    if (key === 'theme') {
      applyDocumentTheme(value === 'dark' ? 'dark' : 'light');
    }
  };

  const storageTier = storageStats.tier ?? db.getStorageTier();
  const storageUnlimited = storageStats.unlimited ?? db.hasUnlimitedPlan();
  const meterPercent = storageUnlimited ? null : (storageStats.meterPercent ?? 0);

  useEffect(() => {
    setPublicUserIdDraft(resolvePublicUserId(localUser));
  }, [localUser.publicUserId, localUser.username]);

  const commitPublicUserId = async () => {
    if (!canEditPublicUserId) return;

    const validated = validatePublicUserId(publicUserIdDraft);
    if (!validated.ok) {
      showToast(validated.reason);
      setPublicUserIdDraft(resolvePublicUserId(localUser));
      return;
    }

    const current = resolvePublicUserId(localUser);
    if (validated.value === current) return;

    if (isCloudAuthConfigured()) {
      const available = await isCloudPublicUserIdAvailable(validated.value, localUser.id);
      if (!available) {
        showToast('User ID is taken');
        setPublicUserIdDraft(current);
        return;
      }
    } else if (!isLocalPublicUserIdAvailable(db.users, validated.value, localUser.id)) {
      showToast('User ID is taken');
      setPublicUserIdDraft(current);
      return;
    }

    const now = Date.now();
    const next: User = {
      ...localUser,
      publicUserId: validated.value,
      publicUserIdChangedAt: now,
    };
    db.updateUser(localUser.id, () => next);
    setLocalUser(next);
    setPublicUserIdDraft(validated.value);
    if (isCloudAuthConfigured()) scheduleCloudProfileSync(next);
    showToast('User ID updated');
  };

  const handleSavePreferences = () => {
    showToast('Preferences Saved');
  };

  const { signOut } = useSupabaseAuth();

  const handleLogout = () => {
    if (onLogout) {
      void Promise.resolve(onLogout()).then(() => onClose());
      return;
    }
    if (!window.confirm('Log out of InstaCollab on this device?')) return;
    void signOut().then(() => {
      onClose();
      showToast('Logged out');
    });
  };

  return (
    <>
      {!showCloudSystems && (
<div id="edit-profile-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-background">
  <div className="absolute inset-0" onClick={() => onClose()}></div>
  <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl p-6 flex flex-col max-h-[90vh] min-h-0 relative z-10">
    <div className="flex justify-between items-center mb-6 shrink-0">
      <h2 className="text-xl font-bold">Settings & Privacy</h2>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSavePreferences}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" />
          Save
        </button>
        <button onClick={() => onClose()} className="text-muted-foreground hover:text-foreground"><X className="w-6 h-6" /></button>
      </div>
    </div>

    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-6">
      <div className="flex items-center gap-4">
        <img src={localUser.avatarUrl || undefined} className="w-16 h-16 rounded-full object-cover border border-border" alt="avatar" onError={handleAvatarError} />
        <button onClick={() => fileInputRef.current?.click()} className="text-primary font-bold text-sm hover:underline">Change Profile Photo</button>
        <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
      </div>
      
      <div className="space-y-4">
        <PublicUserIdField
          value={publicUserIdDraft}
          onChange={setPublicUserIdDraft}
          onBlur={() => void commitPublicUserId()}
          disabled={!canEditPublicUserId}
          hint={publicUserIdHint}
          onCopy={() => {
            void navigator.clipboard
              .writeText(resolvePublicUserId({ ...localUser, publicUserId: publicUserIdDraft }))
              .then(() => showToast('User ID copied'))
              .catch(() => showToast('Unable to copy User ID'));
          }}
        />
        <div className="space-y-1">
          <label className="text-sm font-bold text-muted-foreground">Name</label>
          <input type="text" value={localUser.displayName} onChange={e => {
              setLocalUser({...localUser, displayName: e.target.value});
              db.updateUser(localUser.id, u => ({...u, displayName: e.target.value}));
          }} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-bold text-muted-foreground">Bio</label>
          <textarea value={localUser.bio} onChange={e => {
              setLocalUser({...localUser, bio: e.target.value});
              db.updateUser(localUser.id, u => ({...u, bio: e.target.value}));
          }} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-20 resize-none" />
        </div>
      </div>

      <div className="pt-4 border-t border-border space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Settings className="w-5 h-5 text-primary" /> App Preferences</h3>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-2"><Bell className="w-4 h-4 text-muted-foreground" /> Push Notifications</span>
          <button onClick={() => updateSetting('notificationsEnabled', !settings.notificationsEnabled)} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.notificationsEnabled ? 'bg-green-500' : 'bg-secondary'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-2"><Palette className="w-4 h-4 text-muted-foreground" /> App Theme</span>
          <select 
            value={settings.theme === 'dark' ? 'Vibrant Dark' : 'Minimalist Light'} 
            onChange={(e) => updateSetting('theme', e.target.value === 'Vibrant Dark' ? 'dark' : 'light')}
            className="bg-secondary text-sm font-semibold rounded-lg px-2 py-1 outline-none border border-border"
          >
            <option>Vibrant Dark</option>
            <option>Minimalist Light</option>
          </select>
        </div>
      </div>

      <div className="pt-4 border-t border-border space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-accent" /> Privacy & Security</h3>
        
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-semibold block">Private Account</span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              Only approved followers see your posts, reels, and tagged content
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !(localUser.isPrivate ?? settings.isPrivate);
              db.setAccountPrivate(next);
              setSettings(db.settings);
              setLocalUser({ ...localUser, isPrivate: next });
              showToast(
                next
                  ? 'Your account is now private — new followers need your approval'
                  : 'Your account is now public'
              );
            }}
            className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 ${(localUser.isPrivate ?? settings.isPrivate) ? 'bg-green-500' : 'bg-secondary'}`}
            aria-pressed={!!(localUser.isPrivate ?? settings.isPrivate)}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${(localUser.isPrivate ?? settings.isPrivate) ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-semibold block">Profile visitors</span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              Save who viewed your profile and show the visitors list
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !profileVisitorsEnabled;
              updateSetting('profileVisitorsEnabled', next);
              showToast(
                next
                  ? 'Profile visitors on — new visits will appear in your list'
                  : 'Profile visitors off — new visits will not be saved'
              );
            }}
            className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 ${profileVisitorsEnabled ? 'bg-green-500' : 'bg-secondary'}`}
            aria-pressed={profileVisitorsEnabled}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${profileVisitorsEnabled ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </button>
        </div>
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ${
            hasProfilePremium
              ? 'border-amber-500/25 bg-amber-500/5'
              : 'border-border bg-secondary/30'
          }`}
        >
          <div className="min-w-0">
            <span className="text-sm font-semibold block flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500 shrink-0" />
              Leave no trace
              {!hasProfilePremium ? (
                <span className="text-[10px] font-black uppercase text-primary">Premium</span>
              ) : null}
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {hasProfilePremium
                ? 'When on, your profile visits are not saved — you will not appear on anyone’s visitor list'
                : 'Free accounts always appear on visitor lists. Get Profile Premium to browse without leaving a trace.'}
            </span>
          </div>
          <button
            type="button"
            disabled={!hasProfilePremium}
            onClick={() => {
              if (!hasProfilePremium) {
                onClose();
                openWalletTab();
                showToast('Only Profile Premium can hide your profile visits');
                return;
              }
              const next = !settings.hiddenProfileViews;
              updateSetting('hiddenProfileViews', next);
              showToast(
                next
                  ? 'Leave no trace on — your visits will not appear on visitor lists'
                  : 'Leave no trace off — your visits will be recorded again'
              );
            }}
            className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 ${
              !hasProfilePremium
                ? 'bg-secondary opacity-50 cursor-not-allowed'
                : settings.hiddenProfileViews
                  ? 'bg-amber-500'
                  : 'bg-secondary'
            }`}
            aria-pressed={!!settings.hiddenProfileViews}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.hiddenProfileViews && hasProfilePremium ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </button>
        </div>
        {!hasProfilePremium ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              openWalletTab();
            }}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            Get Profile Premium — from $9.99 / month
          </button>
        ) : (
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold px-1 flex flex-col gap-0.5">
            <span className="flex items-center gap-1">
              <Crown className="w-3 h-3 shrink-0" /> Profile Premium active
            </span>
            {profilePremiumStatus.expiresAt != null ? (
              <span className="text-muted-foreground font-medium pl-4">
                {profilePremiumStatus.periodLabel
                  ? `${profilePremiumStatus.periodLabel} · `
                  : ''}
                {profilePremiumStatus.timeRemainingLabel} · until{' '}
                {formatPremiumExpiryDate(profilePremiumStatus.expiresAt)}
              </span>
            ) : null}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Language & Region</span>
          <select 
            value={settings.language} 
            onChange={(e) => updateSetting('language', e.target.value)}
            className="bg-secondary text-sm font-semibold rounded-lg px-2 py-1 outline-none border border-border"
          >
            <option>English</option>
            <option>Spanish</option>
            <option>French</option>
            <option>German</option>
            <option>Japanese</option>
          </select>
        </div>

        <button
          type="button"
          onClick={onOpenBlockedUsers}
          className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-left hover:bg-secondary/70 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground min-w-0">
            <UserX className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="truncate">Blocked accounts</span>
          </span>
          <span className="flex items-center gap-1 shrink-0 text-xs font-bold text-muted-foreground">
            {db.getBlockedUsers().length}
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>
        <p className="text-[10px] text-muted-foreground px-1 leading-tight -mt-2">
          Manage people you have blocked. Unblocking restores their posts in your feed.
        </p>

        {onRequestVerification ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onRequestVerification();
            }}
            className="flex items-center justify-between w-full font-semibold text-sm text-foreground hover:text-primary transition-colors pt-2"
          >
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-500" /> Request Verification
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ) : null}
        
        <button
          onClick={() => {
            const next = !settings.offlineSync;
            db.setOfflineSyncEnabled(next);
            setSettings(db.settings);
            refreshStorageStats();
            showToast(
              next
                ? 'Offline sync on — full local backup kept on this device'
                : storageUnlimited
                  ? 'Offline sync off — Unlimited plan still has no app storage cap'
                  : 'Offline sync off — local cache may trim older items to stay within your plan'
            );
          }}
          className="flex items-center gap-2 font-semibold text-sm text-foreground hover:text-primary transition-colors pt-2"
        >
          <Database className={`w-4 h-4 ${settings.offlineSync ? 'text-green-500' : 'text-muted-foreground'}`} /> {settings.offlineSync ? 'Disable Offline Sync' : 'Enable Offline Sync / Data Backup'}
        </button>
        <p className="text-[10px] text-muted-foreground px-1 leading-tight -mt-2">
          When enabled, the app keeps a full local copy of your data on this device (recommended with Unlimited).
        </p>
        <button 
          onClick={() => {
            const data = {
              user: localUser,
              settings: db.settings,
              posts: (db.posts ?? []).filter((p) => p?.user?.id === localUser?.id),
              timestamp: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `instacollab_activity_${localUser.username}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Activity report generated and downloaded');
          }}
          className="flex items-center gap-2 font-semibold text-sm text-foreground hover:text-primary transition-colors"
        >
          <Download className="w-4 h-4 text-muted-foreground" /> Download Activity & Reports
        </button>
      </div>

      <div className="pt-4 border-t border-border space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Database className="w-5 h-5 text-indigo-500" /> Local Storage & Cache</h3>
        
        <div className="space-y-2">
          <label className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">Storage Plan Control</label>
          <div className="grid grid-cols-3 gap-2">
            {(['50GB', '100GB', 'Unlimited'] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => {
                  db.setStorageTier(tier);
                  setLocalUser(resolveUser(db.users, db.currentUser));
                  setSettings(db.settings);
                  refreshStorageStats();
                  showToast(
                    tier === 'Unlimited'
                      ? 'Unlimited plan active — no app-enforced storage cap'
                      : `Storage plan updated to ${tier}`
                  );
                }}
                className={`py-3 px-2 rounded-xl border text-xs font-black transition-all ${
                  storageTier === tier
                    ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
                    : 'bg-secondary/50 border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground px-1 leading-tight">
            This section manages <b>local device cache only</b>. Connected cloud providers store synced data remotely.
          </p>
        </div>

        <div className="bg-secondary/30 rounded-xl p-4 border border-border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold">Local storage used</span>
            <span className="text-xs font-mono bg-secondary px-2 py-1 rounded text-right max-w-[65%] truncate">
              {storageStats.planUsageLabel || storageStats.usageLabel}
            </span>
          </div>
          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full transition-all duration-1000 ${
                storageUnlimited ? 'bg-emerald-500' : storageStats.overPlanLimit ? 'bg-red-500' : 'bg-primary'
              }`}
              style={{
                width: storageUnlimited
                  ? '100%'
                  : `${Math.max(0.5, Math.min(100, meterPercent ?? 0))}%`,
                opacity: storageUnlimited ? 0.35 : 1,
              }}
            />
          </div>
          {storageUnlimited && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mb-2 px-0.5">
              Unlimited plan — no app-enforced cap. Usage bar is for reference only.
            </p>
          )}
          {storageStats.overPlanLimit && !storageUnlimited && (
            <p className="text-[10px] text-red-500 font-semibold mb-2 px-0.5">
              Over your {storageStats.planLimitLabel} plan — switch to Unlimited or remove old content.
            </p>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold">Cached Item Count</span>
            <span className="text-xs font-mono bg-secondary px-2 py-1 rounded">{storageStats.items}</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-muted-foreground font-semibold">Active plan</span>
            <span className="text-xs font-mono bg-secondary px-2 py-1 rounded">
              {storageStats.planLimitLabel || storageTier}
            </span>
          </div>
          {storageStats.browserUsageLabel && storageStats.browserQuotaLabel ? (
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted-foreground font-semibold">Browser quota</span>
              <span className="text-xs font-mono bg-secondary/60 px-2 py-1 rounded text-muted-foreground">
                {storageStats.browserUsageLabel} / {storageStats.browserQuotaLabel}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-muted-foreground font-semibold">Offline backup</span>
            <span className={`text-xs font-mono px-2 py-1 rounded ${settings.offlineSync ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-secondary text-muted-foreground'}`}>
              {settings.offlineSync ? 'On' : 'Off'}
            </span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-muted-foreground font-semibold">Cloud Storage</span>
            <span className={`text-xs font-mono px-2 py-1 rounded ${cloudConnections.length > 0 ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-secondary text-muted-foreground'}`}>
              {cloudConnections.length > 0 ? `Connected (${cloudConnections.length})` : 'Not connected'}
            </span>
          </div>
        </div>

        <button 
          onClick={handleClearCache}
          className="w-full flex items-center justify-center gap-2 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl transition-colors border border-border"
        >
          <X className="w-4 h-4" /> Clear Storage Cache
        </button>
        <p className="text-[10px] text-muted-foreground px-1 leading-tight">
          Refreshes storage meters and sync metadata only. Does not delete your posts, stories, or messages.
        </p>

        {onDeleteAccount ? (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Are you sure you want to permanently delete your account? This action cannot be undone.',
                )
              ) {
                void Promise.resolve(onDeleteAccount()).then(() => {
                  onClose();
                  showToast('Account permanently deleted');
                });
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl transition-colors border border-red-500/20"
          >
            <Trash2 className="w-4 h-4" /> Permanent Account Deletion
          </button>
        ) : null}
      </div>

      <div className="pt-4 border-t border-border space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Cloud className="w-5 h-5 text-sky-500" /> Cloud Systems</h3>
        <div className="bg-secondary/30 rounded-xl p-4 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Connected Storages</span>
            <span className={`text-xs font-mono px-2 py-1 rounded ${cloudConnections.length > 0 ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-secondary text-muted-foreground'}`}>
              {cloudConnections.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Auto Sync</span>
            <span className="font-mono">{settings.cloudAutoSync ? 'Enabled' : 'Disabled'}</span>
          </div>
          <button
            onClick={() => setShowCloudSystems(true)}
            className="w-full py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20 transition-colors"
          >
            Manage Cloud Systems
          </button>
        </div>
      </div>
    </div>

    <div className="shrink-0 pt-4 mt-4 border-t border-border space-y-3">
      {onOpenAccountSwitcher ? (
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenAccountSwitcher();
          }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-secondary hover:bg-secondary/80 font-bold rounded-xl transition-colors border border-border"
        >
          <UserPlus className="w-4 h-4 text-primary" /> Add or Switch Account
        </button>
      ) : null}
      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 bg-secondary hover:bg-secondary/80 font-bold rounded-xl transition-colors border border-border"
      >
        <LogOut className="w-4 h-4" /> Log out
      </button>
    </div>

  </div>
</div>


      )}
      {showCloudSystems && (
        <ProfileCloudSystemsModal
          onClose={() => setShowCloudSystems(false)}
          onBack={() => {
            setShowCloudSystems(false);
            onOpenSettings();
          }}
        />
      )}
    </>
  );
}
