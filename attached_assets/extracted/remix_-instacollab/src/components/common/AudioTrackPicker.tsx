import React, { useRef, useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Music, Upload, X } from 'lucide-react';
import { fileToBase64 } from '../../lib/utils';
import { isAudioFile, isPlayableAudioUrl } from '../../lib/audioMedia';
import { useToast } from '../../lib/ToastContext';
import { BackgroundAudioPlayer } from './BackgroundAudioPlayer';
import { PLAYBACK_PRIORITY } from '../../lib/playbackAudio';

export type CustomAudioSelection = { url: string; name: string } | null;

const LIBRARY_TRACKS = [
  { id: 'none', label: 'No Track', desc: 'Original / no soundtrack' },
  { id: 'Lofi Sunsets 🏖️ - ChillHop Store', label: 'Lofi Sunsets', desc: 'Relaxed lazy beats' },
  { id: 'Tech Synergy ⚡ - ProdByAIST', label: 'Tech Synergy', desc: 'Futuristic ambient electro' },
  { id: 'Neon Horizon 🌌 - Waveforms', label: 'Neon Horizon', desc: 'Retrowave space out vibe' },
  { id: 'Gym Beast Mode 🔥 - PowerGains', label: 'Gym Beast', desc: 'Aggressive motivational trap' },
] as const;

function LibraryTrackScroller({
  libraryTrackId,
  onSelect,
  libraryNote = 'Curated library (label only — upload a file to hear playback)',
}: {
  libraryTrackId: string;
  onSelect: (track: (typeof LIBRARY_TRACKS)[number]) => void;
  libraryNote?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ atStart: true, atEnd: false });

  const updateScrollEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setScrollEdges({
      atStart: el.scrollLeft <= 4,
      atEnd: maxScroll <= 4 || el.scrollLeft >= maxScroll - 4,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollEdges();
    el.addEventListener('scroll', updateScrollEdges, { passive: true });
    const ro = new ResizeObserver(updateScrollEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollEdges);
      ro.disconnect();
    };
  }, [updateScrollEdges]);

  const scrollBy = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(140, el.clientWidth * 0.72),
      behavior: 'smooth',
    });
  };

  const navButtonClass = (disabled: boolean) =>
    `hidden md:flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card text-foreground shadow-md transition-all ${
      disabled
        ? 'opacity-40 cursor-not-allowed pointer-events-none'
        : 'hover:bg-secondary hover:border-primary/50 active:scale-95'
    }`;

  return (
    <div className="min-w-0 w-full max-w-full space-y-1.5">
      <div className="flex items-start justify-between gap-2 px-0.5">
        <span className="text-[11px] font-bold text-muted-foreground leading-snug">
          {libraryNote}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0 md:hidden">Swipe to see more</span>
        <span className="text-[10px] text-muted-foreground shrink-0 hidden md:inline">
          Use arrows to browse
        </span>
      </div>

      <div className="grid w-full max-w-full grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-0 md:gap-2">
        <button
          type="button"
          aria-label="Scroll tracks left"
          onClick={() => scrollBy(-1)}
          disabled={scrollEdges.atStart}
          className={navButtonClass(scrollEdges.atStart)}
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
        </button>

        <div className="relative min-w-0 overflow-hidden">
          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto overflow-y-hidden no-scrollbar py-1 px-1 md:px-0.5 scroll-smooth snap-x snap-mandatory scroll-px-2 md:scroll-px-1 touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]"
          >
            {LIBRARY_TRACKS.map((track) => (
              <div key={track.id} className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => onSelect(track)}
                  className={`flex flex-col p-2 rounded-xl border text-left transition-all min-w-[7.5rem] max-w-[7.5rem] ${
                    libraryTrackId === track.id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-background hover:bg-secondary/40 border-border'
                  }`}
                >
                  <span className="text-xs font-black truncate">{track.label}</span>
                  <span className="text-[9px] text-muted-foreground block line-clamp-2 leading-tight">
                    {track.desc}
                  </span>
                </button>
              </div>
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-y-1 left-0 w-6 bg-gradient-to-r from-secondary/40 to-transparent md:hidden"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-1 right-0 w-6 bg-gradient-to-l from-secondary/40 to-transparent md:hidden"
            aria-hidden
          />
        </div>

        <button
          type="button"
          aria-label="Scroll tracks right"
          onClick={() => scrollBy(1)}
          disabled={scrollEdges.atEnd}
          className={navButtonClass(scrollEdges.atEnd)}
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

export function getSelectedAudioLabel(
  customAudio: CustomAudioSelection,
  libraryTrackId: string
): string | null {
  if (customAudio?.name) return customAudio.name;
  if (libraryTrackId !== 'none') {
    return LIBRARY_TRACKS.find((t) => t.id === libraryTrackId)?.label ?? 'Library track';
  }
  return null;
}

export function hasSelectedAudio(
  customAudio: CustomAudioSelection,
  libraryTrackId: string
): boolean {
  return !!(customAudio?.url || libraryTrackId !== 'none');
}

type SelectedAudioStripProps = {
  customAudio: CustomAudioSelection;
  libraryTrackId: string;
  onEdit?: () => void;
  onRemove: () => void;
  playbackId?: string;
  className?: string;
};

/** Always-visible bar so soundtrack stays accessible while editing caption / share options. */
export function SelectedAudioStrip({
  customAudio,
  libraryTrackId,
  onEdit,
  onRemove,
  playbackId = 'editor:audio-strip',
  className = '',
}: SelectedAudioStripProps) {
  const label = getSelectedAudioLabel(customAudio, libraryTrackId);
  if (!label) return null;

  const playableUrl =
    customAudio?.url && isPlayableAudioUrl(customAudio.url) ? customAudio.url : undefined;
  const isLibraryOnly = !playableUrl && libraryTrackId !== 'none';

  return (
    <div
      className={`rounded-xl border border-primary/35 bg-primary/5 p-2.5 shadow-sm ${className}`}
      role="region"
      aria-label="Selected soundtrack"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Music className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Soundtrack</p>
          <p className="text-xs font-bold truncate text-foreground">{label}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[10px] font-bold hover:bg-secondary/60 transition-colors"
            >
              Change
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Remove soundtrack"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {playableUrl ? (
        <div className="mt-2 pointer-events-auto">
          <BackgroundAudioPlayer
            audioUrl={playableUrl}
            playbackId={playbackId}
            priority={PLAYBACK_PRIORITY.EDITOR}
            showControls
            autoPlay
          />
        </div>
      ) : isLibraryOnly ? (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Library label only — upload an audio file to preview playback.
        </p>
      ) : null}
    </div>
  );
}

