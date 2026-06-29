import type { CSSProperties } from 'react';
import type { CustomAudioSelection } from '../common/AudioTrackPicker';
import { buildMediaFilterStyle } from '../../lib/mediaFilters';
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
};

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
  return buildMediaFilterStyle(draft.filter ?? 'none', {
    brightness: draft.brightness ?? 100,
    contrast: draft.contrast ?? 100,
  });
}
