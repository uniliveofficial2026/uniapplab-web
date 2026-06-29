import {
  loadKaraokeUploadMedia,
  readMediaDurationSec,
  type KaraokeTimedWord,
} from './karaokeUploads';
import type { KaraokeLibrarySong } from '../components/karaoke/karaokeTypes';

export type StudioLyricLine = {
  time: number;
  text: string;
  singer: string;
  part: number;
  chord: string;
  words?: KaraokeTimedWord[];
};

const CHORD_CYCLE = ['C Maj', 'G Maj', 'A Min', 'F Maj', 'E Min'];

const mediaObjectUrlCache = new Map<string, string>();

export function lyricsLinesFromUpload(song: Pick<KaraokeLibrarySong, 'lyrics' | 'timedLyrics'>): string[] {
  if (song.timedLyrics?.length) {
    return song.timedLyrics.map((line) => line.text).filter(Boolean);
  }
  if (song.lyrics?.trim()) {
    return song.lyrics.split('\n').map((line) => line.trimEnd());
  }
  return [];
}

export function studioLyricsFromUpload(
  song: Pick<KaraokeLibrarySong, 'title' | 'lyrics' | 'timedLyrics'>,
): StudioLyricLine[] {
  if (song.timedLyrics?.length) {
    return song.timedLyrics.map((line, index) => ({
      time: line.time,
      text: line.text,
      singer: 'both',
      part: 1,
      chord: CHORD_CYCLE[index % CHORD_CYCLE.length]!,
      words: line.words?.length ? line.words : undefined,
    }));
  }

  const lines = lyricsLinesFromUpload(song).filter((line) => line.trim() !== '');
  if (lines.length === 0) {
    return [
      {
        time: 0,
        text: song.title || 'Sing along',
        singer: 'both',
        part: 1,
        chord: 'C Maj',
      },
    ];
  }

  return lines.map((text, index) => ({
    time: index * 8,
    text,
    singer: 'both',
    part: 1,
    chord: CHORD_CYCLE[index % CHORD_CYCLE.length]!,
  }));
}

export function activeLyricIndexForTime(lines: StudioLyricLine[], elapsedSec: number): number {
  if (lines.length === 0) return 0;
  let index = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (elapsedSec + 0.05 >= lines[i]!.time) {
      index = i;
    } else {
      break;
    }
  }
  return index;
}

export function lineEndTimeSec(
  lines: StudioLyricLine[],
  lineIndex: number,
  totalDurationSec?: number,
): number {
  if (lineIndex < 0 || lineIndex >= lines.length) return 0;
  if (lineIndex + 1 < lines.length) return lines[lineIndex + 1]!.time;
  const start = lines[lineIndex]!.time;
  const wordCount = lines[lineIndex]!.text.split(/\s+/).filter(Boolean).length || 1;
  if (totalDurationSec != null && totalDurationSec > start + 0.5) return totalDurationSec;
  return start + Math.max(2.5, wordCount * 0.42);
}

export type LyricWordTiming = { word: string; start: number; end: number };

/** Spread words across a timed line using character-weighted slices. */
export function wordTimingsForLine(
  lineText: string,
  lineStart: number,
  lineEnd: number,
): LyricWordTiming[] {
  const words = lineText.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const duration = Math.max(0.08, lineEnd - lineStart);
  if (words.length === 1) {
    return [{ word: words[0]!, start: lineStart, end: lineEnd }];
  }

  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, '').length || 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = lineStart;

  return words.map((word, index) => {
    const slice = (weights[index]! / totalWeight) * duration;
    const start = cursor;
    const end = index === words.length - 1 ? lineEnd : cursor + slice;
    cursor = end;
    return { word, start, end };
  });
}

