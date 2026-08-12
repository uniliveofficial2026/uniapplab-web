import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePlatformRuntime } from '../../lib/platform/usePlatformRuntime';
import {
  getInstallGuide,
  shouldShowInstallBanner,
  shouldShowPrivateDevIosHint,
} from '../../lib/platform/installGuide';
import { APP_DISPLAY_NAME, resolveAppBrandFallbackIcon } from '../../lib/appBrand';
import { isStandaloneDisplayMode } from '../../lib/pwaRegister';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'instacollab_pwa_install_dismissed';

export function PwaInstallPrompt() {
  const runtime = usePlatformRuntime();
  const guide = getInstallGuide(runtime);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);
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

  if (isStandaloneDisplayMode() || runtime.shell === 'standalone_pwa' || runtime.shell === 'native') {
    return null;
  }

  const privateDevHint = shouldShowPrivateDevIosHint(runtime);
  const bannerVisible =
    shouldShowInstallBanner(runtime) &&
    !dismissed &&
    (deferredPrompt != null ||
      guide.showAppleSteps ||
      runtime.capabilities.supportsBeforeInstallPrompt ||
      showSteps);

  if (!bannerVisible && !privateDevHint) return null;

  const dismiss = () => {
    setDismissed(true);
    setShowSteps(false);
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
    if (guide.showAppleSteps) {
      setShowSteps(true);
      return;
    }
    // Desktop Chromium without a captured BIP event — expand note.
    setShowSteps(true);
  };

  return (
    <>
      {bannerVisible ? (
        <div className="fixed bottom-[calc(58px+var(--app-safe-bottom))] left-3 right-3 z-[120] md:bottom-4 md:left-auto md:right-4 md:max-w-sm">
          <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <img
                  src={resolveAppBrandFallbackIcon()}
                  alt={`${APP_DISPLAY_NAME} logo`}
                  className="h-11 w-11 rounded-2xl object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{guide.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{guide.body}</p>
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

            {showSteps || (guide.showAppleSteps && !deferredPrompt) ? (
              <div className="mt-3 space-y-2 rounded-xl bg-secondary/80 px-3 py-2 text-xs text-foreground">
                {guide.steps ? (
                  <p className="flex items-start gap-2">
                    <Share className="mt-0.5 h-4 w-4 shrink-0" />
                    {guide.steps}
                  </p>
                ) : null}
                {guide.note ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{guide.note}</p>
                ) : null}
              </div>
            ) : guide.note && !deferredPrompt ? (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{guide.note}</p>
            ) : null}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void install()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground"
              >
                <Download className="h-4 w-4" />
                {deferredPrompt ? 'Install app' : guide.cta}
              </button>
              {guide.showAppleSteps && !showSteps ? (
                <button
                  type="button"
                  onClick={() => setShowSteps(true)}
                  className="rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  Steps
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {privateDevHint ? (
        <div className="fixed bottom-[calc(58px+var(--app-safe-bottom))] left-3 right-3 z-[120] md:bottom-4 md:left-auto md:right-4 md:max-w-sm">
          <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md">
            <p className="text-sm font-bold text-foreground">Local dev on iPhone/iPad</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Home screen install does not work reliably on local LAN URLs. Bookmark this page in Safari,
              or use <code className="rounded bg-secondary px-1 py-0.5">pnpm run mobile:preview</code> on
              your Mac for HTTPS install testing.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
