import { Plus, Music, Play } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { User } from '../../types';
import {
  handleMediaError,
  resolveEditorTextColorClass,
  themeAdaptiveTextStyle,
} from '../../lib/utils';
import { isPlayableAudioUrl } from '../../lib/audioMedia';
import {
  SelectedAudioStrip,
  hasSelectedAudio,
  type CustomAudioSelection,
} from '../common/AudioTrackPicker';
import { EditToolTabScroller } from '../common/EditToolTabScroller';
import { EditorToolTabs } from '../common/EditorToolTabs';
import { EditorToolPanels } from '../common/EditorToolPanels';
import {
  buildMediaEditorStyle,
  cropAspectClass,
  textAnimationClass,
  type MediaEditorAdjustments,
  type TextEditorExtras,
  type VideoEditorAdjustments,
  DEFAULT_MEDIA_EDITOR_ADJUSTMENTS,
  DEFAULT_TEXT_EDITOR_EXTRAS,
  DEFAULT_VIDEO_EDITOR_ADJUSTMENTS,
} from '../../lib/editorAdjustments';
import { editorToolsForMode, type EditorToolTabId } from '../../lib/editorTools';
import type { MediaFilterId } from '../../lib/mediaFilters';
import { BackgroundAudioPlayer } from '../common/BackgroundAudioPlayer';
import {
  CREATE_EDITOR_PREVIEW_MEDIA,
  CREATE_EDITOR_PREVIEW_PANE,
} from '../common/createEditorPreview';
import { PLAYBACK_PRIORITY } from '../../lib/playbackAudio';
import { ShellCreateCaptionPanel } from './ShellCreateCaptionPanel';

export type CreateMediaItem = {
  url: string;
  type: 'image' | 'video' | 'audio';
  name: string;
};

export type VideoEditTab = EditorToolTabId;

export interface ShellCreatePostEditorProps {
  createType: 'post' | 'reel' | 'text';
  currentUser: User;
  users: User[];
  uploadedMediaList: CreateMediaItem[];
  onUploadedMediaListChange: (list: CreateMediaItem[]) => void;
  activeMediaIndex: number;
  onActiveMediaIndexChange: (index: number) => void;
  uploadedIsVideo: boolean;
  caption: string;
  onCaptionChange: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
  showHashtagList: boolean;
  onShowHashtagListChange: (value: boolean) => void;
  showMentionList: boolean;
  onShowMentionListChange: (value: boolean) => void;
  mentionSearch: string;
  onMentionSearchChange: (value: string) => void;
  videoEditTab: VideoEditTab;
  onVideoEditTabChange: (tab: VideoEditTab) => void;
  textPostFont: string;
  onTextPostFontChange: (value: string) => void;
  textPostBg: string;
  onTextPostBgChange: (value: string) => void;
  textPostColor: string;
  onTextPostColorChange: (value: string) => void;
  textPostAlignment: string;
  onTextPostAlignmentChange: (value: string) => void;
  textPostSizeValue: number;
  onTextPostSizeValueChange: (value: number) => void;
  textPostSize: string;
  trimStart: number;
  onTrimStartChange: (value: number) => void;
  trimEnd: number;
  onTrimEndChange: (value: number) => void;
  brightness: number;
  onBrightnessChange: (value: number) => void;
  contrast: number;
  onContrastChange: (value: number) => void;
  textOverlay: string;
  onTextOverlayChange: (value: string) => void;
  textOverlaySize: number;
  textOverlayPos: number;
  onTextOverlayPosChange: (value: number) => void;
  audioTrack: string;
  onAudioTrackChange: (value: string) => void;
  backgroundAudio: CustomAudioSelection;
  onBackgroundAudioChange: (value: CustomAudioSelection) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  mediaAdjust?: MediaEditorAdjustments;
  onMediaAdjustChange?: (patch: Partial<MediaEditorAdjustments>) => void;
  videoAdjust?: VideoEditorAdjustments;
  onVideoAdjustChange?: (patch: Partial<VideoEditorAdjustments>) => void;
  textExtras?: TextEditorExtras;
  onTextExtrasChange?: (patch: Partial<TextEditorExtras>) => void;
  sticker?: string;
  onStickerChange?: (value: string) => void;
  stickerPos?: number;
  onStickerPosChange?: (value: number) => void;
  suggestedHashtags: string[];
  onResetCreatePost: () => void;
  onTriggerFileUpload: () => void;
}

