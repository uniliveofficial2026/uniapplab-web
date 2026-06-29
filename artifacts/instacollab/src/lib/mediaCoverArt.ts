import { isPlayableAudioUrl } from './audioMedia';

function readSyncsafeInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function bytesToDataUrl(imageBytes: Uint8Array, mime: string): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < imageBytes.length; i += chunk) {
    binary += String.fromCharCode(...imageBytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function detectImageMime(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[8] === 0x57) {
    return 'image/webp';
  }
  return undefined;
}

function skipId3TextField(bytes: Uint8Array, offset: number, encoding: number, end: number): number {
  let i = offset;
  if (encoding === 1 || encoding === 2) {
    while (i + 1 < end && !(bytes[i] === 0 && bytes[i + 1] === 0)) i += 2;
    i += 2;
    return i;
  }
  while (i < end && bytes[i] !== 0) i += 1;
  return i + 1;
}

/** Extract embedded cover art from MP3 ID3v2 APIC / PIC frames. */
export function extractEmbeddedAudioCover(bytes: Uint8Array): string | undefined {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return undefined;
  }

  const versionMajor = bytes[3];
  const tagFlags = bytes[5];
  const tagSize = readSyncsafeInt(bytes, 6);
  let offset = 10;

  if (tagFlags & 0x40) {
    const extSize = readSyncsafeInt(bytes, offset);
    offset += 4 + extSize;
  }
  if (tagFlags & 0x10) {
    offset += 10;
  }

  const tagEnd = Math.min(bytes.length, 10 + tagSize);
  const frameHeaderSize = versionMajor === 4 ? 10 : 10;
  const v4 = versionMajor === 4;

  while (offset + frameHeaderSize <= tagEnd) {
    const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    if (frameId === '\0\0\0\0' || frameId.trim() === '') break;

    const frameSize = v4
      ? readSyncsafeInt(bytes, offset + 4)
      : readUint32BE(bytes, offset + 4);
    const frameStart = offset + frameHeaderSize;
    const frameEnd = frameStart + frameSize;
    if (frameSize <= 0 || frameEnd > tagEnd) break;

    if (frameId === 'APIC' || frameId === 'PIC ') {
      let cursor = frameStart;
      const textEncoding = bytes[cursor];
      cursor += 1;

      if (frameId === 'APIC') {
        while (cursor < frameEnd && bytes[cursor] !== 0) cursor += 1;
        cursor += 1;
        cursor += 1; // picture type
        cursor = skipId3TextField(bytes, cursor, textEncoding, frameEnd);
      } else {
        while (cursor < frameEnd && bytes[cursor] !== 0) cursor += 1;
        cursor += 1;
        cursor += 1;
        cursor = skipId3TextField(bytes, cursor, textEncoding, frameEnd);
      }

      const imageBytes = bytes.subarray(cursor, frameEnd);
      const mime = detectImageMime(imageBytes) ?? 'image/jpeg';
      if (imageBytes.length > 0) {
        return bytesToDataUrl(imageBytes, mime);
      }
    }

    offset = frameEnd;
  }

  return undefined;
}

async function readBytesFromDataUrl(dataUrl: string): Promise<Uint8Array | undefined> {
  if (!dataUrl.startsWith('data:')) return undefined;
  try {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return undefined;
    const meta = dataUrl.slice(0, comma);
    const payload = dataUrl.slice(comma + 1);
    if (meta.includes(';base64')) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    return new TextEncoder().encode(decodeURIComponent(payload));
  } catch {
    return undefined;
  }
}

export async function extractAudioCoverFromFile(file: File): Promise<string | undefined> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return extractEmbeddedAudioCover(bytes);
  } catch {
    return undefined;
  }
}

export async function extractAudioCoverFromDataUrl(dataUrl: string): Promise<string | undefined> {
  const bytes = await readBytesFromDataUrl(dataUrl);
  if (!bytes) return undefined;
  return extractEmbeddedAudioCover(bytes);
}

/** Capture a poster frame from an uploaded video (for reel disc artwork). */
export function captureVideoPosterFrame(src: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    const fail = () => {
      cleanup();
      resolve(undefined);
    };

    video.onerror = fail;

    video.onloadeddata = () => {
      const seekTo = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(0.35, video.duration * 0.08)
        : 0;
      try {
        video.currentTime = seekTo;
      } catch {
        fail();
      }
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 320;
        const size = Math.min(w, h, 512);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          fail();
          return;
        }
        const sx = Math.max(0, (w - h) / 2);
        const sy = Math.max(0, (h - w) / 2);
        const side = Math.min(w, h);
        ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      } catch {
        resolve(undefined);
      } finally {
        cleanup();
      }
    };

    video.src = src;
  });
}

export type MediaListItem = {
  url: string;
  type: 'image' | 'video' | 'audio';
  name: string;
  coverUrl?: string;
};

type ReelCoverSource = {
  audioCoverUrl?: string;
  audioUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaList?: MediaListItem[];
};

/** Resolve reel disc artwork: stored cover → embedded audio art → video frame → undefined. */
export async function resolveReelDiscCoverUrl(
  reel: ReelCoverSource,
  soundtrackUrl?: string,
  displayType?: 'image' | 'video' | 'audio',
  displayUrl?: string
): Promise<string | undefined> {
  if (reel.audioCoverUrl) return reel.audioCoverUrl;

  if (soundtrackUrl && isPlayableAudioUrl(soundtrackUrl)) {
    const fromSoundtrack = await extractAudioCoverFromDataUrl(soundtrackUrl);
    if (fromSoundtrack) return fromSoundtrack;
  }

  const audioItem = reel.mediaList?.find((m) => m.type === 'audio');
  if (audioItem?.coverUrl) return audioItem.coverUrl;
  if (audioItem?.url) {
    const fromPrimaryAudio = await extractAudioCoverFromDataUrl(audioItem.url);
    if (fromPrimaryAudio) return fromPrimaryAudio;
  }

  if (reel.audioUrl && isPlayableAudioUrl(reel.audioUrl)) {
    const fromAudioUrl = await extractAudioCoverFromDataUrl(reel.audioUrl);
    if (fromAudioUrl) return fromAudioUrl;
  }

  if (displayType === 'image' && displayUrl) return displayUrl;

  if (displayType === 'video') {
    const videoSrc = displayUrl || reel.videoUrl;
    if (reel.imageUrl) return reel.imageUrl;
    if (videoSrc) return captureVideoPosterFrame(videoSrc);
  }

  if (displayType === 'audio' && displayUrl) {
    const fromDisplayAudio = await extractAudioCoverFromDataUrl(displayUrl);
    if (fromDisplayAudio) return fromDisplayAudio;
  }

  return undefined;
}
