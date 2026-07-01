import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User } from '../types';
import { safeUserId } from './safe';
import { isUserOwnedMediaUrl } from './appMediaStore';

export {
  detectMediaKind,
  processUploadFile,
  processUploadFileAsUrl,
  resolveAppMediaUrlSync,
  hydrateAppMediaUrl,
  warmAppMediaCache,
  initAppMediaStore,
  scheduleWarmAppMediaCache,
  isAppMediaRef,
  isUserOwnedMediaUrl,
} from './appMediaStore';

export { formatContentDateTime, formatContentTimeAgo, parseContentTimestamp, contentTimestampIso, formatRepostedDateTime, formatPostedDateTime } from './contentTime';

/** shadcn/ui utility — merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Safe localStorage wrapper — swallows quota and security errors. */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch {}
  },
  removeItem: (key: string): void => {
    try { localStorage.removeItem(key); } catch {}
  },
};

export {
  THEME_ADAPTIVE_TEXT_CLASS,
  THEME_OVERLAY_COLOR,
  normalizeEditorTextColorForSave,
  normalizeOverlayColorForSave,
  resolveCaptionColorClass,
  resolveEditorTextColorClass,
  resolveOverlayTextStyle,
  themeAdaptiveTextStyle,
  USER_CAPTION_PROSE_CLASS,
  REEL_STAT_LABEL_CLASS,
  REEL_STAT_LABEL_STYLE,
} from './themeText';

/** Opens global profile preview; only userId is required (preview resolves live user from db). */
export function openProfilePreview(user: User | Partial<User>) {
  const userId = safeUserId(user?.id);
  if (!userId) return;
  window.dispatchEvent(
    new CustomEvent('show-profile-preview', { detail: { userId } })
  );
}

export function formatTimeAgo(dateString: string) {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
}

const CAPTION_LINK_CLASS =
  'text-primary hover:underline cursor-pointer font-medium';

export type FormatMentionsOptions = {
  linkClassName?: string;
};

export function formatMentionsAndTags(
  text: string | null | undefined,
  options?: FormatMentionsOptions
) {
  if (!text || typeof text !== 'string') return null;
  const linkClass = options?.linkClassName ?? CAPTION_LINK_CLASS;
  const words = text.split(/(\s+)/);
  return words.map((word, i) => {
    if (word.startsWith('@')) {
       return (
         <span
           key={i}
           className={linkClass}
           onClick={(e) => {
           e.stopPropagation();
           window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'search', searchQuery: word.substring(1), searchTab: 'accounts' } }));
         }}
         >
           {word}
         </span>
       );
    }
    if (word.startsWith('#')) {
       return (
         <span
           key={i}
           className={linkClass}
           onClick={(e) => {
           e.stopPropagation();
           window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'search', searchQuery: word.substring(1), searchTab: 'tags' } }));
         }}
         >
           {word}
         </span>
       );
    }
    return (
      <span key={i} className="caption-text-part text-foreground">
        {word}
      </span>
    );
  });
}

const LOCAL_AVATAR_FALLBACK = '/favicon.svg';

export function resolveAvatarSrc(url?: string | null): string {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return LOCAL_AVATAR_FALLBACK;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return trimmed;
  } catch {
    /* invalid absolute URL */
  }
  if (trimmed.startsWith('/')) return trimmed;
  return LOCAL_AVATAR_FALLBACK;
}

export function handleAvatarError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  e.currentTarget.onerror = null;
  if (e.currentTarget.src.includes(LOCAL_AVATAR_FALLBACK)) return;
  e.currentTarget.src = LOCAL_AVATAR_FALLBACK;
}

const FALLBACK_POSTER =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&fit=crop';

function applyVideoPosterBackground(
  target: HTMLVideoElement,
  poster: string
) {
  target.poster = poster;
  const parent = target.parentElement;
  if (parent) {
    parent.style.backgroundImage = `url(${poster})`;
    parent.style.backgroundSize = 'cover';
    parent.style.backgroundPosition = 'center';
  }
}

export function handleMediaError(e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement, Event>) {
  const target = e.currentTarget;
  if (!target) return;

  const isVideo =
    target.tagName === 'VIDEO' ||
    target.nodeName === 'VIDEO' ||
    (typeof HTMLVideoElement !== 'undefined' && target instanceof HTMLVideoElement);

  if (isVideo) {
    const video = target as HTMLVideoElement;
    const src = video.currentSrc || video.src || '';
    video.onerror = null;

    const poster =
      video.getAttribute('data-poster') ||
      video.poster ||
      (isUserOwnedMediaUrl(src) ? '' : FALLBACK_POSTER);

    if (poster) {
      applyVideoPosterBackground(video, poster);
    }

    if (isUserOwnedMediaUrl(src)) {
      video.pause();
      return;
    }

    if (video.getAttribute('data-media-fallback') === '1') {
      video.pause();
      if (poster) {
        video.removeAttribute('src');
        video.load();
      }
      return;
    }

    video.setAttribute('data-media-fallback', '1');
    if (poster) {
      video.removeAttribute('src');
      video.load();
    }
    return;
  }

  const img = target as HTMLImageElement;
  const src = img.currentSrc || img.src || '';
  img.onerror = null;

  if (isUserOwnedMediaUrl(src)) {
    return;
  }

  if (img.getAttribute('data-media-fallback') === '1') {
    return;
  }

  img.setAttribute('data-media-fallback', '1');
  // Do not swap failed loads with stock placeholder images.
}

export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File) && !(file instanceof Blob)) {
      reject(new Error('Invalid file type'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Error reading file'));
    reader.readAsDataURL(file);
  });
}

export function getFontClass(font?: string) {
  if (!font) return 'font-sans';
  if (['sans', 'serif', 'mono'].includes(font)) return `font-${font}`;
  return font;
}

export function getAlignClass(alignment?: string) {
  if (!alignment) return 'text-center';
  if (['left', 'center', 'right'].includes(alignment)) return `text-${alignment}`;
  return alignment;
}

export function truncateText(text: string | null | undefined, maxLength: number) {
  const safe = typeof text === 'string' ? text : '';
  if (safe.length <= maxLength) return { text: safe, showMore: false };
  return { text: safe.substring(0, maxLength) + '...', showMore: true };
}

