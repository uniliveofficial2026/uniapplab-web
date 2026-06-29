import type { CSSProperties } from 'react';
import type { CustomAudioSelection } from '../common/AudioTrackPicker';
import {
  buildMediaEditorStyle,
  cropAspectClass,
  textAnimationClass,
  DEFAULT_MEDIA_EDITOR_ADJUSTMENTS,
  DEFAULT_TEXT_EDITOR_EXTRAS,
  DEFAULT_VIDEO_EDITOR_ADJUSTMENTS,
  type MediaEditorAdjustments,
  type TextEditorExtras,
  type VideoEditorAdjustments,
} from '../../lib/editorAdjustments';
import {
  THEME_ADAPTIVE_TEXT_CLASS,
  THEME_OVERLAY_COLOR,
} from '../../lib/themeText';

export type StoryCreatorStep = 'select' | 'edit' | 'preview';

export type StoryDraftMedia = {
  url: string;
  isVideo: boolean;
  caption?: string;
  isText?: boolean;
  textContent?: string;
  font?: string;
  textColor?: string;
  textBg?: string;
  textAlign?: string;
  textSizePx?: number;
  filter?: string;
  brightness?: number;
  contrast?: number;
  textOverlay?: string;
  textOverlayColor?: string;
  textOverlaySize?: number;
  textOverlayPos?: number;
  trimStart?: number;
  trimEnd?: number;
  audioTrack?: string;
  backgroundAudio?: CustomAudioSelection;
  mediaAdjust?: Partial<MediaEditorAdjustments>;
  videoAdjust?: Partial<VideoEditorAdjustments>;
  textExtras?: Partial<TextEditorExtras>;
  sticker?: string;
  stickerPos?: number;
  /** Unix ms or ISO string when the segment was shared. */
  createdAt?: number | string;
};

export function resolveDraftMediaAdjust(draft: StoryDraftMedia): MediaEditorAdjustments {
  return {
    ...DEFAULT_MEDIA_EDITOR_ADJUSTMENTS,
    brightness: draft.brightness ?? 100,
    contrast: draft.contrast ?? 100,
    ...draft.mediaAdjust,
  };
}

export function resolveDraftVideoAdjust(draft: StoryDraftMedia): VideoEditorAdjustments {
  return {
    ...DEFAULT_VIDEO_EDITOR_ADJUSTMENTS,
    ...draft.videoAdjust,
  };
}

export function resolveDraftTextExtras(draft: StoryDraftMedia): TextEditorExtras {
  return {
    ...DEFAULT_TEXT_EDITOR_EXTRAS,
    ...draft.textExtras,
  };
}

export const DEFAULT_MEDIA_STORY_DRAFT = (url: string, isVideo: boolean): StoryDraftMedia => ({
  url,
  isVideo,
  isText: false,
  caption: '',
  filter: 'none',
  brightness: 100,
  contrast: 100,
  textOverlay: '',
  textOverlayColor: THEME_OVERLAY_COLOR,
  textOverlaySize: 24,
  textOverlayPos: 50,
  trimStart: 0,
  trimEnd: 100,
  audioTrack: 'none',
  backgroundAudio: null,
});

export const DEFAULT_TEXT_STORY_DRAFT = (): StoryDraftMedia => ({
  url: '',
  isVideo: false,
  isText: true,
  textContent: '',
  font: 'font-sans',
  textColor: THEME_ADAPTIVE_TEXT_CLASS,
  textBg: 'bg-gradient-to-br from-indigo-500 to-purple-600',
  textAlign: 'text-center',
  textSizePx: 48,
  filter: 'none',
  brightness: 100,
  contrast: 100,
  audioTrack: 'none',
  backgroundAudio: null,
});

export function storyDraftFilterStyle(draft: StoryDraftMedia | null): CSSProperties {
  if (!draft || draft.isText) return {};
  return buildMediaEditorStyle(draft.filter ?? 'none', resolveDraftMediaAdjust(draft));
}