/** Index of the word that should be highlighted for the current playback time. */
export function activeWordIndexForLine(
  lines: StudioLyricLine[],
  elapsedSec: number,
  lineIndex: number,
  totalDurationSec?: number,
): number {
  if (lineIndex < 0 || lineIndex >= lines.length) return 0;
  const line = lines[lineIndex]!;
  const words = line.text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return 0;

  if (line.words?.length) {
    const t = elapsedSec;
    for (let i = line.words.length - 1; i >= 0; i -= 1) {
      const start = line.words[i]!.time;
      const end =
        i + 1 < line.words.length
          ? line.words[i + 1]!.time
          : lineEndTimeSec(lines, lineIndex, totalDurationSec);
      if (t >= start && t < end) return Math.min(i, words.length - 1);
      if (t >= start) return Math.min(i, words.length - 1);
    }
    return 0;
  }

  const timings = wordTimingsForLine(
    line.text,
    line.time,
    lineEndTimeSec(lines, lineIndex, totalDurationSec),
  );
  const t = elapsedSec;

  for (let i = timings.length - 1; i >= 0; i -= 1) {
    if (t >= timings[i]!.start && t < timings[i]!.end) return i;
    if (t >= timings[i]!.start) return i;
  }
  return 0;
}

/** 0–100 progress through the active lyric line based on timed lyrics. */
export function lyricLineProgressPercent(
  lines: StudioLyricLine[],
  elapsedSec: number,
  lineIndex: number,
  totalDurationSec?: number,
): number {
  if (lineIndex < 0 || lineIndex >= lines.length) return 0;
  const start = lines[lineIndex]!.time;
  const end = lineEndTimeSec(lines, lineIndex, totalDurationSec);
  const duration = Math.max(0.25, end - start);
  return Math.min(100, Math.max(0, ((elapsedSec - start) / duration) * 100));
}

export function hasPreciseTimedLyrics(
  song: Pick<KaraokeLibrarySong, 'timedLyrics'>,
): boolean {
  return Boolean(song.timedLyrics?.length);
}

export type StudioWordSpike = {
  word: string;
  start: number;
  end: number;
  pitch: number;
  lineIndex: number;
  wordIndex: number;
};

function pseudoPitchForWord(
  lineIndex: number,
  wordIndex: number,
  wordLength: number,
  wordCount: number,
): number {
  const count = Math.max(1, wordCount);
  const t = count > 1 ? wordIndex / (count - 1) : 0.5;
  const arc = Math.sin(t * Math.PI * 1.35 + lineIndex * 0.9) * 34;
  const stair = ((wordIndex % 4) - 1.5) * 9;
  const drift = ((lineIndex * 7 + wordIndex * 11) % 15) - 7;
  let pitch = 48 + arc + stair + drift * 0.7;
  pitch += Math.min(6, Math.max(-3, (wordLength - 4) * 1.1));
  pitch += (lineIndex % 6) * 3.5 - 10;
  return Math.round(Math.min(96, Math.max(6, pitch)) * 10) / 10;
}

/** Map 0–100 pitch to vertical center inside a lane (0 = low/bottom, 100 = high/top). */
export function spikeLaneCenterY(
  pitch: number,
  laneTop: number,
  laneBottom: number,
  barHeight = 0,
): number {
  const t = Math.min(1, Math.max(0, pitch / 100));
  const usable = Math.max(1, laneBottom - laneTop - barHeight);
  return laneBottom - barHeight / 2 - t * usable;
}

/** Flat word timeline for Smule / StarMaker-style pitch-lane spikes. */
export function buildStudioWordSpikes(
  lines: StudioLyricLine[],
  totalDurationSec?: number,
): StudioWordSpike[] {
  const spikes: StudioWordSpike[] = [];

  lines.forEach((line, lineIndex) => {
    const lineEnd = lineEndTimeSec(lines, lineIndex, totalDurationSec);

    if (line.words?.length) {
      const wordCount = line.words.length;
      line.words.forEach((word, wordIndex) => {
        const end =
          wordIndex + 1 < line.words!.length
            ? line.words![wordIndex + 1]!.time
            : lineEnd;
        spikes.push({
          word: word.text,
          start: word.time,
          end,
          pitch: pseudoPitchForWord(lineIndex, wordIndex, word.text.length, wordCount),
          lineIndex,
          wordIndex,
        });
      });
      return;
    }

    const timings = wordTimingsForLine(line.text, line.time, lineEnd);
    const wordCount = timings.length;
    timings.forEach((timing, wordIndex) => {
      spikes.push({
        word: timing.word,
        start: timing.start,
        end: timing.end,
        pitch: pseudoPitchForWord(lineIndex, wordIndex, timing.word.length, wordCount),
        lineIndex,
        wordIndex,
      });
    });
  });

  return spikes;
}

