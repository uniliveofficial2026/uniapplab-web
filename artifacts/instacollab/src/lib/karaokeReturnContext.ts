import type { Tab } from '../types';
import { isKaraokeProfileSurface } from './profileSurface';

export type KaraokeProfileReturnContext =
  | { surface: 'karaoke'; tab: string }
  | { surface: 'app'; tab: Tab; useAppBack: true }
  | { surface: 'karaoke-party-room'; roomPath: string };

let appTabGetter: (() => Tab | null) | null = null;
let karaokeTabGetter: (() => string | null) | null = null;

export function registerAppTabGetter(getter: (() => Tab | null) | null): void {
  appTabGetter = getter;
}

export function registerKaraokeTabGetter(getter: (() => string | null) | null): void {
  karaokeTabGetter = getter;
}

/** Snapshot return target when opening a K-Star profile from an active party room. */
export function capturePartyRoomProfileReturnContext(): KaraokeProfileReturnContext | null {
  if (typeof localStorage === 'undefined') return null;
  const roomId = localStorage.getItem('activeRoomId')?.trim();
  if (!roomId) return null;
  return { surface: 'karaoke-party-room', roomPath: `/room/${roomId}` };
}

/** Snapshot where the user was before opening a shared K-Star profile. */
export function captureShareProfileReturnContext(): KaraokeProfileReturnContext {
  const partyContext = capturePartyRoomProfileReturnContext();
  if (partyContext) return partyContext;
  if (isKaraokeProfileSurface()) {
    const tab = karaokeTabGetter?.() ?? 'sing';
    return { surface: 'karaoke', tab };
  }
  const appTab = appTabGetter?.() ?? 'home';
  return { surface: 'app', tab: appTab, useAppBack: true };
}

/** True when a K-Star profile was opened from the main InstaCollab app (not from within K-Star). */
export function openedKaraokeProfileFromMainApp(
  context: KaraokeProfileReturnContext | null | undefined,
): boolean {
  return context?.surface === 'app' && context.useAppBack === true;
}

export function appTabBackLabel(tab: Tab): string {
  switch (tab) {
    case 'home':
      return 'Feed';
    case 'search':
      return 'Explore';
    case 'reels':
      return 'Reels';
    case 'messages':
      return 'Messages';
    case 'notifications':
      return 'Notifications';
    case 'profile':
      return 'Profile';
    case 'live':
      return 'Live';
    case 'workspace':
      return 'Workspace';
    case 'dating':
      return 'Dating';
    case 'karaoke':
      return 'K-Star';
    case 'wallet':
      return 'Wallet';
    case 'rooms':
      return 'Party';
    case 'local-games':
      return 'Games';
    case 'third-party-games':
      return 'Games';
    default:
      return 'Previous';
  }
}
