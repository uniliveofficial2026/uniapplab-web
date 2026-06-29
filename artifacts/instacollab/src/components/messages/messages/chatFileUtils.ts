import type { ChatMessage } from '../../../types';
import { isShareLinkMessage, sharePreviewLabel } from '../../../lib/shareLinks';
import { getChatMessageLocationPreview, getMessageLocation, getLocationPreviewLabel } from './chatLocationUtils';
import type { MessageMediaAttachment } from './types';

const LEGACY_FILE_TEXT_RE = /^📎 Sent file: (.+)$/;
const MAX_CHAT_FILE_BYTES = 15 * 1024 * 1024;

export type ChatFileKind =
  | 'pdf'
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'archive'
  | 'spreadsheet'
  | 'document';

export function formatChatFileSize(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isDocumentAttachment(media: MessageMediaAttachment): boolean {
  return !!media?.isFile;
}

export function getChatFileKind(media: MessageMediaAttachment): ChatFileKind {
  const mime = String(media.mimeType || '').toLowerCase();
  const name = String(media.name || '').toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|bmp|svg)$/i.test(name)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(name)) return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name)) return 'audio';
  if (
    mime.startsWith('text/') ||
    /\.(txt|md|markdown|json|csv|log|xml|html?|css|js|ts|tsx|jsx|yml|yaml)$/i.test(name)
  ) {
    return 'text';
  }
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name) || mime.includes('zip') || mime.includes('compressed'))
    return 'archive';
  if (/\.(xls|xlsx|csv)$/i.test(name) || mime.includes('spreadsheet') || mime.includes('excel'))
    return 'spreadsheet';
  return 'document';
}

export function getChatFileKindLabel(kind: ChatFileKind): string {
  switch (kind) {
    case 'pdf':
      return 'PDF';
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    case 'text':
      return 'Text';
    case 'archive':
      return 'Archive';
    case 'spreadsheet':
      return 'Sheet';
    default:
      return 'File';
  }
}

/** Any attached file with stored bytes can open in the in-app viewer shell. */
export function canViewChatFileInApp(media: MessageMediaAttachment): boolean {
  if (!media.url || legacyNameOnlyMedia(media)) return false;
  return typeof media.url === 'string' && media.url.length > 0;
}

/** @deprecated Use canViewChatFileInApp */
export function canPreviewChatFile(media: MessageMediaAttachment): boolean {
  return canViewChatFileInApp(media);
}

export type ChatFileObjectUrl = {
  src: string;
  revoke: () => void;
};

/** Blob URL for iframe/video/audio — required for reliable PDF preview from data: URLs. */
export function createChatFileObjectUrl(media: MessageMediaAttachment): ChatFileObjectUrl | null {
  const url = media.url;
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('blob:')) {
    return { src: url, revoke: () => {} };
  }
  if (url.startsWith('data:')) {
    const blob = dataUrlToBlob(url);
    if (!blob) return null;
    const src = URL.createObjectURL(blob);
    return {
      src,
      revoke: () => URL.revokeObjectURL(src),
    };
  }
  return { src: url, revoke: () => {} };
}

function legacyNameOnlyMedia(media: MessageMediaAttachment): boolean {
  return !media.url && !!media.name;
}

export function parseLegacyFileMessageText(text: string | undefined): string | null {
  if (!text?.trim()) return null;
  const match = text.trim().match(LEGACY_FILE_TEXT_RE);
  return match?.[1]?.trim() || null;
}

export function getFirstFileAttachment(message: ChatMessage | null | undefined): MessageMediaAttachment | null {
  if (!message || !Array.isArray(message.media)) return null;
  const files = (message.media as MessageMediaAttachment[]).filter((item) => !!item?.isFile);
  return files[0] ?? null;
}

export function getChatMessagePreviewText(message: ChatMessage | null | undefined): string | null {
  if (!message) return null;
  const locationPreview = getChatMessageLocationPreview(message);
  if (locationPreview) return locationPreview;
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (text) {
    const legacy = parseLegacyFileMessageText(text);
    if (legacy) return `📎 ${legacy}`;
    return text;
  }
  const media = Array.isArray(message.media) ? (message.media as MessageMediaAttachment[]) : [];
  const file = media.find((item) => item?.isFile);
  if (file?.name) return `📎 ${file.name}`;
  if (media.some((item) => item?.isAudio)) return '🎵 Audio';
  if (media.some((item) => item?.isVideo)) return '🎬 Video';
  if (media.length > 0) return '📷 Photo';
  return null;
}

export function getReplyPreviewLabel(
  text: string | undefined,
  media: MessageMediaAttachment[] | undefined,
  message?: ChatMessage | null
): string {
  const loc = message ? getMessageLocation(message) : null;
  if (loc) return `📍 ${getLocationPreviewLabel(loc)}`;
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed) {
    const legacy = parseLegacyFileMessageText(trimmed);
    if (legacy) return `📎 ${legacy}`;
    if (isShareLinkMessage(trimmed)) {
      return sharePreviewLabel(trimmed) ?? trimmed.slice(0, 80);
    }
    return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
  }
  const file = media?.find((item) => item?.isFile);
  if (file?.name) return `📎 ${file.name}`;
  if (media?.some((item) => item?.isAudio)) return '🎵 Audio';
  if (media?.some((item) => item?.isVideo)) return '🎬 Video';
  if (media && media.length > 0) return '📷 Photo';
  return 'Message';
}

export function isChatFileWithinLimit(bytes: number): boolean {
  return bytes <= MAX_CHAT_FILE_BYTES;
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [header, payload] = dataUrl.split(',');
    if (!header || payload === undefined) return null;
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch?.[1] || 'application/octet-stream';
    if (header.includes(';base64')) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(payload)], { type: mime });
  } catch {
    return null;
  }
}

export function downloadChatFile(media: MessageMediaAttachment): boolean {
  const url = media.url;
  if (!url || typeof url !== 'string') return false;
  const fileName = media.name || 'download';

  try {
    if (url.startsWith('data:')) {
      const blob = dataUrlToBlob(url);
      if (!blob) return false;
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      return true;
    }

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return true;
  } catch {
    return false;
  }
}

export function openChatFileInNewTab(media: MessageMediaAttachment): boolean {
  const url = media.url;
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:')) {
    const blob = dataUrlToBlob(url);
    if (!blob) return false;
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return true;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
