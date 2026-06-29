import { lyricsLinesFromUpload } from '../../lib/karaokeUploadSession';
import { getCatalogSongById } from './songCatalog';
import { getUploadMetaById } from './karaokeUploadBridge';

export const DEFAULT_TRACK_DURATION_SEC = 48;
export const DEFAULT_SEC_PER_LYRIC_LINE = 10;

export type ActiveSong = {
  id: string;
  title: string;
  artist: string;
  composer?: string;
  lyricist?: string;
  lyrics: string[];
  /** Start time in seconds for each lyric line */
  lyricStartTimes?: number[];
  durationSec: number;
};

type SongInput = {
  id?: string;
  title: string;
  artist: string;
};

type PerformanceMeta = {
  composer?: string;
  lyricist?: string;
  lyrics: string[];
  lyricStartTimes?: number[];
  durationSec?: number;
};

function sanitizeUploadLyricLine(line: string): string {
  return line
    .replace(/[🎵🎶♫]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUploadMetaLine(line: string): boolean {
  const normalized = line.toLowerCase();
  return (
    normalized.includes('uploader') ||
    normalized.includes('upload by') ||
    normalized.includes('uploaded by') ||
    normalized.includes('ရေး') && normalized.includes('ဆို')
  );
}

function splitLongLyricLine(line: string): string[] {
  if (line.length <= 44) return [line];
  const parts = line
    .split(/[၊။,!?]/g)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [line];
}

const PERFORMANCE_META_BY_ID: Record<string, PerformanceMeta> = {
  'mm-1': {
    composer: 'ဝေနိုင်',
    lyricist: 'အောင်သူ',
    lyrics: [
      'မပိုင်နိုင်တာကိုသာ',
      'အစကမကြံသိခဲ့ရင်',
      'မောင်ပေးတဲ့အချစ်ပြန်ဆက်ခဲ့ပါ',
      'နှလုံးသားထဲမှာရှိနေသေးတယ်',
    ],
    lyricStartTimes: [0, 10, 20, 30],
    durationSec: 40,
  },
  'mm-2': {
    lyrics: [
      'အချစ်ဆိုတာလျိုက္ခ်ိုက္ခ်တစ္ခုပါ',
      'နှလုံးသားနဲ့ ဆိုတဲ့သီချင်း',
      'အတူတူ ဆိုကြရအောင်',
    ],
    lyricStartTimes: [0, 10, 20],
    durationSec: 30,
  },
  'pop-1': {
    lyrics: [
      "I've been tryna call",
      "I've been on my own for long enough",
      'Blinding lights',
      'Blinding lights',
    ],
    lyricStartTimes: [0, 8, 16, 24],
    durationSec: 32,
  },
};

function fallbackLyrics(title: string, artist: string): string[] {
  return [
    title,
    `Performed by ${artist}`,
    title,
    '♪ ♪ ♪',
  ];
}

function defaultDurationForLyrics(lineCount: number): number {
  return Math.min(120, Math.max(24, lineCount * DEFAULT_SEC_PER_LYRIC_LINE));
}

function buildLyricStartTimes(lineCount: number, durationSec: number, custom?: number[]): number[] {
  if (custom && custom.length === lineCount) {
    return custom;
  }
  const slot = durationSec / Math.max(1, lineCount);
  return Array.from({ length: lineCount }, (_, index) => index * slot);
}

export function resolveActiveSong(song: SongInput): ActiveSong {
  const uploadMeta = song.id ? getUploadMetaById(song.id) : undefined;
  if (uploadMeta) {
    const timedLines = uploadMeta.timedLyrics?.length
      ? uploadMeta.timedLyrics
          .map((line) => ({ text: sanitizeUploadLyricLine(line.text), time: line.time }))
          .filter((line) => line.text && !isUploadMetaLine(line.text))
      : [];
    const plainLines = lyricsLinesFromUpload({
      lyrics: uploadMeta.lyrics,
      timedLyrics: uploadMeta.timedLyrics,
    })
      .map((line) => sanitizeUploadLyricLine(line))
      .filter((line) => line && !isUploadMetaLine(line))
      .flatMap((line) => splitLongLyricLine(line));
    const lyrics = timedLines.length
      ? timedLines.map((line) => line.text)
      : plainLines.length
        ? plainLines
        : fallbackLyrics(uploadMeta.title, uploadMeta.artist);
    const durationSec =
      uploadMeta.durationSec ?? defaultDurationForLyrics(lyrics.length);
    const lyricStartTimes = timedLines.length
      ? timedLines.map((line) => line.time)
      : undefined;

    return {
      id: uploadMeta.id,
      title: uploadMeta.title,
      artist: uploadMeta.artist,
      lyricist: uploadMeta.artist,
      lyrics,
      lyricStartTimes: buildLyricStartTimes(lyrics.length, durationSec, lyricStartTimes),
      durationSec,
    };
  }

  const catalog = song.id ? getCatalogSongById(song.id) : undefined;
  const id = song.id ?? catalog?.id ?? `${song.title}-${song.artist}`;
  const title = catalog?.title ?? song.title;
  const artist = catalog?.artist ?? song.artist;
  const meta = PERFORMANCE_META_BY_ID[id];
  const lyrics = meta?.lyrics?.length ? meta.lyrics : fallbackLyrics(title, artist);
  const durationSec = meta?.durationSec ?? defaultDurationForLyrics(lyrics.length);
  const lyricStartTimes = buildLyricStartTimes(lyrics.length, durationSec, meta?.lyricStartTimes);

  return {
    id,
    title,
    artist,
    composer: meta?.composer,
    lyricist: meta?.lyricist ?? artist,
    lyrics,
    lyricStartTimes,
    durationSec,
  };
}

export function formatTrackTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getActiveLyricIndex(
  elapsedSec: number,
  durationSec: number,
  lineCount: number,
  lyricStartTimes?: number[],
): number {
  if (lineCount <= 0) return 0;

  const starts = buildLyricStartTimes(lineCount, durationSec, lyricStartTimes);
  let activeIndex = 0;

  for (let index = 0; index < lineCount; index += 1) {
    if (elapsedSec >= starts[index]!) {
      activeIndex = index;
    }
  }

  return activeIndex;
}
