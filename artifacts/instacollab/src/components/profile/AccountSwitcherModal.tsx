import React from 'react';
import { Trash2, UserPlus, X } from 'lucide-react';
import type { StoredDeviceAccount } from '../../lib/auth/deviceAccounts';
import { handleAvatarError } from '../../lib/utils';

export type AccountSwitcherModalProps = {
  open: boolean;
  accounts: StoredDeviceAccount[];
  activeUid?: string | null;
  linking?: boolean;
  onClose: () => void;
  onSelectAccount: (uid: string) => void | Promise<void>;
  onRemoveAccount: (uid: string) => void;
  onLinkGoogle: () => void | Promise<void>;
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
  onClose,
  onSelectAccount,
  onRemoveAccount,
  onLinkGoogle,
}: AccountSwitcherModalProps) {
  if (!open) return null;

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

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
          {accounts.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground font-semibold">
              No other accounts stored on this device.
            </div>
          ) : (
            accounts.map((acc, idx) => {
              const isActive = acc.uid === activeUid;
              return (
                <div
                  key={`${acc.uid || idx}-${idx}`}
                  role="button"
                  tabIndex={isActive ? -1 : 0}
                  onClick={async () => {
                    if (isActive) return;
                    await onSelectAccount(acc.uid);
                  }}
                  onKeyDown={(e) => {
                    if (isActive) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void onSelectAccount(acc.uid);
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
          <button
            type="button"
            disabled={linking}
            onClick={() => void onLinkGoogle()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-black rounded-xl hover:opacity-95 active:scale-[0.99] transition-all text-sm shadow-md shadow-primary/15 disabled:opacity-60 disabled:pointer-events-none"
            id="btn-link-google-account"
          >
            <UserPlus className="w-4 h-4" />
            {linking ? 'Opening Google…' : 'Add / Link New Google Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
