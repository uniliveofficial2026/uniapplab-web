import React, { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ImagePlus } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { fileToBase64 } from '../../lib/utils';
import { UniLivesOnboardingArtwork } from '../onboarding/brand/UniLivesOnboardingArtwork';
import { keyboardSurfaceDataAttr } from '../common/keyboardLayout';
import type { OnboardingStepKey } from '../onboarding/brand/onboardingResolve';

const MAX_BYTES = 12 * 1024 * 1024;
const FILE_ACCEPT =
  'image/*,image/svg+xml,video/*,.svg,.webp,.png,.jpg,.jpeg,.gif,.mp4,.webm,.mov';

export function OnboardingBackgroundUpload({
  slideIcon: SlideIcon,
  step,
}: {
  slideIcon: LucideIcon;
  /** Canonical onboarding step for registry artwork (visual only). */
  step: OnboardingStepKey;
}) {
  const db = useDB();
  const { showToast } = useToast();
  const inputId = useId();

  const bgUrl = (db.settings.onboardingBackgroundUrl as string | undefined) ?? null;
  const mediaType =
    (db.settings.onboardingBackgroundMediaType as 'image' | 'video' | undefined) ?? 'image';
  const isVideo = Boolean(bgUrl && mediaType === 'video');

  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      showToast('Background file must be under 12 MB');
      return;
    }
    try {
      const dataUrl = await fileToBase64(file);
      const isVideoFile = file.type.startsWith('video/');
      db.updateSettings({
        onboardingBackgroundUrl: dataUrl,
        onboardingBackgroundMediaType: isVideoFile ? 'video' : 'image',
      });
      showToast('Onboarding background updated');
    } catch {
      showToast('Could not load that file');
    }
  };

  return (
    <label
      htmlFor={inputId}
      className="group relative h-20 w-20 rounded-3xl bg-[color:var(--color-unilives-onboarding-surface)] flex items-center justify-center text-[color:var(--color-unilives-primary)] cursor-pointer overflow-hidden ring-0 hover:ring-2 hover:ring-[color:var(--color-unilives-primary)]/40 focus-within:ring-2 focus-within:ring-[color:var(--color-unilives-primary)]/50 transition-shadow"
      title="Choose image or video for full-screen background"
    >
      {bgUrl && !isVideo ? (
        <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        className={`relative z-[1] flex flex-col items-center justify-center gap-0.5 ${
          bgUrl ? 'text-white drop-shadow-md' : ''
        }`}
      >
        {bgUrl ? (
          <ImagePlus className="h-8 w-8 opacity-90 group-hover:scale-110 transition-transform" />
        ) : (
          <UniLivesOnboardingArtwork
            step={step}
            FallbackIcon={SlideIcon}
            className="relative h-20 w-20 flex items-center justify-center overflow-hidden bg-transparent"
            iconClassName="h-10 w-10"
          />
        )}
      </div>
      <div
        className={`absolute inset-0 z-[2] flex items-center justify-center bg-black/0 transition-colors ${
          bgUrl
            ? 'opacity-0 group-hover:opacity-100 group-hover:bg-black/40'
            : 'opacity-0 group-hover:opacity-100 group-hover:bg-[color:var(--color-unilives-primary)]/15'
        }`}
        aria-hidden
      >
        <ImagePlus
          className={`h-7 w-7 ${bgUrl ? 'text-white' : 'text-[color:var(--color-unilives-primary)]'}`}
        />
      </div>
      <input
        id={inputId}
        type="file"
        className="sr-only"
        accept={FILE_ACCEPT}
        aria-label="creator-onboarding-background-file"
        {...keyboardSurfaceDataAttr}
        onChange={(e) => void onPickFile(e)}
      />
      <span className="sr-only">Upload full-screen onboarding background</span>
    </label>
  );
}
