import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { fileToBase64 } from '../../lib/utils';
import { compressAvatarDataUrl } from '../../lib/auth/cloudAvatar';
import { AppNativeVideo } from '../common/AppNativeVideo';
import { AppBrandIcon } from '../common/AppBrandIcon';
import { APP_BRAND_FALLBACK_ICON, APP_DISPLAY_NAME, resolveAppBrandFallbackIcon } from '../../lib/appBrand';
import { applyAppBrandToDocument, readAppBrandSnapshot } from '../../lib/appBrandRuntime';
import { publishPlatformAppBrand } from '../../lib/cloudSocial/platformAppBrandCloud';
import { UniLivesSplashBrand } from '../brand/UniLivesSplashBrand';

const SIZE_CLASS = {
  sm: 'h-16 w-16 text-lg',
  md: 'h-24 w-24 text-2xl',
  lg: 'h-32 w-32 text-3xl',
  xl: 'h-40 w-40 text-4xl',
  hero: 'h-48 w-48 text-5xl',
} as const;

const ICON_CLASS = {
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-9 h-9',
  xl: 'w-10 h-10',
  hero: 'w-12 h-12',
} as const;

const MAX_LOGO_BYTES = 8 * 1024 * 1024;

const LOGO_ACCEPT =
  'image/*,image/svg+xml,video/*,.svg,.webp,.png,.jpg,.jpeg,.gif,.mp4,.webm,.mov';

export type LaunchBrandMarkSize = keyof typeof SIZE_CLASS;

/** splash = launch splash artwork only; app = shell / PWA / favicon logo icon */
export type LaunchBrandMarkKind = 'splash' | 'app';

type LocalPreview = { logoUrl: string; mediaType: 'image' | 'video' };

