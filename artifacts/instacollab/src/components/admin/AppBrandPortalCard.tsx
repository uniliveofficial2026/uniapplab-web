import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { LaunchBrandMark } from '../launch/LaunchBrandMark';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { APP_BRAND_FALLBACK_ICON, APP_DISPLAY_NAME, APP_TAGLINE } from '../../lib/appBrand';
import { readAppBrandSnapshot } from '../../lib/appBrandRuntime';
import { publishPlatformAppBrand } from '../../lib/cloudSocial/platformAppBrandCloud';

export function AppBrandPortalCard() {
  const db = useDB();
  const { showToast } = useToast();
  const brand = readAppBrandSnapshot();
  const hasLogo = Boolean(brand.logoUrl && brand.logoUrl !== APP_BRAND_FALLBACK_ICON);

  const clearLogo = () => {
    db.updateSettings({ appLogoUrl: null, appLogoMediaType: 'image' });
    void publishPlatformAppBrand(null, 'image');
    window.dispatchEvent(new CustomEvent('app-brand:updated'));
    showToast('App logo removed — default mark restored');
  };

  return (
    <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-border bg-secondary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-primary" /> App Logo & Brand
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Upload once — publishes to Supabase and Firebase and applies to splash, auth, shell
            header, PWA install prompt, home-screen icon, and every logo surface in {APP_DISPLAY_NAME}.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-black vibe-gradient-text">{APP_DISPLAY_NAME}</div>
          <div className="text-[10px] text-muted-foreground">{APP_TAGLINE}</div>
        </div>
      </div>

      <div className="p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
        <LaunchBrandMark size="lg" allowUpload showUploadHint publishToPlatform />

        <div className="flex-1 space-y-3 min-w-0">
          <p className="text-sm text-muted-foreground">
            Tap the mark to pick an image, SVG, or short video (max 8&nbsp;MB). Changes publish to
            Supabase and Firebase and sync to every user, browser tab icon, and install banner.
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Mobile &amp; tablet shell header</li>
            <li>Launch / splash &amp; sign-in screens</li>
            <li>Workspace admin portal preview</li>
            <li>PWA install banner &amp; home-screen icon</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            {hasLogo && (
              <button
                type="button"
                onClick={clearLogo}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-destructive/30 text-destructive text-xs font-bold hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove logo
              </button>
            )}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('app-brand:updated'))}
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
