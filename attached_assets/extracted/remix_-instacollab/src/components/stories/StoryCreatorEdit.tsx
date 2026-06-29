import React, { useState } from 'react';
import {
  Send,
  Type,
  Wand2,
  Image as ImageIcon,
  LayoutDashboard,
  Music,
  Scissors,
  Plus,
} from 'lucide-react';
import { EditToolTabScroller } from '../common/EditToolTabScroller';
import {
  CREATE_EDITOR_PREVIEW_MEDIA,
  CREATE_EDITOR_PREVIEW_PANE,
} from '../common/createEditorPreview';
import {
  AudioTrackPicker,
  SelectedAudioStrip,
  hasSelectedAudio,
} from '../common/AudioTrackPicker';
import { MediaFilterPicker } from '../common/MediaFilterPicker';
import { BackgroundAudioPlayer } from '../common/BackgroundAudioPlayer';
import { isPlayableAudioUrl } from '../../lib/audioMedia';
import { PLAYBACK_PRIORITY } from '../../lib/playbackAudio';
import type { MediaFilterId } from '../../lib/mediaFilters';
import {
  type StoryDraftMedia,
  storyDraftFilterStyle,
} from './storyDraft';
import { StoryCaptionComposer } from './StoryCaptionComposer';
import type { User } from '../../types';
import {
  THEME_ADAPTIVE_TEXT_CLASS,
  normalizeEditorTextColorForSave,
  resolveEditorTextColorClass,
  resolveOverlayTextStyle,
} from '../../lib/themeText';

/** Fixed 9:16 story frame (not fluid / free-resize). */
export const STORY_PREVIEW_WIDTH_PX = 240;
export const STORY_PREVIEW_HEIGHT_PX = 427;
/** Smaller frame in create modal so editor tools (e.g. soundtrack) fit beside preview. */
export const STORY_PREVIEW_COMPACT_WIDTH_PX = 200;
export const STORY_PREVIEW_COMPACT_HEIGHT_PX = 356;

type MediaEditTab = 'none' | 'filters' | 'adjust' | 'text' | 'audio' | 'trim';
type TextEditTab = 'none' | 'font' | 'bg' | 'color' | 'align' | 'size' | 'audio';

const TEXT_BGS = [
  'bg-transparent',
  'backdrop-blur-xl bg-white/20',
  'bg-white',
  'bg-gradient-to-br from-indigo-500 to-purple-600',
  'bg-gradient-to-br from-teal-400 to-emerald-500',
  'bg-gradient-to-br from-orange-400 to-red-500',
  'bg-black',
];

const TEXT_COLOR_SWATCHES = [
  { bg: 'bg-white', label: 'Light preview' },
  { bg: 'bg-black', label: 'Dark preview' },
];

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
};

