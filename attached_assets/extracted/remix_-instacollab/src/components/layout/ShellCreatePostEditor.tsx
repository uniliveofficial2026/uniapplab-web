import {
  LayoutDashboard,
  Plus,
  Wand2,
  Scissors,
  Music,
  Type,
  Image,
  Play,
} from 'lucide-react';
import { User } from '../../types';
import {
  handleMediaError,
  THEME_ADAPTIVE_TEXT_CLASS,
  resolveEditorTextColorClass,
  themeAdaptiveTextStyle,
} from '../../lib/utils';
import { isPlayableAudioUrl } from '../../lib/audioMedia';
import {
  AudioTrackPicker,
  SelectedAudioStrip,
  hasSelectedAudio,
  type CustomAudioSelection,
} from '../common/AudioTrackPicker';
import { MediaFilterPicker } from '../common/MediaFilterPicker';
import { EditToolTabScroller } from '../common/EditToolTabScroller';
import { buildMediaFilterStyle, type MediaFilterId } from '../../lib/mediaFilters';
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

export type VideoEditTab =
  | 'none'
  | 'trim'
  | 'audio'
  | 'text'
  | 'cover'
  | 'filters'
  | 'adjust'
  | 'font'
  | 'bg'
  | 'align'
  | 'size'
  | 'color';

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
  suggestedHashtags,
  onResetCreatePost,
  onTriggerFileUpload,
}: ShellCreatePostEditorProps) {
  const activeItem =
    uploadedMediaList[activeMediaIndex] || {
      url: '',
      type: 'image' as const,
      name: '',
    };
  const soundtrackSelected = hasSelectedAudio(backgroundAudio, audioTrack);
  const soundtrackTabClass = (tab: VideoEditTab) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 text-xs font-bold ${
      videoEditTab === tab
        ? 'bg-primary/10 text-primary'
        : soundtrackSelected && tab === 'audio'
          ? 'bg-primary/5 text-primary ring-1 ring-primary/25'
          : 'hover:bg-secondary/50 text-muted-foreground'
    }`;
  const filterStyle = buildMediaFilterStyle(filter, { brightness, contrast });

  const toggleVideoEditTab = (tab: VideoEditTab) => {
    onVideoEditTabChange(videoEditTab === tab ? 'none' : tab);
  };

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
                className={`relative z-10 story-user-text editor-adaptive-text ${textPostFont} ${textPostAlignment} ${textPostSize} ${resolveEditorTextColorClass(textPostColor)} font-black break-words w-full`}
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
              src={activeItem.url}
              style={filterStyle}
              className={CREATE_EDITOR_PREVIEW_MEDIA}
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
              className={CREATE_EDITOR_PREVIEW_MEDIA}
              alt="Preview"
              onError={handleMediaError}
            />
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
            scrollKey={`${createType}-${uploadedMediaList.length === 0 ? 'text' : uploadedIsVideo ? 'video' : 'media'}`}
          >
            {uploadedMediaList.length === 0 ? (
              <>
                <button
                  onClick={() => toggleVideoEditTab('font')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 snap-start text-xs font-bold ${videoEditTab === 'font' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                >
                  <Type className="w-3.5 h-3.5" /> <span>Font</span>
                </button>
                <button
                  onClick={() => toggleVideoEditTab('bg')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 snap-start text-xs font-bold ${videoEditTab === 'bg' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                >
                  <Image className="w-3.5 h-3.5" /> <span>BG</span>
                </button>
                <button
                  onClick={() => toggleVideoEditTab('color')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 snap-start text-xs font-bold ${videoEditTab === 'color' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                >
                  <Type className="w-3.5 h-3.5" /> <span>Color</span>
                </button>
                <button
                  onClick={() => toggleVideoEditTab('align')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 snap-start text-xs font-bold ${videoEditTab === 'align' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" /> <span>Align</span>
                </button>
                <button
                  onClick={() => toggleVideoEditTab('size')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 snap-start text-xs font-bold ${videoEditTab === 'size' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                >
                  <Type className="w-3.5 h-3.5" /> <span>Size</span>
                </button>
                <button onClick={() => toggleVideoEditTab('audio')} className={`${soundtrackTabClass('audio')} snap-start`}>
                  <Music className="w-3.5 h-3.5" /> <span>Audio</span>
                  {soundtrackSelected && videoEditTab !== 'audio' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => toggleVideoEditTab('filters')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 snap-start text-xs font-bold ${videoEditTab === 'filters' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Filters</span>
                </button>
                <button
                  onClick={() => toggleVideoEditTab('adjust')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 snap-start text-xs font-bold ${videoEditTab === 'adjust' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                >
                  <Plus className="w-3.5 h-3.5 rotate-45" />
                  <span>Adjust</span>
                </button>
                <button
                  onClick={() => toggleVideoEditTab('text')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 snap-start text-xs font-bold ${videoEditTab === 'text' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Text Overlay</span>
                </button>
                <button onClick={() => toggleVideoEditTab('audio')} className={`${soundtrackTabClass('audio')} snap-start`}>
                  <Music className="w-3.5 h-3.5" />
                  <span>Soundtrack</span>
                  {soundtrackSelected && videoEditTab !== 'audio' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
                  )}
                </button>
                {uploadedIsVideo && (
                  <button
                    onClick={() => toggleVideoEditTab('trim')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 snap-start text-xs font-bold ${videoEditTab === 'trim' ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Trim</span>
                  </button>
                )}
              </>
            )}
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
              {videoEditTab === 'color' && (
                <div className="px-2 py-1 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground">
                    Text follows the app theme (black in light mode, white in dark mode).
                  </p>
                  <div className="flex gap-2 items-center">
                    {[
                      { bg: 'bg-white', label: 'Light preview' },
                      { bg: 'bg-black', label: 'Dark preview' },
                    ].map((item) => (
                      <button
                        key={item.bg}
                        type="button"
                        title={item.label}
                        onClick={() => onTextPostColorChange(THEME_ADAPTIVE_TEXT_CLASS)}
                        className={`w-8 h-8 rounded-full border-2 ${item.bg} ${
                          textPostColor === THEME_ADAPTIVE_TEXT_CLASS ||
                          resolveEditorTextColorClass(textPostColor) === THEME_ADAPTIVE_TEXT_CLASS
                            ? 'border-primary'
                            : 'border-border'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {videoEditTab === 'font' && (
                <div className="flex gap-2 px-2 py-1">
                  {['sans', 'serif', 'mono'].map((f) => (
                    <button
                      key={f}
                      onClick={() => onTextPostFontChange(`font-${f}`)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold ${textPostFont === `font-${f}` ? 'bg-primary text-white' : 'bg-secondary'}`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              )}

              {videoEditTab === 'bg' && (
                <div className="flex gap-2 px-2 py-1 flex-wrap">
                  {[
                    'bg-transparent',
                    'backdrop-blur-xl bg-white/20',
                    'bg-white',
                    'bg-gradient-to-br from-indigo-500 to-purple-600',
                    'bg-gradient-to-br from-teal-400 to-emerald-500',
                    'bg-gradient-to-br from-orange-400 to-red-500',
                    'bg-black',
                  ].map((b) => (
                    <button
                      key={b}
                      onClick={() => onTextPostBgChange(b)}
                      className={`w-8 h-8 rounded-full ${b} border-2 ${textPostBg === b ? 'border-primary' : 'border-border'}`}
                    />
                  ))}
                </div>
              )}

              {videoEditTab === 'align' && (
                <div className="flex gap-2 px-2 py-1">
                  {['left', 'center', 'right'].map((a) => (
                    <button
                      key={a}
                      onClick={() => onTextPostAlignmentChange(`text-${a}`)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold ${textPostAlignment === `text-${a}` ? 'bg-primary text-white' : 'bg-secondary'}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}

              {videoEditTab === 'size' && (
                <div className="px-2 py-1 space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <span>Text Size</span>
                    <span>{textPostSizeValue}px</span>
                  </div>
                  <input
                    type="range"
                    min="14"
                    max="72"
                    value={textPostSizeValue}
                    onChange={(e) => onTextPostSizeValueChange(parseInt(e.target.value))}
                    className="w-full accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}

              {videoEditTab === 'filters' && (
                <div className="w-full min-w-0 max-w-full">
                  <MediaFilterPicker
                    value={filter}
                    onChange={(id: MediaFilterId) => onFilterChange(id)}
                    previewMedia={
                      uploadedMediaList.length > 0 &&
                      (activeItem.type === 'image' || activeItem.type === 'video')
                        ? { url: activeItem.url, type: activeItem.type }
                        : null
                    }
                    brightness={brightness}
                    contrast={contrast}
                  />
                </div>
              )}

              {videoEditTab === 'adjust' && (
                <div className="space-y-2 px-2 py-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                      <span>Brightness</span>
                      <span>{brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={brightness}
                      onChange={(e) => onBrightnessChange(parseInt(e.target.value))}
                      className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                      <span>Contrast</span>
                      <span>{contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={contrast}
                      onChange={(e) => onContrastChange(parseInt(e.target.value))}
                      className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {videoEditTab === 'text' && (
                <div className="space-y-3 px-2 py-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={textOverlay}
                      onChange={(e) => onTextOverlayChange(e.target.value)}
                      placeholder="Type overlay text (e.g. ME OUTDOORS! 🏔️)..."
                      className="flex-1 bg-background text-foreground border border-border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary"
                    />
                    {textOverlay && (
                      <button
                        onClick={() => onTextOverlayChange('')}
                        className="text-xs text-destructive font-bold hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {textOverlay && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground block">Text color</span>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          Overlay text uses theme contrast (black in light mode, white in dark mode).
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground block">
                          Vertical Position ({textOverlayPos}%)
                        </span>
                        <input
                          type="range"
                          min="10"
                          max="90"
                          value={textOverlayPos}
                          onChange={(e) => onTextOverlayPosChange(parseInt(e.target.value))}
                          className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {videoEditTab === 'audio' && (
                <AudioTrackPicker
                  customAudio={backgroundAudio}
                  onCustomAudioChange={onBackgroundAudioChange}
                  libraryTrackId={audioTrack}
                  onLibraryTrackChange={onAudioTrackChange}
                />
              )}

              {videoEditTab === 'trim' && (
                <div className="space-y-1.5 px-2 py-1">
                  <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                    <span>Trim Start ({trimStart}%)</span>
                    <span>Trim End ({trimEnd}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold">0%</span>
                    <div className="flex-1 h-6 bg-secondary/85 rounded-md relative flex items-center">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/20 rounded-l-md"
                        style={{ width: `${trimStart}%` }}
                      ></div>
                      <div
                        className="absolute inset-y-0 right-0 bg-primary/20 rounded-r-md"
                        style={{ width: `${100 - trimEnd}%` }}
                      ></div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={trimStart}
                        onChange={(e) =>
                          onTrimStartChange(Math.min(parseInt(e.target.value), trimEnd - 10))
                        }
                        className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-full z-10"
                      />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={trimEnd}
                        onChange={(e) =>
                          onTrimEndChange(Math.max(parseInt(e.target.value), trimStart + 10))
                        }
                        className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-full z-10"
                      />
                      <div
                        className="absolute h-full border-l-2 border-r-2 border-primary"
                        style={{ left: `${trimStart}%`, right: `${100 - trimEnd}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] font-bold">100%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <ShellCreateCaptionPanel
        currentUser={currentUser}
        users={users}
        caption={caption}
        onCaptionChange={onCaptionChange}
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
