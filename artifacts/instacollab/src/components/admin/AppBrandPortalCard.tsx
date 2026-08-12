import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { LaunchBrandMark } from '../launch/LaunchBrandMark';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { APP_BRAND_FALLBACK_ICON, APP_DISPLAY_NAME, APP_TAGLINE } from '../../lib/appBrand';
import { readAppBrandSnapshot } from '../../lib/appBrandRuntime';
import {
  ensurePlatformBrandPublishedFromSettings,
  publishPlatformAppBrand,
} from '../../lib/cloudSocial/platformAppBrandCloud';

export function AppBrandPortalCard() {
  const db = useDB();
  const { showToast } = useToast();
  const brand = readAppBrandSnapshot();
  const hasAppLogo = Boolean(
    brand.logoUrl &&
      brand.logoUrl !== APP_BRAND_FALLBACK_ICON &&
      !brand.logoUrl.endsWith('/brand/app-logo.png'),
  );
  const hasSplashArt = Boolean(
    typeof db.settings.splashArtworkUrl === 'string' && db.settings.splashArtworkUrl.trim(),
  );

  useEffect(() => {
    void ensurePlatformBrandPublishedFromSettings();
  }, [db.currentUserId, db.currentUser?.role, db.settings.appLogoUrl]);

  const clearAppLogo = () => {
    db.updateSettings({ appLogoUrl: null, appLogoMediaType: 'image' });
    void publishPlatformAppBrand(null, 'image');
    window.dispatchEvent(new CustomEvent('app-brand:updated'));
    showToast('App logo removed — default icon restored');
  };

  const clearSplashArt = () => {
    db.updateSettings({ splashArtworkUrl: null, splashArtworkMediaType: 'image' });
    window.dispatchEvent(new CustomEvent('splash-artwork:updated'));
    showToast('Splash artwork removed — default splash mark restored');
  };

  return (
    <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-border bg-secondary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-primary" /> Brand artwork
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Splash artwork and the app logo icon are <strong>separate</strong> assets. Changing one
            never replaces the other.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-black vibe-gradient-text">{APP_DISPLAY_NAME}</div>
          <div className="text-[10px] text-muted-foreground">{APP_TAGLINE}</div>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Splash artwork — launch splash only */}
        <div className="flex flex-col items-start gap-4">
          <div>
            <h3 className="text-sm font-black">Splash artwork</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Shown on the launch splash screen only. Not used as the shell / PWA icon.
            </p>
          </div>
          <LaunchBrandMark size="lg" mark="splash" allowUpload showUploadHint />
          <div className="flex flex-wrap gap-2">
            {hasSplashArt ? (
              <button
                type="button"
                onClick={clearSplashArt}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-destructive/30 text-destructive text-xs font-bold hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove splash art
              </button>
            ) : null}
          </div>
        </div>

        {/* App logo icon — shell / PWA / favicon */}
        <div className="flex flex-col items-start gap-4">
          <div>
            <h3 className="text-sm font-black">App logo icon</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Shell header, auth header, PWA install, home-screen icon, and tab favicon.
            </p>
          </div>
          <LaunchBrandMark size="lg" mark="app" allowUpload showUploadHint publishToPlatform />
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Mobile &amp; tablet shell header</li>
            <li>Sign-in header</li>
            <li>PWA install banner &amp; home-screen icon</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            {hasAppLogo ? (
              <button
                type="button"
                onClick={clearAppLogo}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-destructive/30 text-destructive text-xs font-bold hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove app logo
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('app-brand:updated'));
                window.dispatchEvent(new CustomEvent('splash-artwork:updated'));
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-bold hover:bg-secondary transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh displays
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
