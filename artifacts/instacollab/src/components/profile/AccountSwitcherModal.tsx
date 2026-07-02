import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Trash2, UserPlus, X } from 'lucide-react';
import type { StoredDeviceAccount } from '../../lib/auth/deviceAccounts';
import { handleAvatarError } from '../../lib/utils';
import { EmailOtpPanel } from '../auth/EmailOtpPanel';

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
  onSendEmailOtp?: (
    email: string,
    mode: 'signin' | 'signup',
    profile?: { displayName?: string; username?: string },
  ) => Promise<{ ok: boolean; reason?: string }>;
  onVerifyEmailOtp?: (email: string, code: string) => Promise<{ ok: boolean; reason?: string }>;
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
  onSendEmailOtp,
  onVerifyEmailOtp,
}: AccountSwitcherModalProps) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin');
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);

  useEffect(() => {
    if (!open) {
      setShowEmailForm(false);
      setEmailMode('signin');
      setPendingSwitch(null);
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

        {pendingSwitch && cloudAuthEnabled && onSendEmailOtp && onVerifyEmailOtp ? (
          <div className="space-y-3 shrink-0">
            <p className="text-sm text-muted-foreground font-semibold">
              Enter the code sent to{' '}
              <span className="text-foreground">{pendingSwitch.email || 'this account'}</span>
            </p>
            <EmailOtpPanel
              mode="signin"
              initialEmail={pendingSwitch.email}
              busy={linking}
              showModeToggle={false}
              showSignupFields={false}
              inputClass={inputClass}
              onSendOtp={async (email, mode) =>
                onSendEmailOtp(email, mode, undefined)
              }
              onVerifyOtp={onVerifyEmailOtp}
              onVerified={() => {
                window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Switched account!' }));
                onClose();
              }}
            />
            <button
              type="button"
              onClick={() => setPendingSwitch(null)}
              className="w-full text-xs font-bold text-muted-foreground hover:underline"
            >
              Back to account list
            </button>
            <button
              type="button"
              disabled={linking}
              onClick={async () => {
                try {
                  await onSelectAccount(pendingSwitch.uid);
                  onClose();
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Google sign-in failed.';
                  window.dispatchEvent(new CustomEvent('app-toast', { detail: message }));
                }
              }}
              className="w-full text-xs font-bold text-primary hover:underline disabled:opacity-60"
            >
              Use Google account picker instead
            </button>
          </div>
        ) : pendingSwitch ? (
          <div className="space-y-3 shrink-0">
            <p className="text-sm text-muted-foreground font-semibold">
              Password sign-in for{' '}
              <span className="text-foreground">{pendingSwitch.email || 'this account'}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Cloud accounts use email codes. Go back and use &quot;Sign in with Email code&quot;.
            </p>
            <button
              type="button"
              onClick={() => setPendingSwitch(null)}
              className="w-full py-3 rounded-xl border border-border font-bold text-sm text-muted-foreground hover:bg-secondary/50"
            >
              Back
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
              {showEmailForm && onSendEmailOtp && onVerifyEmailOtp ? (
                <div className="space-y-3">
                  <EmailOtpPanel
                    mode={emailMode}
                    onModeChange={setEmailMode}
                    busy={linking}
                    showSignupFields={emailMode === 'signup'}
                    inputClass={inputClass}
                    onSendOtp={onSendEmailOtp}
                    onVerifyOtp={onVerifyEmailOtp}
                    onVerified={() => {
                      window.dispatchEvent(
                        new CustomEvent('app-toast', {
                          detail: emailMode === 'signup' ? 'Account created!' : 'Signed in!',
                        }),
                      );
                      onClose();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailForm(false)}
                    className="w-full py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-secondary/50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={linking}
                    onClick={() => void onLinkGoogle()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-black rounded-xl hover:opacity-95 active:scale-[0.99] transition-all text-sm shadow-md shadow-primary/15 disabled:opacity-60 disabled:pointer-events-none"
                    id="btn-link-google-account"
                  >
                    <UserPlus className="w-4 h-4" />
                    {linking ? 'Opening Google…' : 'Add / Link Google Account'}
                  </button>
                  {cloudAuthEnabled && onSendEmailOtp && onVerifyEmailOtp && (
                    <button
                      type="button"
                      disabled={linking}
                      onClick={() => {
                        setShowEmailForm(true);
                        setEmailMode('signin');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-secondary/50 text-foreground font-black rounded-xl hover:bg-secondary transition-all text-sm border border-border disabled:opacity-60"
                      id="btn-show-email-account-form"
                    >
                      <Mail className="w-4 h-4" />
                      Sign in with Email code
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
