/** Shared classes so nav controls respond reliably on touch devices. */
export const navTapButtonClass =
  'nav-tap-button touch-manipulation cursor-pointer select-none active:opacity-85';

export const navTapIconButtonClass = `${navTapButtonClass} inline-flex items-center justify-center min-h-[44px] min-w-[44px]`;

export const navTapRowButtonClass = `${navTapButtonClass} inline-flex items-center gap-4 w-full min-h-[44px]`;
