import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { getIosInstallInstructions, isIosDevice, isPwaInstallableHost, isPrivateDevHost, isStandaloneDisplayMode } from '../../lib/pwaRegister';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'instacollab_pwa_install_dismissed';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  });

  useEffect(() => {
    if (isStandaloneDisplayMode()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  if (isStandaloneDisplayMode()) {
    return null;
  }

  const installableHost = typeof window !== 'undefined' && isPwaInstallableHost();
  const privateDevHost = typeof window !== 'undefined' && isPrivateDevHost(window.location.hostname);
  const iosInstructions = getIosInstallInstructions();

  const visible =
    installableHost &&
    !dismissed &&
    (deferredPrompt != null || showIosHint || (isIosDevice() && !deferredPrompt));

  if (!visible && !(privateDevHost && isIosDevice())) return null;

  const dismiss = () => {
    setDismissed(true);
    setShowIosHint(false);
    window.localStorage.setItem(DISMISS_KEY, '1');
  };

  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      dismiss();
      return;
    }
    if (isIosDevice()) {
      setShowIosHint(true);
    }
  };

  return (
    <>
      {visible ? (
        <div className="fixed bottom-[calc(58px+env(safe-area-inset-bottom))] left-3 right-3 z-[120] md:bottom-4 md:left-auto md:right-4 md:max-w-sm">
          <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF3C00] text-sm font-black text-white">
                IC
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">Install InstaCollab</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Add to your home screen for full-screen mobile and desktop app experience.
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
                aria-label="Dismiss install prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {showIosHint ? (
              <div className="mt-3 space-y-2 rounded-xl bg-secondary/80 px-3 py-2 text-xs text-foreground">
                <p className="flex items-start gap-2">
                  <Share className="mt-0.5 h-4 w-4 shrink-0" />
                  {iosInstructions.steps}
                </p>
                {iosInstructions.note ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{iosInstructions.note}</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void install()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground"
              >
                <Download className="h-4 w-4" />
                Install app
              </button>
              {!showIosHint && isIosDevice() ? (
                <button
                  type="button"
                  onClick={() => setShowIosHint(true)}
                  className="rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  Install steps
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {privateDevHost && isIosDevice() && !isStandaloneDisplayMode() ? (
        <div className="fixed bottom-[calc(58px+env(safe-area-inset-bottom))] left-3 right-3 z-[120] md:bottom-4 md:left-auto md:right-4 md:max-w-sm">
          <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md">
            <p className="text-sm font-bold text-foreground">Local dev on iPhone/iPad</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Home screen install does not work reliably on local dev URLs. Bookmark this page in Safari, or use{' '}
              <code className="rounded bg-secondary px-1 py-0.5">pnpm run mobile:preview</code> on your Mac for install
              testing.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
