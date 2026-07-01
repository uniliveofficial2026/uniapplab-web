import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '../../types';
import { Camera, X, Type } from 'lucide-react';
import { ShareIcon } from '../common/ShareIcon';
import { detectMediaKind, processUploadFileAsUrl, handleAvatarError } from '../../lib/utils';
import { fileFromInput } from '../../lib/safe';
import { useDB } from '../../lib/useDB';
import { acquireMediaOverlayLock } from '../../lib/mediaOverlayLock';
import { useToast } from '../../lib/ToastContext';
import {
  DEFAULT_MEDIA_STORY_DRAFT,
  DEFAULT_TEXT_STORY_DRAFT,
  type StoryCreatorStep,
  type StoryDraftMedia,
} from './storyDraft';
import {
  normalizeEditorTextColorForSave,
  normalizeOverlayColorForSave,
} from '../../lib/themeText';
import { StoryCreatorEdit, StoryDraftPreview } from './StoryCreatorEdit';

export type { StoryCreatorStep, StoryDraftMedia } from './storyDraft';

export type StoryCreatorFlowProps = {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  layout?: 'embedded' | 'fullscreen';
  onClose?: () => void;
  onShared?: (segmentIndex: number) => void;
  showCloseButton?: boolean;
  onStepChange?: (step: StoryCreatorStep) => void;
  registerBackHandler?: (handler: () => void) => void;
  registerShareHandler?: (handler: () => void) => void;
};