type AudioUsage = 'post' | 'story';

type AudioTrackPickerProps = {
  customAudio: CustomAudioSelection;
  onCustomAudioChange: (audio: CustomAudioSelection) => void;
  libraryTrackId: string;
  onLibraryTrackChange: (id: string) => void;
  showLibrary?: boolean;
  /** Adjust helper copy for story vs post/reel editor. */
  usage?: AudioUsage;
};

const AUDIO_COPY: Record<
  AudioUsage,
  { empty: string; selected: string; libraryNote: string }
> = {
  post: {
    empty:
      'Add an MP3 or other audio file for background playback on text posts, or as a soundtrack on photo/video/reels.',
    selected: 'Loops in the background while you edit and on published text posts.',
    libraryNote: 'Curated library (label only — upload a file to hear playback)',
  },
  story: {
    empty:
      'Upload an MP3 or other audio file to use as your story soundtrack. Video stories play with the clip muted when a file is added.',
    selected:
      'Plays while you edit and when viewers watch your story. Upload a file for real playback; library picks are labels only.',
    libraryNote: 'Curated library (labels only for stories — upload a file to hear it)',
  },
};

export function AudioTrackPicker({
  customAudio,
  onCustomAudioChange,
  libraryTrackId,
  onLibraryTrackChange,
  showLibrary = true,
  usage = 'post',
}: AudioTrackPickerProps) {
  const copy = AUDIO_COPY[usage];
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isAudioFile(file)) {
      showToast('Please choose an audio file (MP3, WAV, M4A, etc.)');
      return;
    }
    try {
      const url = await fileToBase64(file);
      onCustomAudioChange({ url, name: file.name });
      onLibraryTrackChange('none');
      showToast(`Added "${file.name}"`);
    } catch {
      showToast('Could not read audio file');
    }
  };

  return (
    <div className="space-y-3 px-2 py-1 min-w-0 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-secondary/50 transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload audio file
        </button>
        {customAudio && (
          <button
            type="button"
            onClick={() => {
              onCustomAudioChange(null);
              showToast('Audio removed');
            }}
            className="inline-flex items-center gap-1 rounded-xl px-2 py-2 text-xs font-bold text-destructive hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.aac,.m4a,.flac,.webm"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {customAudio ? (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2 min-w-0">
            <Music className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-xs font-bold truncate">{customAudio.name}</span>
          </div>
          <BackgroundAudioPlayer
            audioUrl={customAudio.url}
            playbackId="editor:audio-picker"
            priority={PLAYBACK_PRIORITY.EDITOR}
            showControls
            autoPlay
          />
          <p className="text-[10px] text-muted-foreground">{copy.selected}</p>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">{copy.empty}</p>
      )}

      {showLibrary && (
        <LibraryTrackScroller
          libraryNote={copy.libraryNote}
          libraryTrackId={libraryTrackId}
          onSelect={(track) => {
            onLibraryTrackChange(track.id);
            if (track.id !== 'none') {
              onCustomAudioChange(null);
            }
            showToast(
              track.id === 'none' ? 'No library track' : `Selected "${track.label}"`
            );
          }}
        />
      )}
    </div>
  );
}
