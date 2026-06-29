import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { User } from '../types';

export function openProfilePreview(user: User) {
  window.dispatchEvent(new CustomEvent('show-profile-preview', { detail: { user } }));
}

export function formatTimeAgo(dateString: string) {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch (e) {
    return dateString;
  }
}

export function formatMentionsAndTags(text: string) {
  const words = text.split(/(\s+)/);
  return words.map((word, i) => {
    if (word.startsWith('@')) {
       return (
         <span key={i} className="text-primary hover:underline cursor-pointer font-medium" onClick={(e) => {
           e.stopPropagation();
           window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'search', searchQuery: word.substring(1), searchTab: 'accounts' } }));
         }}>
           {word}
         </span>
       );
    }
    if (word.startsWith('#')) {
       return (
         <span key={i} className="text-primary hover:underline cursor-pointer font-medium" onClick={(e) => {
           e.stopPropagation();
           window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'search', searchQuery: word.substring(1), searchTab: 'tags' } }));
         }}>
           {word}
         </span>
       );
    }
    return word;
  });
}

export function handleAvatarError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  e.currentTarget.onerror = null;
  e.currentTarget.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop";
}

export function handleMediaError(e: React.SyntheticEvent<any, Event>) {
  const target = e.currentTarget;
  if (!target) return;
  target.onerror = null;
  
  // Robust check for Video tag regardless of window context or iframe nesting
  const isVideo = target.tagName === 'VIDEO' || target.nodeName === 'VIDEO' || (typeof HTMLVideoElement !== 'undefined' && target instanceof HTMLVideoElement);
  
  if (isVideo) {
    const fallbackPoster = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&fit=crop";
    target.poster = target.poster || fallbackPoster;
    
    // Fallback to parent container background styling to prevent black screens
    if (target.parentElement) {
      target.parentElement.style.backgroundImage = `url(${target.poster || fallbackPoster})`;
      target.parentElement.style.backgroundSize = 'cover';
      target.parentElement.style.backgroundPosition = 'center';
    }
    
    // Try to load a known public sample video, but if it fails too, we hide the video layer to show the poster/background smoothly
    target.src = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";
    try {
      target.muted = true;
      target.defaultMuted = true;
      target.load();
      target.play().catch(() => {
        // If play keeps failing (due to autoplay blocks), hide the raw video or set opacity to allow poster/parent background to show
        target.style.opacity = '0.9';
      });
    } catch (err) {
      target.style.opacity = '0';
    }
  } else {
    target.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&fit=crop";
  }
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

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return { text, showMore: false };
  return { text: text.substring(0, maxLength) + '...', showMore: true };
}

export const safeLocalStorage = {
  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn(`localStorage.setItem exceeded quota or failed for key "${key}":`, e);
      return false;
    }
  },
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }
};