export function LaunchBrandMark({
  size = 'lg',
  mark = 'app',
  allowUpload = false,
  showUploadHint = true,
  publishToPlatform = false,
  src,
}: {
  size?: LaunchBrandMarkSize;
  /** Splash artwork and app logo icon are separate assets. */
  mark?: LaunchBrandMarkKind;
  allowUpload?: boolean;
  showUploadHint?: boolean;
  /** App mark only: publish logo to platform backend */
  publishToPlatform?: boolean;
  /** App mark override URL */
  src?: string | null;
}) {
  const db = useDB();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [brandTick, setBrandTick] = useState(0);
  const [localPreview, setLocalPreview] = useState<LocalPreview | null>(null);
  const [picking, setPicking] = useState(false);

  const isSplashMark = mark === 'splash';
  const interactive = allowUpload;

  useEffect(() => {
    const refresh = () => setBrandTick((t) => t + 1);
    window.addEventListener('app-brand:updated', refresh);
    window.addEventListener('platform-app-brand-updated', refresh);
    window.addEventListener('splash-artwork:updated', refresh);
    return () => {
      window.removeEventListener('app-brand:updated', refresh);
      window.removeEventListener('platform-app-brand-updated', refresh);
      window.removeEventListener('splash-artwork:updated', refresh);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (localPreview?.logoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(localPreview.logoUrl);
      }
    };
  }, [localPreview]);

  void brandTick;
  void db.settings.splashArtworkUrl;
  void db.settings.splashArtworkMediaType;

  const resolved = readAppBrandSnapshot();
  const fallbackIcon = resolveAppBrandFallbackIcon();

  const splashStored =
    typeof db.settings.splashArtworkUrl === 'string' && db.settings.splashArtworkUrl.trim()
      ? db.settings.splashArtworkUrl.trim()
      : null;

  const appLogoUrl = localPreview?.logoUrl ?? src ?? resolved.logoUrl;
  const appMediaType = localPreview?.mediaType ?? resolved.mediaType;
  const splashPreviewUrl = isSplashMark ? localPreview?.logoUrl ?? splashStored : null;
  const splashPreviewVideo =
    isSplashMark &&
    (localPreview?.mediaType === 'video' ||
      (!localPreview && db.settings.splashArtworkMediaType === 'video'));

  const hasCustomAppLogo = Boolean(
    !isSplashMark &&
      appLogoUrl &&
      appLogoUrl !== APP_BRAND_FALLBACK_ICON &&
      appLogoUrl !== fallbackIcon &&
      !appLogoUrl.endsWith('/brand/app-logo.png'),
  );

  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      showToast('File must be under 8 MB');
      return;
    }

    const isVideoFile = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
    const nextMediaType: 'image' | 'video' = isVideoFile ? 'video' : 'image';
    const instantUrl = URL.createObjectURL(file);
    setLocalPreview((prev) => {
      if (prev?.logoUrl.startsWith('blob:')) URL.revokeObjectURL(prev.logoUrl);
      return { logoUrl: instantUrl, mediaType: nextMediaType };
    });
    setPicking(true);

    try {
      let dataUrl = await fileToBase64(file);
      if (nextMediaType === 'image' && dataUrl.startsWith('data:image/')) {
        dataUrl = await compressAvatarDataUrl(dataUrl);
      }

      if (isSplashMark) {
        try {
          db.updateSettings({
            splashArtworkUrl: dataUrl,
            splashArtworkMediaType: nextMediaType,
          });
        } catch {
          showToast('Could not save splash artwork (storage full).');
          setPicking(false);
          return;
        }
        setLocalPreview({ logoUrl: dataUrl, mediaType: nextMediaType });
        URL.revokeObjectURL(instantUrl);
        window.dispatchEvent(new CustomEvent('splash-artwork:updated'));
        showToast('Splash artwork updated (separate from app logo)');
        return;
      }

      try {
        db.updateSettings({
          appLogoUrl: dataUrl,
          appLogoMediaType: nextMediaType,
        });
      } catch {
        showToast('Could not save logo (storage full). Showing preview only.');
        setPicking(false);
        return;
      }
      if (publishToPlatform) {
        await publishPlatformAppBrand(dataUrl, nextMediaType);
      }
      setLocalPreview({ logoUrl: dataUrl, mediaType: nextMediaType });
      URL.revokeObjectURL(instantUrl);
      applyAppBrandToDocument({ logoUrl: dataUrl, mediaType: nextMediaType });
      window.dispatchEvent(new CustomEvent('app-brand:updated'));
      showToast(publishToPlatform ? 'App logo published for all users' : 'App logo updated');
    } catch {
      showToast('Could not load that file');
    } finally {
      setPicking(false);
    }
  };

  const box = SIZE_CLASS[size];

  let inner: React.ReactNode;
  if (isSplashMark) {
    if (splashPreviewUrl) {
      inner = splashPreviewVideo ? (
        <AppNativeVideo
          src={splashPreviewUrl}
          className="pointer-events-none h-full w-full object-cover"
          autoPlay
          muted
          loop
          aria-label="Splash artwork"
        />
      ) : (
        <img
          src={splashPreviewUrl}
          alt={`${APP_DISPLAY_NAME} splash`}
          className="pointer-events-none h-full w-full object-contain p-1"
          draggable={false}
        />
      );
    } else {
      inner = (
        <UniLivesSplashBrand
          className="pointer-events-none h-full w-full"
          imgClassName="pointer-events-none h-full w-full object-contain p-2"
          alt={APP_DISPLAY_NAME}
        />
      );
    }
  } else if (localPreview || src || hasCustomAppLogo) {
    const isVideo = Boolean(
      appLogoUrl && appMediaType === 'video' && appLogoUrl !== APP_BRAND_FALLBACK_ICON,
    );
    inner = isVideo ? (
      <AppNativeVideo
        src={appLogoUrl!}
        className="pointer-events-none h-full w-full object-cover"
        autoPlay
        muted
        loop
        aria-label="App logo"
      />
    ) : (
      <img
        src={appLogoUrl!}
        alt={APP_DISPLAY_NAME}
        className="pointer-events-none h-full w-full object-contain p-1"
        draggable={false}
      />
    );
  } else {
    inner = (
      <AppBrandIcon
        className="pointer-events-none h-full w-full p-1"
        roundedClassName="rounded-[1.5rem]"
        imageFit="contain"
      />
    );
  }

  const shellClass = [
    box,
    'relative rounded-[1.75rem] overflow-hidden shrink-0',
    'flex items-center justify-center',
    'bg-card border border-border shadow-xl shadow-black/10',
    interactive
      ? 'cursor-pointer ring-0 hover:ring-2 hover:ring-primary/40 focus-within:ring-2 focus-within:ring-primary/50 transition-shadow'
      : '',
    interactive && !(isSplashMark ? splashPreviewUrl : hasCustomAppLogo)
      ? 'border-2 border-dashed border-border'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const hint = isSplashMark ? 'Tap to upload splash art' : 'Tap to upload app logo';

  return (
    <div className="relative flex flex-col items-center gap-2">
      <label
        className={shellClass}
        title={interactive ? hint : undefined}
        aria-label={interactive ? hint : undefined}
      >
        {inner}
        {interactive ? (
          <>
            <div
              className={`pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/0 opacity-0 transition-opacity ${
                picking ? 'opacity-100 bg-black/35' : ''
              }`}
              aria-hidden
            >
              <ImagePlus className={`${ICON_CLASS[size]} text-white drop-shadow`} />
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={LOGO_ACCEPT}
              className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
              aria-label={isSplashMark ? 'Choose splash artwork' : 'Choose app logo'}
              disabled={picking}
              onChange={(e) => void onPickFile(e)}
            />
          </>
        ) : null}
      </label>
      {interactive && showUploadHint ? (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {picking ? 'Uploading…' : hint}
        </span>
      ) : null}
    </div>
  );
}
