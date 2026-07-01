import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { EditToolTabScroller } from '../common/EditToolTabScroller';
import { EditorToolTabs } from '../common/EditorToolTabs';
import { EditorToolPanels } from '../common/EditorToolPanels';
import {
  CREATE_EDITOR_PREVIEW_MEDIA,
  CREATE_EDITOR_PREVIEW_PANE,
} from '../common/createEditorPreview';
import {
  SelectedAudioStrip,
  hasSelectedAudio,
} from '../common/AudioTrackPicker';
import { BackgroundAudioPlayer } from '../common/BackgroundAudioPlayer';
import { isPlayableAudioUrl } from '../../lib/audioMedia';
import { PLAYBACK_PRIORITY } from '../../lib/playbackAudio';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';
import type { MediaFilterId } from '../../lib/mediaFilters';
import { editorToolsForMode, type EditorToolTabId } from '../../lib/editorTools';
import {
  cropAspectClass,
  textAnimationClass,
} from '../../lib/editorAdjustments';
import {
  type StoryDraftMedia,
  storyDraftFilterStyle,
  resolveDraftMediaAdjust,
  resolveDraftTextExtras,
  resolveDraftVideoAdjust,
} from './storyDraft';
import { StoryCaptionComposer } from './StoryCaptionComposer';
import type { User } from '../../types';
import { useResolvedMediaUrl } from '../../hooks/useResolvedMediaUrl';
import {
  THEME_ADAPTIVE_TEXT_CLASS,
  resolveEditorTextColorClass,
  resolveOverlayTextStyle,
} from '../../lib/themeText';

/** Fixed 9:16 story frame (not fluid / free-resize). */
export const STORY_PREVIEW_WIDTH_PX = 240;
export const STORY_PREVIEW_HEIGHT_PX = 427;
/** Smaller frame in create modal so editor tools (e.g. soundtrack) fit beside preview. */
export const STORY_PREVIEW_COMPACT_WIDTH_PX = 200;
export const STORY_PREVIEW_COMPACT_HEIGHT_PX = 356;

type StoryCreatorEditProps = {
  draft: StoryDraftMedia;
  onChange: (draft: StoryDraftMedia) => void;
  onContinue: () => void;
  layout: 'embedded' | 'fullscreen';
  user: User;
  showPreviewAction?: boolean;
};

type StoryDraftPreviewProps = {
  draft: StoryDraftMedia;
  frame?: 'fixed' | 'compact' | 'fluid' | 'fill';
  showCaptionPill?: boolean;
  /** Live filter preview while browsing the filter strip (hover / touch). */
  filterPreviewId?: MediaFilterId | null;
};