export function StoryCreatorFlow({
  userId,
  username,
  displayName,
  avatarUrl,
  layout = 'fullscreen',
  onClose,
  onShared,
  showCloseButton,
  onStepChange,
  registerBackHandler,
  registerShareHandler,
}: StoryCreatorFlowProps) {
  const db = useDB();
  const { showToast } = useToast();
  const [step, setStep] = useState<StoryCreatorStep>('select');
  const [draftMedia, setDraftMedia] = useState<StoryDraftMedia | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const setStepAndNotify = useCallback(
    (next: StoryCreatorStep) => {
      setStep(next);
      onStepChange?.(next);
    },
    [onStepChange]
  );

  const resetDraft = useCallback(() => {
    setDraftMedia(null);
    setStepAndNotify('select');
  }, [setStepAndNotify]);

  const goBack = useCallback(() => {
    if (step === 'preview') {
      setStepAndNotify('edit');
      return;
    }
    if (step === 'edit') {
      resetDraft();
      return;
    }
    onClose?.();
  }, [step, setStepAndNotify, resetDraft, onClose]);

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  useEffect(() => {
    registerBackHandler?.(goBack);
  }, [registerBackHandler, goBack]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = fileFromInput(e.target.files);
    if (!file) return;
    try {
      const url = await processUploadFileAsUrl(file);
      const isVideo = detectMediaKind(file) === 'video';
      setDraftMedia(DEFAULT_MEDIA_STORY_DRAFT(url, isVideo));
      setStepAndNotify('edit');
    } catch {
      showToast('Error reading file');
    }
  };

  const startTextStory = () => {
    setDraftMedia(DEFAULT_TEXT_STORY_DRAFT());
    setStepAndNotify('edit');
  };

  const canShare = (): boolean => {
    if (!draftMedia) return false;
    if (draftMedia.isText) return !!(draftMedia.textContent || '').trim();
    return !!draftMedia.url;
  };

  const handleShareStory = useCallback(() => {
    if (!draftMedia || !canShare()) {
      showToast(draftMedia?.isText ? 'Add some text first' : 'Add media first');
      return;
    }
    const payload: StoryDraftMedia = {
      ...draftMedia,
      createdAt: Date.now(),
      textColor: normalizeEditorTextColorForSave(draftMedia.textColor),
      textOverlayColor: normalizeOverlayColorForSave(draftMedia.textOverlayColor),
      ...(draftMedia.isText
        ? {
            url: draftMedia.url || 'text',
            caption: draftMedia.textContent?.trim(),
          }
        : {}),
    };

    db.addStorySegment(userId, payload);
    const updatedSegments = db.getUserStorySegments(userId);
    const newIndex = Math.max(0, updatedSegments.length - 1);
    showToast('Story shared');
    resetDraft();
    onShared?.(newIndex);
    onClose?.();
  }, [draftMedia, db, userId, showToast, resetDraft, onShared, onClose]);

  useEffect(() => {
    registerShareHandler?.(handleShareStory);
  }, [registerShareHandler, handleShareStory]);

  const storyUser = useMemo<User>(
    () => ({
      id: userId,
      username,
      displayName: displayName ?? username,
      avatarUrl: avatarUrl ?? '',
    }),
    [userId, username, displayName, avatarUrl],
  );

  const isEmbedded = layout === 'embedded';
  const showClose = showCloseButton ?? !isEmbedded;
  const rootClass = isEmbedded
    ? step === 'select'
      ? 'relative flex flex-1 flex-col min-h-0 h-full w-full min-w-0 bg-background overflow-hidden'
      : 'relative flex flex-1 flex-col min-h-0 w-full min-w-0 bg-background overflow-hidden'
    : 'relative flex flex-col w-full h-full min-h-0 min-w-0 overflow-hidden bg-background';

  useEffect(() => {
    if (layout !== 'fullscreen') return;
    return acquireMediaOverlayLock();
  }, [layout]);

  return (
    <div
      className={rootClass}
      id={isEmbedded ? undefined : 'story-create-modal'}
      data-story-creator=""
    >
      {showClose && (
        <button
          type="button"
          onClick={goBack}
          className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-50 p-2 hover:bg-secondary rounded-full transition-colors text-foreground"
          aria-label={
            step === 'select' ? 'Close story creator' : 'Back'
          }
        >
          <X className="w-6 h-6 border border-border bg-background shadow-sm rounded-full" />
        </button>
      )}

      {step === 'select' && (
        <div
          className={`relative flex flex-1 flex-col items-center justify-center w-full min-h-0 h-full overflow-hidden px-6 sm:px-8 ${
            showClose ? 'pt-14 pb-8' : 'py-10 sm:py-12'
          }`}
        >
          <div
            className={`pointer-events-none absolute inset-0 z-0 ${
              isEmbedded
                ? 'bg-gradient-to-b from-primary/10 via-background to-background'
                : 'bg-gradient-to-b from-primary/10 to-transparent'
            }`}
          />
          <div className="relative z-10 flex flex-col items-center justify-center gap-16 sm:gap-20 w-full max-w-[min(100%,22rem)] mx-auto text-center">
            {isEmbedded && avatarUrl !== undefined && (
              <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 border-border shadow-xl shrink-0">
                <img
                  src={avatarUrl || undefined}
                  alt={username}
                  className="w-full h-full object-cover"
                  onError={handleAvatarError}
                />
              </div>
            )}
            <h2
              className={`text-foreground font-bold leading-tight ${
                isEmbedded ? 'text-xl' : 'text-2xl'
              }`}
            >
              Add to your story
            </h2>

            <div className="flex flex-nowrap items-start justify-center gap-10 sm:gap-12 w-full">
            <input
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              ref={cameraInputRef}
              onChange={handleFileChange}
            />
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => {
                if (!cameraInputRef.current) return;
                cameraInputRef.current.value = '';
                cameraInputRef.current.click();
              }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors">
                <Camera className="w-6 h-6" />
              </div>
              <span className="text-foreground text-sm font-semibold">Camera</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white hover:bg-primary/80 transition-colors">
                <span className="text-2xl font-bold">+</span>
              </div>
              <span className="text-foreground text-sm font-semibold">Gallery</span>
            </button>
            <button
              type="button"
              onClick={startTextStory}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-violet-600 flex items-center justify-center text-white hover:bg-violet-500 transition-colors shadow-md">
                <Type className="w-6 h-6" />
              </div>
              <span className="text-foreground text-sm font-semibold">Text</span>
            </button>
            </div>
          </div>
        </div>
      )}

      {step === 'edit' && draftMedia && (
        <StoryCreatorEdit
          draft={draftMedia}
          onChange={setDraftMedia}
          onContinue={() => setStepAndNotify('preview')}
          layout={layout}
          user={storyUser}
          showPreviewAction={!isEmbedded}
        />
      )}

      {step === 'preview' && draftMedia && (
        <div className="relative flex flex-1 flex-col min-h-0 w-full bg-black">
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            <StoryDraftPreview draft={draftMedia} />
          </div>
          <div className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2 bg-gradient-to-t from-black/80 to-transparent">
            <button
              type="button"
              onClick={() => setStepAndNotify('edit')}
              className="flex-1 py-3 rounded-full border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleShareStory}
              disabled={!canShare()}
              className="flex-1 py-3 rounded-full bg-white text-black font-bold text-sm shadow-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Share <ShareIcon size="xs" tone="inherit" className="text-black" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type StoryEmptyIntroProps = {
  username: string;
  avatarUrl?: string;
  onCreate: () => void;
  onClose: () => void;
};

export function StoryEmptyIntro({ username, avatarUrl, onCreate, onClose }: StoryEmptyIntroProps) {
  return (
    <div className="relative flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 left-4 z-50 p-2 hover:bg-secondary rounded-full transition-colors text-foreground"
      >
        <X className="w-6 h-6 border border-border bg-background shadow-sm rounded-full" />
      </button>

      <div className="absolute inset-0 z-0">
        <img
          src={avatarUrl || undefined}
          alt={username}
          className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-25 scale-110"
          onError={handleAvatarError}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-8 text-center">
        <div className="w-[88px] h-[88px] rounded-full overflow-hidden border-2 border-border mb-5 shadow-md">
          <img
            src={avatarUrl || undefined}
            alt={username}
            className="w-full h-full object-cover"
            onError={handleAvatarError}
          />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">No stories yet</h2>
        <p className="text-sm text-muted-foreground max-w-[260px] mb-8 leading-relaxed">
          Share a photo, video, or text story. Stories disappear after 24 hours.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="w-full max-w-[240px] py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90 transition-colors mb-3"
        >
          Create story
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
