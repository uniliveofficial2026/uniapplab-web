import React, { useId, useRef, useState } from 'react';
import { ImagePlus, Link2, Trash2, Upload } from 'lucide-react';
import { AppNativeVideo } from '../common/AppNativeVideo';
import { fileToBase64 } from '../../lib/utils';

const MAX_BYTES = 20 * 1024 * 1024;
const FILE_ACCEPT =
  'image/*,image/svg+xml,video/*,.svg,.webp,.png,.jpg,.jpeg,.gif,.mp4,.webm,.mov';

export function isSplashAdVideoUrl(url: string): boolean {
  const value = url.trim().toLowerCase();
  if (!value) return false;
  return (
    value.startsWith('data:video/') ||
    value.includes('video') ||
    value.endsWith('.mp4') ||
    value.endsWith('.webm') ||
    value.endsWith('.mov') ||
    value.endsWith('.m4v')
  );
}

type Props = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  description?: string;
  onError?: (message: string) => void;
};

/**
 * Admin media picker for splash / launch ad screens.
 * Supports image or video upload (stored as data URL) plus optional remote URL.
 */
export function SplashAdMediaPicker({
  value,
  onChange,
  label = 'Splash / ad media',
  description = 'Upload an image or video for the launch splash ad screen.',
  onError,
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(() => Boolean(value && !value.startsWith('data:')));

  const hasMedia = value.trim().length > 0;
  const isVideo = hasMedia && isSplashAdVideoUrl(value);

  const reportError = (message: string) => {
    onError?.(message);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: message }));
  };

  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      reportError('Media must be under 20 MB');
      return;
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      reportError('Choose an image or video file');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToBase64(file);
      onChange(dataUrl);
      setShowUrl(false);
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: file.type.startsWith('video/') ? 'Splash ad video ready' : 'Splash ad image ready',
        }),
      );
    } catch {
      reportError('Could not read that file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3" data-splash-ad-media-picker="">
      <div>
        <p className="text-sm font-bold text-foreground">{label}</p>
        {description ? <p className="text-xs text-muted-foreground mt-0.5">{description}</p> : null}
      </div>

      <div className="rounded-2xl overflow-hidden border border-border bg-black/5 aspect-video relative">
        {hasMedia ? (
          isVideo ? (
            <AppNativeVideo src={value} className="w-full h-full object-contain bg-black" />
          ) : (
            <img src={value} alt="Splash ad preview" className="w-full h-full object-contain bg-black/10" />
          )
        ) : (
          <label
            htmlFor={inputId}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer text-muted-foreground hover:bg-black/5 transition-colors"
          >
            <ImagePlus className="w-8 h-8 opacity-70" />
            <span className="text-xs font-bold">Tap to upload image or video</span>
          </label>
        )}
        {hasMedia ? (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold uppercase tracking-wide">
            {isVideo ? 'Video' : 'Image'}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          ref={fileRef}
          type="file"
          accept={FILE_ACCEPT}
          className="hidden"
          onChange={(e) => void onPickFile(e)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl border border-border bg-background min-h-[44px] disabled:opacity-60"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Uploading…' : hasMedia ? 'Replace media' : 'Upload media'}
        </button>
        <button
          type="button"
          onClick={() => setShowUrl((v) => !v)}
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl border min-h-[44px] ${
            showUrl ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          {showUrl ? 'Hide URL' : 'Paste URL'}
        </button>
        {hasMedia ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setShowUrl(false);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl border border-border bg-background min-h-[44px] text-muted-foreground"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        ) : null}
      </div>

      {showUrl ? (
        <input
          value={value.startsWith('data:') ? '' : value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="https://… or leave blank after upload"
          className="w-full text-sm border border-border rounded-xl px-3 py-3 min-h-[44px] bg-background font-mono"
        />
      ) : null}
    </div>
  );
}
