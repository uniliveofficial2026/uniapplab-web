import React, { useEffect, useId, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { fileToBase64 } from '../../lib/utils';
import { AppNativeVideo } from '../common/AppNativeVideo';
import { APP_BRAND_FALLBACK_ICON, APP_DISPLAY_NAME } from '../../lib/appBrand';
import { readAppBrandSnapshot } from '../../lib/appBrandRuntime';
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
  const inputId = useId();
  const [, setBrandTick] = useState(0);

  useEffect(() => {
    const refresh = () => setBrandTick((t) => t + 1);
    window.addEventListener('app-brand:updated', refresh);
    window.addEventListener('platform-app-brand-updated', refresh);
    return () => {
      window.removeEventListener('app-brand:updated', refresh);
      window.removeEventListener('platform-app-brand-updated', refresh);
    };
  }, []);

  const resolved = readAppBrandSnapshot();
  const logoUrl = src ?? resolved.logoUrl;
  const mediaType = resolved.mediaType;
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
    try {
      const dataUrl = await fileToBase64(file);
      const isVideoFile = file.type.startsWith('video/');
      const nextMediaType = isVideoFile ? 'video' : 'image';
      db.updateSettings({
        appLogoUrl: dataUrl,
        appLogoMediaType: nextMediaType,
      });
      if (publishToPlatform) {
        await publishPlatformAppBrand(dataUrl, nextMediaType);
      }
      window.dispatchEvent(new CustomEvent('app-brand:updated'));
      showToast(publishToPlatform ? 'App logo published for all users' : 'App logo updated');
    } catch {
      showToast('Could not load that file');
    }
  };

  const box = SIZE_CLASS[size];
  const interactive = allowUpload;

  const inner = hasCustomLogo ? (
    isVideo ? (
      <AppNativeVideo
        src={logoUrl!}
        className="h-full w-full object-cover"
        autoPlay
        muted
        loop
        aria-label="App logo"
      />
    ) : (
      <img src={logoUrl!} alt={APP_DISPLAY_NAME} className="h-full w-full object-contain p-1" />
    )
  ) : (
    <img src={APP_BRAND_FALLBACK_ICON} alt={APP_DISPLAY_NAME} className="h-full w-full object-contain p-2" />
  );

  const shellClass = [
    box,
    'rounded-[1.75rem] overflow-hidden shrink-0',
    'flex items-center justify-center',
    'bg-card border border-border shadow-xl shadow-black/10',
    interactive
      ? 'cursor-pointer ring-0 hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 transition-shadow'
      : '',
    interactive && !hasCustomLogo ? 'border-2 border-dashed border-border' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <div className={`relative ${shellClass}`}>
      {inner}
      {interactive && (
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 hover:opacity-100 hover:bg-black/35 transition-opacity ${hasCustomLogo ? '' : 'opacity-100 bg-black/20'}`}
          aria-hidden
        >
          <ImagePlus className={`${ICON_CLASS[size]} text-white drop-shadow`} />
        </div>
      )}
    </div>
  );

  if (!interactive) {
    return <div className="relative">{body}</div>;
  }

  return (
    <div className="relative flex flex-col items-center gap-2">
      <label
        htmlFor={inputId}
        className="relative block rounded-[1.75rem] focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/50"
        title="Upload logo (image, SVG, or video)"
      >
        {body}
        <input
          id={inputId}
          type="file"
          className="sr-only"
          accept={LOGO_ACCEPT}
          onChange={(e) => void onPickFile(e)}
        />
      </label>
      {showUploadHint && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tap to upload logo
        </span>
      )}
    </div>
  );
}