export function activeWordSpikeIndex(spikes: StudioWordSpike[], elapsedSec: number): number {
  if (spikes.length === 0) return -1;
  for (let i = 0; i < spikes.length; i += 1) {
    const spike = spikes[i]!;
    if (elapsedSec >= spike.start && elapsedSec < spike.end) return i;
  }
  return -1;
}

/** Active spike using strict [start, end) windows — matches Smule / StarMaker word hits. */
export function activeWordSpikeAtTime(spikes: StudioWordSpike[], elapsedSec: number): StudioWordSpike | null {
  const index = activeWordSpikeIndex(spikes, elapsedSec);
  return index >= 0 ? spikes[index]! : null;
}

export function wordIndexOnLineFromSpikes(
  spikes: StudioWordSpike[],
  lineIndex: number,
  elapsedSec: number,
): number {
  for (let i = spikes.length - 1; i >= 0; i -= 1) {
    const spike = spikes[i]!;
    if (spike.lineIndex !== lineIndex) continue;
    if (elapsedSec >= spike.start && elapsedSec < spike.end) return spike.wordIndex;
    if (elapsedSec >= spike.start) return spike.wordIndex;
  }
  return 0;
}

/** First spike index that may intersect the visible time window. */
export function firstVisibleSpikeIndex(spikes: StudioWordSpike[], viewStartSec: number): number {
  if (spikes.length === 0) return 0;
  let lo = 0;
  let hi = spikes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (spikes[mid]!.end < viewStartSec) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function activeWordSpike(spikes: StudioWordSpike[], elapsedSec: number): StudioWordSpike | null {
  return activeWordSpikeAtTime(spikes, elapsedSec);
}

export function usesTimedLyricSync(
  song: Pick<KaraokeLibrarySong, 'isUploaded' | 'timedLyrics' | 'lyrics'>,
  lines: StudioLyricLine[],
): boolean {
  return Boolean(song.timedLyrics?.length || (song.isUploaded && lines.length > 0));
}

export function isUploadedVideoTrack(
  song: Pick<KaraokeLibrarySong, 'isVideo' | 'mediaKind' | 'mimeType'>,
): boolean {
  return Boolean(
    song.isVideo ||
      song.mediaKind === 'video' ||
      song.mimeType?.startsWith('video/'),
  );
}

export async function resolveUploadedSongMediaUrl(uploadId: string): Promise<string | null> {
  const cached = mediaObjectUrlCache.get(uploadId);
  if (cached) return cached;

  const media = await loadKaraokeUploadMedia(uploadId);
  if (!media?.blob) return null;

  const url = URL.createObjectURL(media.blob);
  mediaObjectUrlCache.set(uploadId, url);
  return url;
}

/** @deprecated use resolveUploadedSongMediaUrl */
export async function resolveUploadedSongAudioUrl(uploadId: string): Promise<string | null> {
  return resolveUploadedSongMediaUrl(uploadId);
}

export type EnrichedKaraokeSong = KaraokeLibrarySong & {
  audioUrl?: string;
  durationSec?: number;
  isVideo?: boolean;
};

export async function enrichUploadedKaraokeSong(song: KaraokeLibrarySong): Promise<EnrichedKaraokeSong> {
  if (!song.isUploaded) {
    return song;
  }

  const media = await loadKaraokeUploadMedia(song.id);
  const mediaUrl = media ? await resolveUploadedSongMediaUrl(song.id) : null;
  if (!mediaUrl) {
    return song;
  }

  const isVideo =
    isUploadedVideoTrack(song) ||
    Boolean(media?.mimeType.startsWith('video/'));
  const durationSec =
    song.durationSec ??
    (await readMediaDurationSec(mediaUrl, isVideo ? 'video' : 'audio'));

  return {
    ...song,
    audioUrl: mediaUrl,
    durationSec,
    isVideo,
    mediaKind: isVideo ? 'video' : (song.mediaKind ?? 'audio'),
    mimeType: media?.mimeType ?? song.mimeType,
  };
}

export function revokeUploadedSongAudioUrl(uploadId: string): void {
  const url = mediaObjectUrlCache.get(uploadId);
  if (!url) return;
  URL.revokeObjectURL(url);
  mediaObjectUrlCache.delete(uploadId);
}
