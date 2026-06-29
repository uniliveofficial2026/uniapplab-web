import React from 'react';
import {
  THEME_ADAPTIVE_TEXT_CLASS,
  resolveEditorTextColorClass,
} from '../../lib/utils';
import {
  type CropAspectId,
  type MediaEditorAdjustments,
  type TextEditorExtras,
  type VideoEditorAdjustments,
} from '../../lib/editorAdjustments';
import type { EditorToolTabId } from '../../lib/editorTools';
import type { MediaFilterId } from '../../lib/mediaFilters';
import {
  AudioTrackPicker,
  type CustomAudioSelection,
} from './AudioTrackPicker';
import { MediaFilterPicker } from './MediaFilterPicker';

const TEXT_BGS = [
  'bg-transparent',
  'backdrop-blur-xl bg-white/20',
  'bg-white',
  'bg-gradient-to-br from-indigo-500 to-purple-600',
  'bg-gradient-to-br from-teal-400 to-emerald-500',
  'bg-gradient-to-br from-orange-400 to-red-500',
  'bg-black',
];

const TEXT_TEMPLATES = [
  { id: 'minimal', label: 'Minimal', font: 'font-sans', bg: 'bg-white', align: 'text-center' },
  { id: 'neon', label: 'Neon', font: 'font-mono', bg: 'bg-gradient-to-br from-indigo-500 to-purple-600', align: 'text-center' },
  { id: 'editorial', label: 'Editorial', font: 'font-serif', bg: 'bg-black', align: 'text-left' },
  { id: 'sunset', label: 'Sunset', font: 'font-sans', bg: 'bg-gradient-to-br from-orange-400 to-red-500', align: 'text-center' },
];

const STICKER_EMOJIS = ['🔥', '✨', '💯', '🎉', '❤️', '😂', '🏔️', '📸', '🎵', '⭐', '👀', '🚀'];

export type EditorToolPanelsProps = {
  activeTab: EditorToolTabId;
  mode: 'text' | 'photo' | 'video';
  previewMedia?: { url: string; type: 'image' | 'video' } | null;
  filter: string;
  onFilterChange: (id: MediaFilterId) => void;
  mediaAdjust: MediaEditorAdjustments;
  onMediaAdjustChange: (patch: Partial<MediaEditorAdjustments>) => void;
  videoAdjust: VideoEditorAdjustments;
  onVideoAdjustChange: (patch: Partial<VideoEditorAdjustments>) => void;
  textExtras: TextEditorExtras;
  onTextExtrasChange: (patch: Partial<TextEditorExtras>) => void;
  textPostFont: string;
  onTextPostFontChange: (v: string) => void;
  textPostBg: string;
  onTextPostBgChange: (v: string) => void;
  textPostColor: string;
  onTextPostColorChange: (v: string) => void;
  textPostAlignment: string;
  onTextPostAlignmentChange: (v: string) => void;
  textPostSizeValue: number;
  onTextPostSizeValueChange: (v: number) => void;
  trimStart: number;
  onTrimStartChange: (v: number) => void;
  trimEnd: number;
  onTrimEndChange: (v: number) => void;
  textOverlay: string;
  onTextOverlayChange: (v: string) => void;
  textOverlayPos: number;
  onTextOverlayPosChange: (v: number) => void;
  sticker: string;
  onStickerChange: (v: string) => void;
  stickerPos: number;
  onStickerPosChange: (v: number) => void;
  backgroundAudio: CustomAudioSelection;
  onBackgroundAudioChange: (v: CustomAudioSelection) => void;
  audioTrack: string;
  onAudioTrackChange: (v: string) => void;
  audioUsage?: 'post' | 'story';
};