export function ShellCreatePostEditor({
  createType,
  currentUser,
  users,
  uploadedMediaList,
  onUploadedMediaListChange,
  activeMediaIndex,
  onActiveMediaIndexChange,
  uploadedIsVideo,
  caption,
  onCaptionChange,
  location,
  onLocationChange,
  showHashtagList,
  onShowHashtagListChange,
  showMentionList,
  onShowMentionListChange,
  mentionSearch,
  onMentionSearchChange,
  videoEditTab,
  onVideoEditTabChange,
  textPostFont,
  onTextPostFontChange,
  textPostBg,
  onTextPostBgChange,
  textPostColor,
  onTextPostColorChange,
  textPostAlignment,
  onTextPostAlignmentChange,
  textPostSizeValue,
  onTextPostSizeValueChange,
  textPostSize,
  trimStart,
  onTrimStartChange,
  trimEnd,
  onTrimEndChange,
  brightness,
  onBrightnessChange,
  contrast,
  onContrastChange,
  textOverlay,
  onTextOverlayChange,
  textOverlaySize,
  textOverlayPos,
  onTextOverlayPosChange,
  audioTrack,
  onAudioTrackChange,
  backgroundAudio,
  onBackgroundAudioChange,
  filter,
  onFilterChange,
  mediaAdjust: mediaAdjustProp,
  onMediaAdjustChange,
  videoAdjust: videoAdjustProp,
  onVideoAdjustChange,
  textExtras: textExtrasProp,
  onTextExtrasChange,
  sticker = '',
  onStickerChange = () => {},
  stickerPos = 72,
  onStickerPosChange = () => {},
  suggestedHashtags,
  onResetCreatePost,
  onTriggerFileUpload,
}: ShellCreatePostEditorProps) {
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaAdjust = mediaAdjustProp ?? {
    ...DEFAULT_MEDIA_EDITOR_ADJUSTMENTS,
    brightness,
    contrast,
  };
  const videoAdjust = videoAdjustProp ?? DEFAULT_VIDEO_EDITOR_ADJUSTMENTS;
  const textExtras = textExtrasProp ?? DEFAULT_TEXT_EDITOR_EXTRAS;

  const activeItem =
    uploadedMediaList[activeMediaIndex] || {
      url: '',
      type: 'image' as const,
      name: '',
    };
  const soundtrackSelected = hasSelectedAudio(backgroundAudio, audioTrack);
  const filterStyle = buildMediaEditorStyle(filter, mediaAdjust);
  const editorMode: 'text' | 'photo' | 'video' =
    uploadedMediaList.length === 0 ? 'text' : uploadedIsVideo ? 'video' : 'photo';
  const editorTools = editorToolsForMode(editorMode);

  const toggleVideoEditTab = (tab: EditorToolTabId) => {
    onVideoEditTabChange(videoEditTab === tab ? 'none' : tab);
  };

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    video.playbackRate = videoAdjust.playbackSpeed;
    video.volume = videoAdjust.volume / 100;
  }, [videoAdjust.playbackSpeed, videoAdjust.volume, activeItem.url]);

  const clearSoundtrack = () => {
    onBackgroundAudioChange(null);
    onAudioTrackChange('none');
  };

  return (
    <div className="flex flex-col md:flex-row h-auto md:h-[620px] max-h-[85vh] overflow-y-auto no-scrollbar">
      <div className="flex-1 bg-secondary/30 border-b md:border-b-0 md:border-r border-border flex flex-col min-h-0 min-h-[280px] md:min-h-[360px]">
        <div className={`${CREATE_EDITOR_PREVIEW_PANE} group`}>
          {uploadedMediaList.length === 0 ? (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center p-8 pb-14 ${textPostBg} overflow-auto`}
            >
              <p
                className={`relative z-10 story-user-text editor-adaptive-text ${textPostFont} ${textPostAlignment} ${textPostSize} ${resolveEditorTextColorClass(textPostColor)} font-black break-words w-full ${textAnimationClass(textExtras.animation)}`}
                style={{
                  lineHeight: textExtras.lineHeight,
                  letterSpacing: `${textExtras.letterSpacing}px`,
                }}
              >
                {caption || 'Start typing...'}
              </p>
              {backgroundAudio?.url && isPlayableAudioUrl(backgroundAudio.url) && (
                <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-center pointer-events-auto">
                  <BackgroundAudioPlayer
                    audioUrl={backgroundAudio.url}
                    playbackId="editor:text-preview"
                    priority={PLAYBACK_PRIORITY.EDITOR}
                    showControls
                  />
                </div>
              )}
            </div>
          ) : activeItem.type === 'video' ? (
            <video
              ref={previewVideoRef}
              src={activeItem.url}
              style={filterStyle}
              className={`${CREATE_EDITOR_PREVIEW_MEDIA} ${cropAspectClass(mediaAdjust.cropAspect)}`}
              preload="auto"
              autoPlay
              loop
              muted={!!backgroundAudio?.url}
              playsInline
              controls
            />
          ) : activeItem.type === 'audio' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black">
              <div className="flex flex-col items-center justify-center p-6 bg-card border border-border shadow-md rounded-2xl w-full max-w-[280px] aspect-square relative z-10">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 relative overflow-hidden animate-pulse">
                  <Music className="w-10 h-10 animate-bounce" />
                  <div className="absolute inset-0 border-2 border-dashed border-primary/20 rounded-full animate-spin [animation-duration:10s]"></div>
                </div>
                <p className="font-bold text-sm text-center mb-1 max-w-[240px] truncate">
                  {activeItem.name || 'Audio Track'}
                </p>
                <p className="text-xs text-muted-foreground mb-4">Audio Playback Preview</p>
                <audio src={activeItem.url} controls className="w-full accent-primary focus:outline-none" />
              </div>
            </div>
          ) : (
            <img
              style={filterStyle}
              src={activeItem.url}
              className={`${CREATE_EDITOR_PREVIEW_MEDIA} ${cropAspectClass(mediaAdjust.cropAspect)}`}
              alt="Preview"
              onError={handleMediaError}
            />
          )}

          {mediaAdjust.vignette > 0 && uploadedMediaList.length > 0 && activeItem.type !== 'audio' && (
            <div
              className="pointer-events-none absolute inset-0 z-20"
              style={{
                background: `radial-gradient(ellipse at center, transparent ${100 - mediaAdjust.vignette}%, rgba(0,0,0,${mediaAdjust.vignette / 100}) 100%)`,
              }}
            />
          )}

          {sticker && uploadedMediaList.length > 0 && activeItem.type !== 'audio' && (
            <div
              className="absolute left-1/2 -translate-x-1/2 text-4xl pointer-events-none z-30 select-none drop-shadow-lg"
              style={{ top: `${stickerPos}%`, transform: 'translate(-50%, -50%)' }}
            >
              {sticker}
            </div>
          )}

          {backgroundAudio?.url &&
            isPlayableAudioUrl(backgroundAudio.url) &&
            uploadedMediaList.length > 0 && (
              <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-center pointer-events-auto">
                <BackgroundAudioPlayer
                  audioUrl={backgroundAudio.url}
                  playbackId="editor:media-preview"
                  priority={PLAYBACK_PRIORITY.EDITOR}
                  showControls
                />
              </div>
            )}

          {textOverlay.trim() && (
            <div
              style={{
                ...themeAdaptiveTextStyle(),
                fontSize: `${textOverlaySize}px`,
                top: `${textOverlayPos}%`,
                textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
              }}
              className="dark editor-overlay-text absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-black tracking-tight pointer-events-none z-30 select-none px-4 py-1.5 rounded bg-black/40 backdrop-blur-[2px] border border-white/10"
            >
              {textOverlay}
            </div>
          )}
        </div>

        {uploadedMediaList.length > 0 && (
          <div className="px-4 py-2 bg-background border-t border-border flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {uploadedMediaList.map((item, index) => (
              <div
                key={`thumb-${index}`}
                className={`relative w-14 h-14 rounded-lg overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 ${activeMediaIndex === index ? 'border-primary ring-2 ring-primary/20 scale-95' : 'border-muted hover:border-foreground/40'}`}
                onClick={() => {
                  onActiveMediaIndexChange(index);
                }}
              >
                {item.type === 'image' ? (
                  <img src={item.url} className="w-full h-full object-cover" alt="" />
                ) : item.type === 'video' ? (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-[10px] text-white">
                    <Play className="w-4 h-4 fill-white shrink-0" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center text-primary">
                    <Music className="w-5 h-5 shrink-0" />
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newList = uploadedMediaList.filter((_, i) => i !== index);
                    onUploadedMediaListChange(newList);
                    if (newList.length === 0) {
                      onResetCreatePost();
                    } else if (activeMediaIndex >= newList.length) {
                      onActiveMediaIndexChange(newList.length - 1);
                    }
                  }}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white text-[8px] font-black z-20"
                >
                  ×
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={onTriggerFileUpload}
              className="w-14 h-14 rounded-lg border-2 border-dashed border-muted hover:border-foreground/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-all flex-shrink-0"
              title="Add more files"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        )}

        <div
          className={`flex flex-col shrink-0 border-t border-border bg-background overflow-visible ${
            videoEditTab === 'filters' ? 'max-h-[min(360px,50vh)]' : 'max-h-[min(320px,45vh)]'
          }`}
        >
          <EditToolTabScroller
            scrollKey={`${createType}-${editorMode}-${editorTools.length}`}
            showHeader
            label="Tools"
          >
            <EditorToolTabs
              tools={editorTools}
              activeTab={videoEditTab}
              onToggle={toggleVideoEditTab}
              soundtrackSelected={soundtrackSelected}
            />
          </EditToolTabScroller>

          {soundtrackSelected && videoEditTab !== 'audio' && (
            <div className="px-3 py-2 shrink-0 border-b border-border/40">
              <SelectedAudioStrip
                customAudio={backgroundAudio}
                libraryTrackId={audioTrack}
                playbackId="editor:audio-strip-left"
                onEdit={() => onVideoEditTabChange('audio')}
                onRemove={clearSoundtrack}
              />
            </div>
          )}

          {videoEditTab !== 'none' && (
            <div
              className={`flex-1 min-h-0 overflow-y-auto p-3 bg-secondary/15 select-none overscroll-contain ${
                videoEditTab === 'filters'
                  ? 'overflow-x-visible min-h-[10.5rem]'
                  : videoEditTab === 'audio'
                    ? 'overflow-x-visible min-h-[8.5rem]'
                    : 'overflow-x-hidden'
              }`}
            >
              <EditorToolPanels
                activeTab={videoEditTab}
                mode={editorMode}
                previewMedia={
                  uploadedMediaList.length > 0 &&
                  (activeItem.type === 'image' || activeItem.type === 'video')
                    ? { url: activeItem.url, type: activeItem.type }
                    : null
                }
                filter={filter}
                onFilterChange={(id: MediaFilterId) => onFilterChange(id)}
                mediaAdjust={mediaAdjust}
                onMediaAdjustChange={(patch) => {
                  onMediaAdjustChange?.(patch);
                  if (patch.brightness !== undefined) onBrightnessChange(patch.brightness);
                  if (patch.contrast !== undefined) onContrastChange(patch.contrast);
                }}
                videoAdjust={videoAdjust}
                onVideoAdjustChange={(patch) => onVideoAdjustChange?.(patch)}
                textExtras={textExtras}
                onTextExtrasChange={(patch) => onTextExtrasChange?.(patch)}
                textPostFont={textPostFont}
                onTextPostFontChange={onTextPostFontChange}
                textPostBg={textPostBg}
                onTextPostBgChange={onTextPostBgChange}
                textPostColor={textPostColor}
                onTextPostColorChange={onTextPostColorChange}
                textPostAlignment={textPostAlignment}
                onTextPostAlignmentChange={onTextPostAlignmentChange}
                textPostSizeValue={textPostSizeValue}
                onTextPostSizeValueChange={onTextPostSizeValueChange}
                trimStart={trimStart}
                onTrimStartChange={onTrimStartChange}
                trimEnd={trimEnd}
                onTrimEndChange={onTrimEndChange}
                textOverlay={textOverlay}
                onTextOverlayChange={onTextOverlayChange}
                textOverlayPos={textOverlayPos}
                onTextOverlayPosChange={onTextOverlayPosChange}
                sticker={sticker}
                onStickerChange={onStickerChange}
                stickerPos={stickerPos}
                onStickerPosChange={onStickerPosChange}
                backgroundAudio={backgroundAudio}
                onBackgroundAudioChange={onBackgroundAudioChange}
                audioTrack={audioTrack}
                onAudioTrackChange={onAudioTrackChange}
              />
            </div>
          )}
        </div>
      </div>
      <ShellCreateCaptionPanel
        currentUser={currentUser}
        users={users}
        caption={caption}
        onCaptionChange={onCaptionChange}
        location={location}
        onLocationChange={onLocationChange}
        showHashtagList={showHashtagList}
        onShowHashtagListChange={onShowHashtagListChange}
        showMentionList={showMentionList}
        onShowMentionListChange={onShowMentionListChange}
        mentionSearch={mentionSearch}
        onMentionSearchChange={onMentionSearchChange}
        suggestedHashtags={suggestedHashtags}
        soundtrackSelected={soundtrackSelected}
        backgroundAudio={backgroundAudio}
        audioTrack={audioTrack}
        onEditSoundtrack={() => onVideoEditTabChange('audio')}
        onClearSoundtrack={clearSoundtrack}
      />
    </div>
  );
}
