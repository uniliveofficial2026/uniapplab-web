import React from 'react';
import { Camera } from 'lucide-react';
import { handleAvatarError } from '../../../lib/utils';
import { UniLivesAvatarPlaceholder } from './UniLivesAvatarPlaceholder';
import { keyboardSurfaceDataAttr } from '../../common/keyboardLayout';

type Props = {
  /** Preview URL from parent (base64 / remote / empty). */
  previewUrl?: string | null;
  /** Fallback when preview empty (e.g. current user avatar). */
  fallbackUrl?: string | null;
  onOpenPicker: () => void;
  onUploadClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  fileInputId: string;
  accept?: string;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploadLabel?: string;
};

/**
 * Visual avatar uploader chrome only.
 * Parent owns camera/file handlers, validation, and persistence.
 * Preserves circular control + hidden file input + upload text button.
 */
export function UniLivesAvatarUploader({
  previewUrl,
  fallbackUrl,
  onOpenPicker,
  onUploadClick,
  fileInputRef,
  fileInputId,
  accept = 'image/*,image/svg+xml,.svg,.webp',
  onFileChange,
  uploadLabel = 'Upload profile photo',
}: Props) {
  const src = (previewUrl || fallbackUrl || '').trim();

  return (
    <div className="flex flex-col items-center gap-3" data-unilives-avatar-uploader="">
      <button
        type="button"
        onClick={onOpenPicker}
        className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-[color:var(--color-unilives-profile-setup-border)] shadow-lg group bg-[color:var(--color-unilives-profile-setup-surface)]"
      >
        {src ? (
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            onError={handleAvatarError}
          />
        ) : (
          <UniLivesAvatarPlaceholder />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/35 transition-colors motion-reduce:transition-none">
          <Camera className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 drop-shadow" />
        </span>
      </button>
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        className="sr-only"
        accept={accept}
        aria-label="creator-avatar-file-input"
        {...keyboardSurfaceDataAttr}
        onChange={onFileChange}
      />
      <button
        type="button"
        onClick={onUploadClick}
        className="text-xs font-semibold text-[color:var(--color-unilives-primary)] cursor-pointer hover:underline"
      >
        {uploadLabel}
      </button>
    </div>
  );
}
