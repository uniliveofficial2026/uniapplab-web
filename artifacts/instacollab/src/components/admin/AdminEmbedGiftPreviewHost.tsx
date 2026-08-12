import React, { useEffect, useState } from 'react';
import { GiftPlayOverlay } from '../../smule-rooms/components/GiftPlayOverlay';
import type { GiftPlayPayload } from '../../smule-rooms/utils/liveRoomTypes';

export const ADMIN_GIFT_PREVIEW_READY = 'admin-gift-preview-ready';
export const ADMIN_GIFT_PREVIEW_PLAY = 'admin-gift-preview-play';

function isGiftPayload(value: unknown): value is GiftPlayPayload {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.giftName === 'string' && typeof row.action === 'string';
}

/** Full-viewport host for Creation Studio gift preview iframe (mobile screen). */
export function AdminEmbedGiftPreviewHost() {
  const [gift, setGift] = useState<GiftPlayPayload | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('admin-embed-gift-preview-active');
    document.body.classList.add('admin-embed-gift-preview-active');
    return () => {
      document.documentElement.classList.remove('admin-embed-gift-preview-active');
      document.body.classList.remove('admin-embed-gift-preview-active');
    };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; payload?: unknown } | null;
      if (!data || data.type !== ADMIN_GIFT_PREVIEW_PLAY) return;
      if (!isGiftPayload(data.payload)) return;
      setGift({ ...data.payload, playId: data.payload.playId ?? `preview-${Date.now()}` });
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: ADMIN_GIFT_PREVIEW_READY }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-zinc-950" data-admin-embed-gift-preview>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 20%, rgba(99,102,241,0.28), transparent 55%), linear-gradient(180deg, #1c1c22 0%, #09090b 55%, #000 100%)',
        }}
      />
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-full bg-white/15 ring-1 ring-white/20" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-white truncate">Live room</div>
            <div className="text-[9px] text-white/55">Gift preview</div>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-red-500/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
          Live
        </span>
      </div>

      <GiftPlayOverlay gift={gift} onDone={() => setGift(null)} />

      {!gift ? (
        <div className="absolute inset-0 z-[10] flex items-center justify-center px-6 text-center text-[11px] font-semibold text-white/45">
          Tap Preview effect in the studio to play here
        </div>
      ) : null}
    </div>
  );
}
