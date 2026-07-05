/**
 * Instant tap targets — 0 click-delay, immediate press feedback, no 300ms mobile lag.
 * Use on every button, nav item, grid cell, and widget control.
 */

/** Base: removes 300ms touch delay + grey flash; instant active feedback. */
export const instantTapClass =
  'tap-instant touch-manipulation cursor-pointer select-none active:opacity-90';

/** Shared classes so nav controls respond reliably on touch devices. */
export const navTapButtonClass = `${instantTapClass} nav-tap-button`;

export const navTapIconButtonClass = `${navTapButtonClass} inline-flex items-center justify-center min-h-[44px] min-w-[44px]`;

export const navTapRowButtonClass = `${navTapButtonClass} inline-flex items-center gap-4 w-full min-h-[44px]`;

/** Cards / grid cells / list rows that navigate or toggle. */
export const instantCardTapClass = `${instantTapClass} active:scale-[0.99]`;
