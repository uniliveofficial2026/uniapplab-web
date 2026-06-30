import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Trash2, UserPlus, X } from 'lucide-react';
import type { StoredDeviceAccount } from '../../lib/auth/deviceAccounts';
import { handleAvatarError } from '../../lib/utils';

export type AccountSwitcherModalProps = {
  open: boolean;
  accounts: StoredDeviceAccount[];
  activeUid?: string | null;
  linking?: boolean;
  cloudAuthEnabled?: boolean;
  onClose: () => void;
  onSelectAccount: (uid: string, password?: string) => void | Promise<void>;
  onRemoveAccount: (uid: string) => void;
  onLinkGoogle: () => void | Promise<void>;
  onSignInWithEmail: (email: string, password: string) => Promise<{ ok: boolean; reason?: string }>;
};

type PendingSwitch = {
  uid: string;
  email: string;
};

/**
 * Add / Switch account modal — UI ported from remix_-instacollab (ProfileScreen).
 * Reference: attached_assets/extracted/remix_-instacollab/src/components/profile/ProfileScreen.tsx
 */
export function AccountSwitcherModal({
  open,
  accounts,
  activeUid,
  linking = false,
  cloudAuthEnabled = false,
  onClose,
  onSelectAccount,
  onRemoveAccount,
  onLinkGoogle,
  onSignInWithEmail,
}: AccountSwitcherModalProps) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowEmailForm(false);
      setPendingSwitch(null);
      setEmail('');
      setPassword('');
      setEmailBusy(false);
    }
  }, [open]);

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      if (a.uid === activeUid) return -1;
      if (b.uid === activeUid) return 1;
      return String(b.linkedAt ?? '').localeCompare(String(a.linkedAt ?? ''));
    });
  }, [accounts, activeUid]);

  if (!open) return null;

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-secondary/40 border border-border text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30';

  const submitEmailSignIn = async (targetEmail: string, targetPassword: string) => {
    if (!targetEmail.trim() || !targetPassword) return;
    setEmailBusy(true);
    try {
      const result = await onSignInWithEmail(targetEmail.trim(), targetPassword);
      if (result.ok) {
        onClose();
        return;
      }
      if (result.reason) {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: result.reason }));
      }
    } finally {
      setEmailBusy(false);
    }
  };

  const submitSwitch = async () => {
    if (!pendingSwitch) return;
    setEmailBusy(true);
    try {
      await onSelectAccount(pendingSwitch.uid, password);
      onClose();
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2900] flex items-center justify-center p-4" data-app-overlay-root>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="w-full max-w-md bg-card border border-border rounded-[32px] p-6 relative z-10 pointer-events-auto shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4 shrink-0">
          <h3 className="text-lg font-black text-foreground">Add or Switch Account</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
            id="close-account-switcher"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {pendingSwitch ? (
          <div className="space-y-3 shrink-0">
            <p className="text-sm text-muted-foreground font-semibold">
              Sign in to switch to{' '}
              <span className="text-foreground">{pendingSwitch.email || 'this account'}</span>
            </p>
            <input
              type="email"
              value={pendingSwitch.email}
              readOnly
              className={`${inputClass} opacity-80`}
              id="account-switch-email"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className={inputClass}
              id="account-switch-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitSwitch();
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingSwitch(null);
                  setPassword('');
                }}
                className="flex-1 py-3 rounded-xl border border-border font-bold text-sm text-muted-foreground hover:bg-secondary/50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                disabled={emailBusy || !password}
                onClick={() => void submitSwitch()}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:opacity-95 disabled:opacity-60"
                id="btn-switch-account-email"
              >
                {emailBusy ? 'Signing in…' : 'Sign in & switch'}
              </button>
            </div>
            <button
              type="button"
              disabled={linking || emailBusy}
              onClick={async () => {
                setEmailBusy(true);
                try {
                  await onSelectAccount(pendingSwitch.uid);
                  onClose();
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Google sign-in failed.';
                  window.dispatchEvent(new CustomEvent('app-toast', { detail: message }));
                } finally {
                  setEmailBusy(false);
                }
              }}
              className="w-full text-xs font-bold text-primary hover:underline disabled:opacity-60"
            >
              Use Google account picker instead
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
              {sortedAccounts.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground font-semibold">
                  No accounts saved on this device yet.
                </div>
              ) : (
                sortedAccounts.map((acc, idx) => {
                  const isActive = acc.uid === activeUid;
                  return (
                    <div
                      key={`${acc.uid || idx}-${idx}`}
                      role="button"
                      tabIndex={isActive ? -1 : 0}
                      onClick={() => {
                        if (isActive) return;
                        if (cloudAuthEnabled) {
                          setPendingSwitch({ uid: acc.uid, email: acc.email ?? '' });
                          setPassword('');
                          return;
                        }
                        void onSelectAccount(acc.uid);
                      }}
                      onKeyDown={(e) => {
                        if (isActive) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (cloudAuthEnabled) {
                            setPendingSwitch({ uid: acc.uid, email: acc.email ?? '' });
                            setPassword('');
                          } else {
                            void onSelectAccount(acc.uid);
                          }
                        }
                      }}
                      className={`w-full p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer group ${
                        isActive
                          ? 'bg-primary/5 border-primary/35'
                          : 'bg-secondary/20 border-border hover:bg-secondary/50'
                      }`}
                      id={`account-item-${acc.uid}`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1">
                        <img
                          src={acc.photoURL || undefined}
                          alt=""
                          className={`w-10 h-10 rounded-full border object-cover ${isActive ? 'border-primary' : 'border-border'}`}
                          onError={handleAvatarError}
                        />
                        <div className="flex-1 truncate">
                          <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <span className="truncate">{acc.displayName}</span>
                            {isActive && (
                              <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">{acc.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Remove ${acc.displayName || 'this account'} from this device?`)) {
                              onRemoveAccount(acc.uid);
                            }
                          }}
                          className="p-2 rounded-xl bg-destructive/5 hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all"
                          title="Remove Account"
                          id={`remove-account-${acc.uid}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-border mt-4 shrink-0 space-y-3">
              {showEmailForm ? (
                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    autoComplete="email"
                    className={inputClass}
                    id="account-link-email"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    className={inputClass}
                    id="account-link-password"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitEmailSignIn(email, password);
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmailForm(false);
                        setEmail('');
                        setPassword('');
                      }}
                      className="flex-1 py-3 rounded-xl border border-border font-bold text-sm text-muted-foreground hover:bg-secondary/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={emailBusy || linking || !email.trim() || !password}
                      onClick={() => void submitEmailSignIn(email, password)}
                      className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:opacity-95 disabled:opacity-60"
                      id="btn-link-email-account"
                    >
                      {emailBusy ? 'Signing in…' : 'Sign in with Email'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={linking || emailBusy}
                    onClick={() => void onLinkGoogle()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-black rounded-xl hover:opacity-95 active:scale-[0.99] transition-all text-sm shadow-md shadow-primary/15 disabled:opacity-60 disabled:pointer-events-none"
                    id="btn-link-google-account"
                  >
                    <UserPlus className="w-4 h-4" />
                    {linking ? 'Opening Google…' : 'Add / Link Google Account'}
                  </button>
                  {cloudAuthEnabled && (
                    <button
                      type="button"
                      disabled={linking || emailBusy}
                      onClick={() => {
                        setShowEmailForm(true);
                        setEmail('');
                        setPassword('');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-secondary/50 text-foreground font-black rounded-xl hover:bg-secondary transition-all text-sm border border-border disabled:opacity-60"
                      id="btn-show-email-account-form"
                    >
                      <Mail className="w-4 h-4" />
                      Sign in with Email
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