export function StoryDraftPreview({
  draft,
  frame = 'fluid',
  showCaptionPill = true,
}: StoryDraftPreviewProps) {
  const filterStyle = storyDraftFilterStyle(draft);
  const soundtrackUrl =
    draft.backgroundAudio?.url && isPlayableAudioUrl(draft.backgroundAudio.url)
      ? draft.backgroundAudio.url
      : null;
  const overlay = (draft.textOverlay ?? '').trim();

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
            className={`story-user-text editor-adaptive-text w-full break-words font-black leading-tight ${draft.font ?? 'font-sans'} ${draft.textAlign ?? 'text-center'} ${resolveEditorTextColorClass(draft.textColor)}`}
            style={{ fontSize: `${draft.textSizePx ?? 48}px` }}
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
          src={draft.url}
          className={CREATE_EDITOR_PREVIEW_MEDIA}
          style={filterStyle}
          autoPlay
          loop
          muted={!!soundtrackUrl}
          playsInline
          preload="auto"
        />
      ) : (
        <img
          src={draft.url}
          alt=""
          className={CREATE_EDITOR_PREVIEW_MEDIA}
          style={filterStyle}
        />
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
  const [mediaTab, setMediaTab] = useState<MediaEditTab>('filters');
  const [textTab, setTextTab] = useState<TextEditTab>('font');

  const patch = (partial: Partial<StoryDraftMedia>) => onChange({ ...draft, ...partial });

  const soundtrackSelected = hasSelectedAudio(
    draft.backgroundAudio ?? null,
    draft.audioTrack ?? 'none',
  );

  const toggleMediaTab = (tab: MediaEditTab) =>
    setMediaTab((t) => (t === tab ? 'none' : tab));

  const toggleTextTab = (tab: TextEditTab) =>
    setTextTab((t) => (t === tab ? 'none' : tab));

  const tabBtn = (
    active: boolean,
    onClick: () => void,
    label: string,
    icon: React.ReactNode,
    extra?: React.ReactNode,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 snap-start transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-secondary/50 text-foreground/70'
      }`}
    >
      {icon}
      {label}
      {extra}
    </button>
  );

  const soundtrackTabClass = (tab: MediaEditTab | TextEditTab, activeTab: string) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 snap-start text-xs font-bold ${
      activeTab === tab
        ? 'bg-primary/10 text-primary'
        : soundtrackSelected && tab === 'audio'
          ? 'bg-primary/5 text-primary ring-1 ring-primary/25'
          : 'hover:bg-secondary/50 text-foreground/70'
    }`;

  const activeTextTab = textTab;
  const activeMediaTab = mediaTab;
  const panelOpen = isText ? textTab !== 'none' : mediaTab !== 'none';

  const composerValue = isText ? draft.textContent ?? '' : draft.caption ?? '';
  const setComposerValue = (next: string) =>
    patch(isText ? { textContent: next } : { caption: next });

  const activeToolTab = isText ? textTab : mediaTab;
  const toolsMaxH =
    activeToolTab === 'filters'
      ? 'max-h-[min(360px,50vh)]'
      : activeToolTab === 'audio'
        ? 'max-h-[min(360px,50vh)]'
        : 'max-h-[min(320px,45vh)]';
  /** Edge-to-edge in create modal / standalone edit; fixed frame in fullscreen preview step */
  const previewFrame = layout === 'embedded' ? ('fill' as const) : ('fixed' as const);

  const editorTools = (
    <div
      id="story-edit-tools"
      className={`flex flex-col shrink-0 border-t border-border bg-background overflow-visible ${toolsMaxH}`}
    >
      <EditToolTabScroller
        scrollKey={isText ? 'text' : draft.isVideo ? 'media-video' : 'media'}
        showHeader
        label="Tools"
      >
          {isText ? (
            <>
              {tabBtn(
                activeTextTab === 'font',
                () => toggleTextTab('font'),
                'Font',
                <Type className="w-3.5 h-3.5" />,
              )}
              {tabBtn(
                activeTextTab === 'bg',
                () => toggleTextTab('bg'),
                'BG',
                <ImageIcon className="w-3.5 h-3.5" />,
              )}
              {tabBtn(
                activeTextTab === 'color',
                () => toggleTextTab('color'),
                'Color',
                <Type className="w-3.5 h-3.5" />,
              )}
              {tabBtn(
                activeTextTab === 'align',
                () => toggleTextTab('align'),
                'Align',
                <LayoutDashboard className="w-3.5 h-3.5" />,
              )}
              {tabBtn(
                activeTextTab === 'size',
                () => toggleTextTab('size'),
                'Size',
                <Type className="w-3.5 h-3.5" />,
              )}
              <button
                type="button"
                onClick={() => toggleTextTab('audio')}
                className={soundtrackTabClass('audio', activeTextTab)}
              >
                <Music className="w-3.5 h-3.5" />
                <span>Soundtrack</span>
                {soundtrackSelected && activeTextTab !== 'audio' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
                )}
              </button>
            </>
          ) : (
            <>
              {tabBtn(
                activeMediaTab === 'filters',
                () => toggleMediaTab('filters'),
                'Filters',
                <Wand2 className="w-3.5 h-3.5" />,
              )}
              {tabBtn(
                activeMediaTab === 'adjust',
                () => toggleMediaTab('adjust'),
                'Adjust',
                <Plus className="w-3.5 h-3.5 rotate-45" />,
              )}
              {tabBtn(
                activeMediaTab === 'text',
                () => toggleMediaTab('text'),
                'Text Overlay',
                <Type className="w-3.5 h-3.5" />,
              )}
              <button
                type="button"
                onClick={() => toggleMediaTab('audio')}
                className={soundtrackTabClass('audio', activeMediaTab)}
              >
                <Music className="w-3.5 h-3.5" />
                <span>Soundtrack</span>
                {soundtrackSelected && activeMediaTab !== 'audio' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
                )}
              </button>
              {draft.isVideo &&
                tabBtn(
                  activeMediaTab === 'trim',
                  () => toggleMediaTab('trim'),
                  'Trim',
                  <Scissors className="w-3.5 h-3.5" />,
                )}
            </>
          )}
      </EditToolTabScroller>

        {soundtrackSelected && (isText ? textTab : mediaTab) !== 'audio' && (
          <div className="shrink-0 px-3 py-2 border-b border-border/40">
            <SelectedAudioStrip
              customAudio={draft.backgroundAudio ?? null}
              libraryTrackId={draft.audioTrack ?? 'none'}
              playbackId="story-edit:audio-strip"
              onEdit={() => (isText ? setTextTab('audio') : setMediaTab('audio'))}
              onRemove={() => patch({ backgroundAudio: null, audioTrack: 'none' })}
            />
          </div>
        )}

        {panelOpen && (
          <div
            className={`flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 bg-secondary/15 select-none min-w-0 ${
              activeToolTab === 'filters'
                ? 'overflow-x-visible min-h-[10.5rem]'
                : activeToolTab === 'audio'
                  ? 'overflow-x-visible min-h-[8.5rem]'
                  : 'overflow-x-hidden'
            }`}
          >
            {/* —— Text story panels —— */}
            {isText && textTab === 'font' && (
              <div className="flex gap-2 flex-wrap">
                {['sans', 'serif', 'mono'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => patch({ font: `font-${f}` })}
                    className={`px-4 py-2 rounded-lg text-sm font-bold ${
                      draft.font === `font-${f}`
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {isText && textTab === 'bg' && (
              <div className="flex gap-2 flex-wrap">
                {TEXT_BGS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => patch({ textBg: b })}
                    className={`w-8 h-8 rounded-full ${b} border-2 ${
                      draft.textBg === b ? 'border-primary' : 'border-border'
                    }`}
                  />
                ))}
              </div>
            )}

            {isText && textTab === 'color' && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground">
                  Text follows the app theme (black in light mode, white in dark mode).
                </p>
                <div className="flex gap-2 flex-wrap">
                  {TEXT_COLOR_SWATCHES.map((item) => (
                    <button
                      key={item.bg}
                      type="button"
                      title={item.label}
                      onClick={() =>
                        patch({ textColor: normalizeEditorTextColorForSave(draft.textColor) })
                      }
                      className={`w-8 h-8 rounded-full border-2 ${item.bg} ${
                        resolveEditorTextColorClass(draft.textColor) === THEME_ADAPTIVE_TEXT_CLASS
                          ? 'border-primary'
                          : 'border-border'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {isText && textTab === 'align' && (
              <div className="flex gap-2">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => patch({ textAlign: `text-${a}` })}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize ${
                      draft.textAlign === `text-${a}`
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}

            {isText && textTab === 'size' && (
              <div className="space-y-1 px-0.5">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>Text Size</span>
                  <span>{draft.textSizePx ?? 48}px</span>
                </div>
                <input
                  type="range"
                  min={14}
                  max={72}
                  value={draft.textSizePx ?? 48}
                  onChange={(e) => patch({ textSizePx: parseInt(e.target.value, 10) })}
                  className="w-full accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            {isText && textTab === 'audio' && (
              <AudioTrackPicker
                customAudio={draft.backgroundAudio ?? null}
                onCustomAudioChange={(a) => patch({ backgroundAudio: a })}
                libraryTrackId={draft.audioTrack ?? 'none'}
                onLibraryTrackChange={(id) => patch({ audioTrack: id })}
                usage="story"
              />
            )}

            {/* —— Photo / video panels —— */}
            {!isText && mediaTab === 'filters' && (
              <div className="w-full min-w-0 max-w-full">
                <MediaFilterPicker
                  value={(draft.filter ?? 'none') as MediaFilterId}
                  onChange={(id: MediaFilterId) => patch({ filter: id })}
                  previewMedia={{
                    url: draft.url,
                    type: draft.isVideo ? 'video' : 'image',
                  }}
                  brightness={draft.brightness ?? 100}
                  contrast={draft.contrast ?? 100}
                />
              </div>
            )}

            {!isText && mediaTab === 'adjust' && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                    <span>Brightness</span>
                    <span>{draft.brightness ?? 100}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={150}
                    value={draft.brightness ?? 100}
                    onChange={(e) =>
                      patch({ brightness: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                    <span>Contrast</span>
                    <span>{draft.contrast ?? 100}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={150}
                    value={draft.contrast ?? 100}
                    onChange={(e) =>
                      patch({ contrast: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}

            {!isText && mediaTab === 'text' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draft.textOverlay ?? ''}
                    onChange={(e) => patch({ textOverlay: e.target.value })}
                    placeholder="Type overlay text (e.g. ME OUTDOORS! 🏔️)..."
                    className="flex-1 bg-background text-foreground border border-border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary"
                  />
                  {(draft.textOverlay ?? '').trim() && (
                    <button
                      type="button"
                      onClick={() => patch({ textOverlay: '' })}
                      className="text-xs text-destructive font-bold hover:underline shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {(draft.textOverlay ?? '').trim() && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground block">
                        Text color
                      </span>
                      <p className="text-[10px] text-muted-foreground leading-snug">
                        Overlay text uses theme contrast (black in light mode, white in dark mode).
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground block">
                        Vertical Position ({draft.textOverlayPos ?? 50}%)
                      </span>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        value={draft.textOverlayPos ?? 50}
                        onChange={(e) =>
                          patch({ textOverlayPos: parseInt(e.target.value, 10) })
                        }
                        className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isText && mediaTab === 'audio' && (
              <AudioTrackPicker
                customAudio={draft.backgroundAudio ?? null}
                onCustomAudioChange={(a) => patch({ backgroundAudio: a })}
                libraryTrackId={draft.audioTrack ?? 'none'}
                onLibraryTrackChange={(id) => patch({ audioTrack: id })}
                usage="story"
              />
            )}

            {!isText && mediaTab === 'trim' && draft.isVideo && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                  <span>Trim Start ({draft.trimStart ?? 0}%)</span>
                  <span>Trim End ({draft.trimEnd ?? 100}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold">0%</span>
                  <div className="flex-1 h-6 bg-secondary/85 rounded-md relative flex items-center">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/20 rounded-l-md"
                      style={{ width: `${draft.trimStart ?? 0}%` }}
                    />
                    <div
                      className="absolute inset-y-0 right-0 bg-primary/20 rounded-r-md"
                      style={{ width: `${100 - (draft.trimEnd ?? 100)}%` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={draft.trimStart ?? 0}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        patch({
                          trimStart: Math.min(v, (draft.trimEnd ?? 100) - 10),
                        });
                      }}
                      className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-full z-10"
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={draft.trimEnd ?? 100}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        patch({
                          trimEnd: Math.max(v, (draft.trimStart ?? 0) + 10),
                        });
                      }}
                      className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-full z-10"
                    />
                    <div
                      className="absolute h-full border-l-2 border-r-2 border-primary"
                      style={{
                        left: `${draft.trimStart ?? 0}%`,
                        right: `${100 - (draft.trimEnd ?? 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold">100%</span>
                </div>
              </div>
            )}
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
              onEdit={() => (isText ? setTextTab('audio') : setMediaTab('audio'))}
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
