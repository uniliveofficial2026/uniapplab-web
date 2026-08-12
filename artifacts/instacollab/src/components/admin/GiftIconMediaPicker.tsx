import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Smile, X } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { GiftIcon, isGiftIconMediaUrl } from '../common/GiftIcon';

type GiftIconMediaPickerProps = {
  value: string;
  onChange: (icon: string) => void;
  onUploadImage: (file: File | null) => void | Promise<void>;
  uploading?: boolean;
};

/** Emoji + image media picker for Creation Studio gift icons. */
export function GiftIconMediaPicker({
  value,
  onChange,
  onUploadImage,
  uploading = false,
}: GiftIconMediaPickerProps) {
  const [openEmoji, setOpenEmoji] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openEmoji) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenEmoji(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenEmoji(false);
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [openEmoji]);

  return (
    <div ref={rootRef} className="relative block text-xs sm:col-span-2 space-y-2">
      <span className="font-bold text-muted-foreground">Icon (emoji or image)</span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-secondary/30 overflow-hidden shrink-0">
          <GiftIcon
            icon={value}
            className="text-2xl leading-none"
            imgClassName="h-10 w-10 object-contain"
          />
        </div>
        <input
          value={isGiftIconMediaUrl(value) ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isGiftIconMediaUrl(value) ? 'Custom image selected' : 'Emoji…'}
          disabled={isGiftIconMediaUrl(value)}
          className="min-w-0 flex-1 border border-border rounded-lg px-3 py-2 bg-background min-h-[40px] disabled:opacity-70"
        />
        <button
          type="button"
          onClick={() => setOpenEmoji((v) => !v)}
          className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border min-h-[40px] ${
            openEmoji ? 'border-primary bg-primary/10 text-primary' : 'border-border'
          }`}
        >
          <Smile className="w-3.5 h-3.5" /> Emoji
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg"
          className="hidden"
          onChange={(e) => {
            void onUploadImage(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px]"
        >
          <ImagePlus className="w-3.5 h-3.5" />
          {uploading ? 'Uploading…' : 'Upload image'}
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange('🎁')}
            className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-border min-h-[40px] text-muted-foreground"
            title="Reset icon"
          >
            <X className="w-3.5 h-3.5" /> Reset
          </button>
        ) : null}
      </div>
      {isGiftIconMediaUrl(value) ? (
        <p className="text-[10px] text-muted-foreground truncate font-mono">{value}</p>
      ) : null}

      {openEmoji ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <EmojiPicker
            onEmojiClick={(emoji) => {
              onChange(emoji.emoji);
              setOpenEmoji(false);
            }}
            width="100%"
            height={340}
            theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
            previewConfig={{ showPreview: false }}
            searchPlaceHolder="Search emoji"
          />
        </div>
      ) : null}
    </div>
  );
}