function AdjustSlider({
  label,
  value,
  min,
  max,
  suffix = '%',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
        <span>{label}</span>
        <span>{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}

export function EditorToolPanels(props: EditorToolPanelsProps) {
  const {
    activeTab,
    mode,
    previewMedia,
    filter,
    onFilterChange,
    mediaAdjust,
    onMediaAdjustChange,
    videoAdjust,
    onVideoAdjustChange,
    textExtras,
    onTextExtrasChange,
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
    trimStart,
    onTrimStartChange,
    trimEnd,
    onTrimEndChange,
    textOverlay,
    onTextOverlayChange,
    textOverlayPos,
    onTextOverlayPosChange,
    sticker,
    onStickerChange,
    stickerPos,
    onStickerPosChange,
    backgroundAudio,
    onBackgroundAudioChange,
    audioTrack,
    onAudioTrackChange,
    audioUsage = 'post',
  } = props;

  if (activeTab === 'none') return null;

  return (
    <>
      {activeTab === 'templates' && (
        <div className="grid grid-cols-2 gap-2 px-1">
          {TEXT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onTextPostFontChange(t.font);
                onTextPostBgChange(t.bg);
                onTextPostAlignmentChange(t.align);
              }}
              className={`rounded-xl border-2 p-3 text-left transition-colors ${t.bg} ${
                textPostBg === t.bg && textPostFont === t.font ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
              }`}
            >
              <span className="text-[11px] font-black text-foreground drop-shadow-sm">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {activeTab === 'animation' && (
        <div className="flex flex-wrap gap-2 px-1">
          {([['none', 'None'], ['fade', 'Fade'], ['slide', 'Slide'], ['typewriter', 'Type'], ['bounce', 'Bounce']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onTextExtrasChange({ animation: id })}
              className={`px-3 py-2 rounded-lg text-xs font-bold ${textExtras.animation === id ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'spacing' && (
        <div className="space-y-3 px-1">
          <AdjustSlider label="Line height" value={Math.round(textExtras.lineHeight * 100)} min={100} max={200} onChange={(v) => onTextExtrasChange({ lineHeight: v / 100 })} />
          <AdjustSlider label="Letter spacing" value={textExtras.letterSpacing} min={-2} max={12} suffix="px" onChange={(v) => onTextExtrasChange({ letterSpacing: v })} />
        </div>
      )}

      {activeTab === 'color' && (
        <div className="px-2 py-1 space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground">Text follows the app theme (black in light mode, white in dark mode).</p>
          <div className="flex gap-2 items-center">
            {[{ bg: 'bg-white', label: 'Light preview' }, { bg: 'bg-black', label: 'Dark preview' }].map((item) => (
              <button
                key={item.bg}
                type="button"
                title={item.label}
                onClick={() => onTextPostColorChange(THEME_ADAPTIVE_TEXT_CLASS)}
                className={`w-8 h-8 rounded-full border-2 ${item.bg} ${textPostColor === THEME_ADAPTIVE_TEXT_CLASS || resolveEditorTextColorClass(textPostColor) === THEME_ADAPTIVE_TEXT_CLASS ? 'border-primary' : 'border-border'}`}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'font' && (
        <div className="flex gap-2 px-2 py-1 flex-wrap">
          {['sans', 'serif', 'mono'].map((f) => (
            <button key={f} type="button" onClick={() => onTextPostFontChange(`font-${f}`)} className={`px-4 py-2 rounded-lg text-sm font-bold ${textPostFont === `font-${f}` ? 'bg-primary text-white' : 'bg-secondary'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'bg' && (
        <div className="flex gap-2 px-2 py-1 flex-wrap">
          {TEXT_BGS.map((b) => (
            <button key={b} type="button" onClick={() => onTextPostBgChange(b)} className={`w-8 h-8 rounded-full ${b} border-2 ${textPostBg === b ? 'border-primary' : 'border-border'}`} />
          ))}
        </div>
      )}

      {activeTab === 'align' && (
        <div className="flex gap-2 px-2 py-1">
          {['left', 'center', 'right'].map((a) => (
            <button key={a} type="button" onClick={() => onTextPostAlignmentChange(`text-${a}`)} className={`px-4 py-2 rounded-lg text-sm font-bold capitalize ${textPostAlignment === `text-${a}` ? 'bg-primary text-white' : 'bg-secondary'}`}>
              {a}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'size' && (
        <div className="px-2 py-1 space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <span>Text Size</span>
            <span>{textPostSizeValue}px</span>
          </div>
          <input type="range" min="14" max="72" value={textPostSizeValue} onChange={(e) => onTextPostSizeValueChange(parseInt(e.target.value, 10))} className="w-full accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer" />
        </div>
      )}

      {activeTab === 'filters' && (
        <div className="w-full min-w-0 max-w-full">
          <MediaFilterPicker value={filter as MediaFilterId} onChange={onFilterChange} previewMedia={previewMedia ?? null} brightness={mediaAdjust.brightness} contrast={mediaAdjust.contrast} />
        </div>
      )}

      {activeTab === 'adjust' && (
        <div className="space-y-2 px-2 py-1">
          <AdjustSlider label="Brightness" value={mediaAdjust.brightness} min={50} max={150} onChange={(v) => onMediaAdjustChange({ brightness: v })} />
          <AdjustSlider label="Contrast" value={mediaAdjust.contrast} min={50} max={150} onChange={(v) => onMediaAdjustChange({ contrast: v })} />
          <AdjustSlider label="Saturation" value={mediaAdjust.saturation} min={0} max={200} onChange={(v) => onMediaAdjustChange({ saturation: v })} />
          <AdjustSlider label="Warmth" value={mediaAdjust.warmth} min={0} max={100} onChange={(v) => onMediaAdjustChange({ warmth: v })} />
          <AdjustSlider label="Sharpen" value={mediaAdjust.sharpen} min={80} max={140} onChange={(v) => onMediaAdjustChange({ sharpen: v })} />
          <AdjustSlider label="Vignette" value={mediaAdjust.vignette} min={0} max={100} onChange={(v) => onMediaAdjustChange({ vignette: v })} />
        </div>
      )}

      {activeTab === 'crop' && (
        <div className="space-y-3 px-1">
          <div className="flex flex-wrap gap-2">
            {([['free', 'Free'], ['1:1', '1:1'], ['4:5', '4:5'], ['9:16', '9:16'], ['16:9', '16:9']] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => onMediaAdjustChange({ cropAspect: id as CropAspectId })} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${mediaAdjust.cropAspect === id ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                {label}
              </button>
            ))}
          </div>
          <AdjustSlider label="Zoom" value={mediaAdjust.cropZoom} min={100} max={200} onChange={(v) => onMediaAdjustChange({ cropZoom: v })} />
        </div>
      )}

      {activeTab === 'rotate' && (
        <div className="space-y-3 px-1">
          <div className="flex flex-wrap gap-2">
            {([0, 90, 180, 270] as const).map((deg) => (
              <button key={deg} type="button" onClick={() => onMediaAdjustChange({ rotate: deg })} className={`px-3 py-2 rounded-lg text-xs font-bold ${mediaAdjust.rotate === deg ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                {deg}°
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onMediaAdjustChange({ flipH: !mediaAdjust.flipH })} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mediaAdjust.flipH ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>Flip H</button>
            <button type="button" onClick={() => onMediaAdjustChange({ flipV: !mediaAdjust.flipV })} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mediaAdjust.flipV ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>Flip V</button>
          </div>
        </div>
      )}

      {activeTab === 'stickers' && (
        <div className="space-y-3 px-1">
          <div className="flex flex-wrap gap-2">
            {STICKER_EMOJIS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => onStickerChange(sticker === emoji ? '' : emoji)} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-colors ${sticker === emoji ? 'border-primary bg-primary/10' : 'border-border bg-secondary/50 hover:bg-secondary'}`}>
                {emoji}
              </button>
            ))}
          </div>
          {sticker && <AdjustSlider label="Sticker position" value={stickerPos} min={10} max={90} onChange={onStickerPosChange} />}
        </div>
      )}

      {activeTab === 'text' && mode !== 'text' && (
        <div className="space-y-3 px-2 py-1">
          <div className="flex items-center gap-2">
            <input type="text" value={textOverlay} onChange={(e) => onTextOverlayChange(e.target.value)} placeholder="Type overlay text..." className="flex-1 bg-background text-foreground border border-border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary" />
            {textOverlay && <button type="button" onClick={() => onTextOverlayChange('')} className="text-xs text-destructive font-bold hover:underline">Clear</button>}
          </div>
          {textOverlay && <AdjustSlider label="Vertical position" value={textOverlayPos} min={10} max={90} onChange={onTextOverlayPosChange} />}
        </div>
      )}

      {activeTab === 'audio' && (
        <AudioTrackPicker customAudio={backgroundAudio} onCustomAudioChange={onBackgroundAudioChange} libraryTrackId={audioTrack} onLibraryTrackChange={onAudioTrackChange} usage={audioUsage} />
      )}

      {activeTab === 'trim' && mode === 'video' && (
        <div className="space-y-1.5 px-2 py-1">
          <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
            <span>Trim Start ({trimStart}%)</span>
            <span>Trim End ({trimEnd}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold">0%</span>
            <div className="flex-1 h-6 bg-secondary/85 rounded-md relative flex items-center">
              <div className="absolute inset-y-0 left-0 bg-primary/20 rounded-l-md" style={{ width: `${trimStart}%` }} />
              <div className="absolute inset-y-0 right-0 bg-primary/20 rounded-r-md" style={{ width: `${100 - trimEnd}%` }} />
              <input type="range" min="0" max="100" value={trimStart} onChange={(e) => onTrimStartChange(Math.min(parseInt(e.target.value, 10), trimEnd - 10))} className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-full z-10" />
              <input type="range" min="0" max="100" value={trimEnd} onChange={(e) => onTrimEndChange(Math.max(parseInt(e.target.value, 10), trimStart + 10))} className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-full z-10" />
              <div className="absolute h-full border-l-2 border-r-2 border-primary" style={{ left: `${trimStart}%`, right: `${100 - trimEnd}%` }} />
            </div>
            <span className="text-[10px] font-bold">100%</span>
          </div>
        </div>
      )}

      {activeTab === 'speed' && mode === 'video' && (
        <div className="space-y-3 px-1">
          <div className="flex flex-wrap gap-2">
            {[0.25, 0.5, 1, 1.5, 2].map((speed) => (
              <button key={speed} type="button" onClick={() => onVideoAdjustChange({ playbackSpeed: speed })} className={`px-3 py-2 rounded-lg text-xs font-bold ${videoAdjust.playbackSpeed === speed ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                {speed}x
              </button>
            ))}
          </div>
          <AdjustSlider label="Custom speed" value={Math.round(videoAdjust.playbackSpeed * 100)} min={25} max={200} suffix="%" onChange={(v) => onVideoAdjustChange({ playbackSpeed: v / 100 })} />
        </div>
      )}

      {activeTab === 'volume' && mode === 'video' && (
        <AdjustSlider label="Original audio volume" value={videoAdjust.volume} min={0} max={100} onChange={(v) => onVideoAdjustChange({ volume: v })} />
      )}

      {activeTab === 'cover' && mode === 'video' && (
        <div className="space-y-2 px-1">
          <p className="text-[11px] text-muted-foreground font-medium leading-snug">Pick the thumbnail frame shown before playback.</p>
          <AdjustSlider label="Cover frame" value={videoAdjust.coverFrame} min={0} max={100} onChange={(v) => onVideoAdjustChange({ coverFrame: v })} />
        </div>
      )}
    </>
  );
}
