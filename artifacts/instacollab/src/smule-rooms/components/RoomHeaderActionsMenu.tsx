import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export type RoomHeaderMenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  hidden?: boolean;
  badge?: string | number;
};

function resolveMenuPortalRoot(): HTMLElement {
  return (
    document.querySelector<HTMLElement>('.karaoke-smule-room-embed') ??
    document.querySelector<HTMLElement>('.room-shell') ??
    document.body
  );
}

export function RoomHeaderActionsMenu({
  items,
  className = '',
  menuLabel = 'Room actions',
}: {
  items: RoomHeaderMenuItem[];
  className?: string;
  menuLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const visibleItems = items.filter((item) => !item.hidden);

  const updateMenuPosition = useCallback(() => {
    const anchor = rootRef.current;
    if (!anchor) return;

    const root = resolveMenuPortalRoot();
    setPortalRoot(root);

    const anchorRect = anchor.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();

    setMenuPosition({
      top: anchorRect.bottom - rootRect.top + 6,
      right: rootRect.right - anchorRect.right,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const menuPanel =
    open && menuPosition && portalRoot ? (
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label={menuLabel}
        style={{ top: menuPosition.top, right: menuPosition.right }}
        className="pointer-events-auto fixed z-[400] min-w-[12.5rem] overflow-hidden rounded-xl border border-white/10 bg-[#1a0f2e]/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            onClick={() => {
              item.onClick();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-gray-100 transition hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-300">
              {item.icon}
            </span>
            <span className="min-w-0 flex-1 font-semibold">{item.label}</span>
            {item.badge != null && Number(item.badge) > 0 ? (
              <span className="shrink-0 rounded-full bg-[#d946ef] px-1.5 py-0.5 text-[10px] font-black text-white">
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={menuLabel}
        title={menuLabel}
        className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-gray-300 transition hover:border-purple-400/40 hover:bg-purple-500/20 hover:text-purple-100 active:scale-90"
      >
        <MoreVertical size={16} aria-hidden />
      </button>

      {menuPanel && portalRoot ? createPortal(menuPanel, portalRoot) : null}
    </div>
  );
}
