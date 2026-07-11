import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { fileToBase64 } from '../../lib/utils';
import { compressAvatarDataUrl } from '../../lib/auth/cloudAvatar';
import { AppNativeVideo } from '../common/AppNativeVideo';
import { APP_BRAND_FALLBACK_ICON, APP_DISPLAY_NAME } from '../../lib/appBrand';
import { applyAppBrandToDocument, readAppBrandSnapshot } from '../../lib/appBrandRuntime';
import { publishPlatformAppBrand } from '../../lib/cloudSocial/platformAppBrandCloud';

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

type LocalPreview = { logoUrl: string; mediaType: 'image' | 'video' };

export function LaunchBrandMark({
  size = 'lg',
  allowUpload = false,
  showUploadHint = true,
  publishToPlatform = false,
  src,
}: {
  size?: LaunchBrandMarkSize;
  /** Tap container to pick image, SVG, or short video from device */
  allowUpload?: boolean;
  /** Show "Tap to upload logo" under the mark (off on compact centered layouts) */
  showUploadHint?: boolean;
  /** Admin portal: publish logo to platform backend for all users + install surfaces */
  publishToPlatform?: boolean;
  /** Override resolved logo URL */
  src?: string | null;
}) {
  const db = useDB();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [brandTick, setBrandTick] = useState(0);
  const [localPreview, setLocalPreview] = useState<LocalPreview | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const refresh = () => setBrandTick((t) => t + 1);
    window.addEventListener('app-brand:updated', refresh);
    window.addEventListener('platform-app-brand-updated', refresh);
    return () => {
      window.removeEventListener('app-brand:updated', refresh);
      window.removeEventListener('platform-app-brand-updated', refresh);
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
  const resolved = readAppBrandSnapshot();
  const logoUrl = localPreview?.logoUrl ?? src ?? resolved.logoUrl;
  const mediaType = localPreview?.mediaType ?? resolved.mediaType;
  const isVideo = Boolean(logoUrl && mediaType === 'video' && logoUrl !== APP_BRAND_FALLBACK_ICON);
  const hasCustomLogo = Boolean(logoUrl && logoUrl !== APP_BRAND_FALLBACK_ICON);

  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      showToast('Logo file must be under 8 MB');
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
  const interactive = allowUpload;

  const inner = hasCustomLogo ? (
    isVideo ? (
      <AppNativeVideo
        src={logoUrl!}
        className="pointer-events-none h-full w-full object-cover"
        autoPlay
        muted
        loop
        aria-label="App logo"
      />
    ) : (
      <img
        src={logoUrl!}
        alt={APP_DISPLAY_NAME}
        className="pointer-events-none h-full w-full object-contain p-1"
        draggable={false}
      />
    )
  ) : (
    <img
      src={APP_BRAND_FALLBACK_ICON}
      alt={APP_DISPLAY_NAME}
      className="pointer-events-none h-full w-full object-contain p-2"
      draggable={false}
    />
  );

  const shellClass = [
    box,
    'relative rounded-[1.75rem] overflow-hidden shrink-0',
    'flex items-center justify-center',
    'bg-card border border-border shadow-xl shadow-black/10',
    interactive
      ? 'cursor-pointer ring-0 hover:ring-2 hover:ring-primary/40 focus-within:ring-2 focus-within:ring-primary/50 transition-shadow'
      : '',
    interactive && !hasCustomLogo ? 'border-2 border-dashed border-border' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="relative flex flex-col items-center gap-2">
      <label
        className={shellClass}
        title={interactive ? 'Upload logo (image, SVG, or video)' : undefined}
        aria-label={interactive ? 'Upload app logo' : undefined}
      >
        {inner}
        {interactive ? (
          <>
            <div
              className={`pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:opacity-100 ${
                hasCustomLogo ? '' : 'bg-black/20 opacity-100'
              } ${picking ? 'opacity-100 bg-black/35' : ''}`}
              aria-hidden
            >
              <ImagePlus className={`${ICON_CLASS[size]} text-white drop-shadow`} />
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={LOGO_ACCEPT}
              className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
              aria-label="Choose logo image or video"
              disabled={picking}
              onChange={(e) => void onPickFile(e)}
            />
          </>
        ) : null}
      </label>
      {interactive && showUploadHint ? (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {picking ? 'Uploading…' : 'Tap to upload logo'}
        </span>
      ) : null}
    </div>
  );
}
