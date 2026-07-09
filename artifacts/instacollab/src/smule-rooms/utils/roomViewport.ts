import { useEffect, useState } from 'react';

/** True on phone / narrow touch-first room shell (smule-rooms mobile column). */
export function isMobileRoomViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(max-width: 767px), (pointer: coarse)')?.matches;
  if (coarse) return true;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function useMobileRoomViewport(): boolean {
  const [mobile, setMobile] = useState(() => isMobileRoomViewport());

  useEffect(() => {
    const sync = () => setMobile(isMobileRoomViewport());
    sync();
    const mq = window.matchMedia('(max-width: 767px), (pointer: coarse)');
    mq.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return mobile;
}
