import React, { useId } from 'react';
import { ImagePlus } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { fileToBase64 } from '../../lib/utils';

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
  src,
}: {
  size?: LaunchBrandMarkSize;
  /** Tap container to pick image, SVG, or short video from device */
  allowUpload?: boolean;
  /** Show "Tap to upload logo" under the mark (off on compact centered layouts) */
  showUploadHint?: boolean;
  /** Override settings.appLogoUrl */
  src?: string | null;
}) {
  const db = useDB();
  const { showToast } = useToast();
  const inputId = useId();

  const logoUrl = src ?? (db.settings.appLogoUrl as string | undefined) ?? null;
  const mediaType = (db.settings.appLogoMediaType as 'image' | 'video' | undefined) ?? 'image';
  const isVideo = Boolean(logoUrl && mediaType === 'video');

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
      db.updateSettings({
        appLogoUrl: dataUrl,
        appLogoMediaType: isVideoFile ? 'video' : 'image',
      });
      showToast('App logo updated');
    } catch {
      showToast('Could not load that file');
    }
  };

  const box = SIZE_CLASS[size];
  const interactive = allowUpload;

  const inner = logoUrl ? (
    isVideo ? (
      <video
        src={logoUrl}
        className="h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        aria-label="App logo"
      />
    ) : (
      <img src={logoUrl} alt="InstaCollab" className="h-full w-full object-contain p-1" />
    )
  ) : (
  <span className="font-black text-white select-none">IC</span>
  );

  const shellClass = [
    box,
    'rounded-[1.75rem] overflow-hidden shrink-0',
    'flex items-center justify-center',
    logoUrl
      ? 'bg-card border border-border shadow-xl shadow-black/10'
      : 'bg-gradient-to-br from-[#fdf497] via-[#fd5949] to-[#d6249f] shadow-xl shadow-vibe-pink/30',
    interactive
      ? 'cursor-pointer ring-0 hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 transition-shadow'
      : '',
    interactive && !logoUrl ? 'border-2 border-dashed border-white/40' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <div className={`relative ${shellClass}`}>
      {inner}
      {interactive && (
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 hover:opacity-100 hover:bg-black/35 transition-opacity ${logoUrl ? '' : 'opacity-100 bg-black/20'}`}
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