export function StoryDraftPreview({
  draft,
  frame = 'fluid',
  showCaptionPill = true,
  filterPreviewId = null,
}: StoryDraftPreviewProps) {
  const filterStyle = storyDraftFilterStyle(draft, filterPreviewId);
  const mediaAdjust = resolveDraftMediaAdjust(draft);
  const textExtras = resolveDraftTextExtras(draft);
  const soundtrackUrl =
    draft.backgroundAudio?.url && isPlayableAudioUrl(draft.backgroundAudio.url)
      ? draft.backgroundAudio.url
      : null;
  const overlay = (draft.textOverlay ?? '').trim();

  const resolvedMediaUrl = useResolvedMediaUrl(!draft.isText ? draft.url : '');

  const isFillFrame = frame === 'fill';
  const isFixedFrame = frame === 'fixed' || frame === 'compact';
  const frameClass = isFillFrame
    ? `${CREATE_EDITOR_PREVIEW_PANE} absolute inset-0`
    : isFixedFrame
      ? 'relative shrink-0 rounded-2xl overflow-hidden border border-border shadow-lg bg-black'
      : 'relative mx-auto w-full max-w-[280px] aspect-[9/16] rounded-2xl overflow-hidden border border-border shadow-lg bg-black shrink-0';

  const frameSize =
    frame === 'compact'
      ? { width: STORY_PREVIEW_COMPACT_WIDTH_PX, height: STORY_PREVIEW_COMPACT_HEIGHT_PX }
      : frame === 'fixed'
        ? { width: STORY_PREVIEW_WIDTH_PX, height: STORY_PREVIEW_HEIGHT_PX }
        : undefined;

  return (
    <div className={frameClass} style={frameSize}>
      {draft.isText ? (
        <div
          className={`absolute inset-0 flex items-center justify-center p-6 ${draft.textBg ?? 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}
        >
          <p
            className={`story-user-text editor-adaptive-text w-full break-words font-black leading-tight ${draft.font ?? 'font-sans'} ${draft.textAlign ?? 'text-center'} ${resolveEditorTextColorClass(draft.textColor)} ${textAnimationClass(textExtras.animation)}`}
            style={{
              fontSize: `${draft.textSizePx ?? 48}px`,
              lineHeight: textExtras.lineHeight,
              letterSpacing: `${textExtras.letterSpacing}px`,
            }}
          >
            {draft.textContent?.trim() || 'Your story text…'}
          </p>
          {soundtrackUrl && (
            <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-center pointer-events-auto">
              <BackgroundAudioPlayer
                audioUrl={soundtrackUrl}
                playbackId="story-edit:text-preview"
                priority={PLAYBACK_PRIORITY.EDITOR}
                showControls
              />
            </div>
          )}
        </div>
      ) : draft.isVideo ? (
        <video
          src={resolvedMediaUrl || undefined}
          className={`${CREATE_EDITOR_PREVIEW_MEDIA} ${cropAspectClass(mediaAdjust.cropAspect)}`}
          style={filterStyle}
          autoPlay
          loop
          muted={!!soundtrackUrl}
          playsInline
          controls
          preload="auto"
          {...nativeVideoControlGuardProps()}
        />
      ) : (
        <img
          src={resolvedMediaUrl || undefined}
          alt=""
          className={`${CREATE_EDITOR_PREVIEW_MEDIA} ${cropAspectClass(mediaAdjust.cropAspect)}`}
          style={filterStyle}
        />
      )}

      {mediaAdjust.vignette > 0 && !draft.isText && (
        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            background: `radial-gradient(ellipse at center, transparent ${100 - mediaAdjust.vignette}%, rgba(0,0,0,${mediaAdjust.vignette / 100}) 100%)`,
          }}
        />
      )}

      {draft.sticker && !draft.isText && (
        <div
          className="absolute left-1/2 text-4xl pointer-events-none z-30 select-none drop-shadow-lg"
          style={{
            top: `${draft.stickerPos ?? 72}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {draft.sticker}
        </div>
      )}

      {overlay && !draft.isText && (
        <div
          style={{
            ...resolveOverlayTextStyle(draft.textOverlayColor),
            fontSize: `${draft.textOverlaySize ?? 24}px`,
            top: `${draft.textOverlayPos ?? 50}%`,
            textShadow:
              '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
          }}
          className="dark editor-overlay-text absolute left-1/2 z-20 max-w-[90%] -translate-x-1/2 -translate-y-1/2 text-center font-black tracking-tight pointer-events-none select-none px-3 py-1 rounded bg-black/40 backdrop-blur-[2px] border border-white/10"
        >
          {overlay}
        </div>
      )}

      {soundtrackUrl && !draft.isText && (
        <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-center pointer-events-auto">
          <BackgroundAudioPlayer
            audioUrl={soundtrackUrl}
            playbackId="story-edit:media-preview"
            priority={PLAYBACK_PRIORITY.EDITOR}
            showControls
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/40" />
      {showCaptionPill && (draft.caption || '').trim() && !draft.isText && (
        <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center px-3 pointer-events-none">
          <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            {draft.caption}
          </span>
        </div>
      )}
    </div>
  );
}

export function StoryCreatorEdit({
  draft,
  onChange,
  onContinue,
  layout,
  user,
  showPreviewAction = layout === 'fullscreen',
}: StoryCreatorEditProps) {
  const isText = !!draft.isText;
  const [toolTab, setToolTab] = useState<EditorToolTabId>(isText ? 'font' : 'filters');
  const [filterPreviewId, setFilterPreviewId] = useState<MediaFilterId | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setFilterPreviewId(null);
  }, [draft.url, draft.filter, toolTab]);

  const patch = (partial: Partial<StoryDraftMedia>) => onChange({ ...draft, ...partial });
  const mediaAdjust = resolveDraftMediaAdjust(draft);
  const videoAdjust = resolveDraftVideoAdjust(draft);
  const textExtras = resolveDraftTextExtras(draft);
  const editorMode: 'text' | 'photo' | 'video' = isText ? 'text' : draft.isVideo ? 'video' : 'photo';
  const editorToolsList = editorToolsForMode(editorMode);

  const toggleToolTab = (tab: EditorToolTabId) =>
    setToolTab((current) => (current === tab ? 'none' : tab));

  const soundtrackSelected = hasSelectedAudio(
    draft.backgroundAudio ?? null,
    draft.audioTrack ?? 'none',
  );

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    video.playbackRate = videoAdjust.playbackSpeed;
    video.volume = videoAdjust.volume / 100;
  }, [videoAdjust.playbackSpeed, videoAdjust.volume, draft.url, draft.isVideo]);

  const patchMediaAdjust = (adj: Partial<typeof mediaAdjust>) => {
    const next = { ...mediaAdjust, ...adj };
    patch({
      mediaAdjust: next,
      brightness: next.brightness,
      contrast: next.contrast,
    });
  };

  const composerValue = isText ? draft.textContent ?? '' : draft.caption ?? '';
  const setComposerValue = (next: string) =>
    patch(isText ? { textContent: next } : { caption: next });

  const toolsMaxH =
    toolTab === 'filters'
      ? 'max-h-[min(360px,50vh)]'
      : toolTab === 'audio'
        ? 'max-h-[min(360px,50vh)]'
        : 'max-h-[min(320px,45vh)]';
  const previewFrame = layout === 'embedded' ? ('fill' as const) : ('fixed' as const);

  const editorTools = (
    <div
      id="story-edit-tools"
      className={`flex flex-col shrink-0 border-t border-border bg-background overflow-visible ${toolsMaxH}`}
    >
      <EditToolTabScroller
        scrollKey={`${editorMode}-${editorToolsList.length}`}
        showHeader
        label="Tools"
      >
        <EditorToolTabs
          tools={editorToolsList}
          activeTab={toolTab}
          onToggle={toggleToolTab}
          soundtrackSelected={soundtrackSelected}
        />
      </EditToolTabScroller>

      {soundtrackSelected && toolTab !== 'audio' && (
        <div className="shrink-0 px-3 py-2 border-b border-border/40">
          <SelectedAudioStrip
            customAudio={draft.backgroundAudio ?? null}
            libraryTrackId={draft.audioTrack ?? 'none'}
            playbackId="story-edit:audio-strip"
            onEdit={() => setToolTab('audio')}
            onRemove={() => patch({ backgroundAudio: null, audioTrack: 'none' })}
          />
        </div>
      )}

      {toolTab !== 'none' && (
        <div
          className={`flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 bg-secondary/15 select-none min-w-0 ${
            toolTab === 'filters'
              ? 'overflow-x-visible min-h-[10.5rem]'
              : toolTab === 'audio'
                ? 'overflow-x-visible min-h-[8.5rem]'
                : 'overflow-x-hidden'
          }`}
        >
          <EditorToolPanels
            activeTab={toolTab}
            mode={editorMode}
            previewMedia={
              !isText
                ? { url: draft.url, type: draft.isVideo ? 'video' : 'image' }
                : null
            }
            filter={draft.filter ?? 'none'}
            onFilterChange={(id: MediaFilterId) => {
              setFilterPreviewId(null);
              patch({ filter: id });
            }}
            onFilterPreview={setFilterPreviewId}
            mediaAdjust={mediaAdjust}
            onMediaAdjustChange={patchMediaAdjust}
            videoAdjust={videoAdjust}
            onVideoAdjustChange={(adj) =>
              patch({ videoAdjust: { ...videoAdjust, ...adj } })
            }
            textExtras={textExtras}
            onTextExtrasChange={(adj) =>
              patch({ textExtras: { ...textExtras, ...adj } })
            }
            textPostFont={draft.font ?? 'font-sans'}
            onTextPostFontChange={(v) => patch({ font: v })}
            textPostBg={draft.textBg ?? 'bg-gradient-to-br from-indigo-500 to-purple-600'}
            onTextPostBgChange={(v) => patch({ textBg: v })}
            textPostColor={draft.textColor ?? THEME_ADAPTIVE_TEXT_CLASS}
            onTextPostColorChange={(v) => patch({ textColor: v })}
            textPostAlignment={draft.textAlign ?? 'text-center'}
            onTextPostAlignmentChange={(v) => patch({ textAlign: v })}
            textPostSizeValue={draft.textSizePx ?? 48}
            onTextPostSizeValueChange={(v) => patch({ textSizePx: v })}
            trimStart={draft.trimStart ?? 0}
            onTrimStartChange={(v) => patch({ trimStart: v })}
            trimEnd={draft.trimEnd ?? 100}
            onTrimEndChange={(v) => patch({ trimEnd: v })}
            textOverlay={draft.textOverlay ?? ''}
            onTextOverlayChange={(v) => patch({ textOverlay: v })}
            textOverlayPos={draft.textOverlayPos ?? 50}
            onTextOverlayPosChange={(v) => patch({ textOverlayPos: v })}
            sticker={draft.sticker ?? ''}
            onStickerChange={(v) => patch({ sticker: v })}
            stickerPos={draft.stickerPos ?? 72}
            onStickerPosChange={(v) => patch({ stickerPos: v })}
            backgroundAudio={draft.backgroundAudio ?? null}
            onBackgroundAudioChange={(a) => patch({ backgroundAudio: a })}
            audioTrack={draft.audioTrack ?? 'none'}
            onAudioTrackChange={(id) => patch({ audioTrack: id })}
            audioUsage="story"
          />
        </div>
      )}
    </div>
  );

  const editorLayoutClass =
    layout === 'embedded'
      ? 'flex flex-1 flex-col md:flex-row min-h-0 md:h-[620px] overflow-y-auto no-scrollbar w-full min-w-0'
      : 'flex flex-col md:flex-row h-auto md:h-[620px] max-h-[85vh] overflow-y-auto no-scrollbar w-full min-w-0 min-h-0';

  return (
    <div className={editorLayoutClass}>
      <div className="flex-1 min-w-0 w-full bg-secondary/30 border-b md:border-b-0 md:border-r border-border flex flex-col min-h-0 min-h-[280px] md:min-h-[360px]">
        <div className={CREATE_EDITOR_PREVIEW_PANE}>
          <StoryDraftPreview
            draft={draft}
            frame={previewFrame}
            showCaptionPill={false}
            filterPreviewId={filterPreviewId}
          />
        </div>
        {editorTools}
      </div>

      <div className="flex-1 min-w-0 w-full flex flex-col overflow-hidden min-h-0 min-h-[240px] md:min-h-0">
        {soundtrackSelected && (
          <div className="px-4 mb-3 shrink-0">
            <SelectedAudioStrip
              customAudio={draft.backgroundAudio ?? null}
              libraryTrackId={draft.audioTrack ?? 'none'}
              playbackId="story-edit:audio-strip-caption"
              onEdit={() => setToolTab('audio')}
              onRemove={() => patch({ backgroundAudio: null, audioTrack: 'none' })}
            />
          </div>
        )}
        <StoryCaptionComposer
          user={user}
          value={composerValue}
          onChange={setComposerValue}
          placeholder={
            isText ? 'Start typing your story…' : 'Write a caption...'
          }
        />
        {showPreviewAction && (
          <div className="shrink-0 p-3 border-t border-border bg-background">
            <button
              type="button"
              onClick={onContinue}
              className="w-full py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              Preview <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
