import React, { useEffect, useRef, useState } from 'react';
import { appBasePath } from '../../lib/appShellRoutes';
import type { GiftPlayPayload } from '../../smule-rooms/utils/liveRoomTypes';
import {
  ADMIN_GIFT_PREVIEW_PLAY,
  ADMIN_GIFT_PREVIEW_READY,
} from './AdminEmbedGiftPreviewHost';

type GiftPreviewPhoneFrameProps = {
  gift: GiftPlayPayload | null;
};

/** Fixed mobile phone bezel + iframe — does not stretch with the studio catalog height. */
export function GiftPreviewPhoneFrame({ gift }: GiftPreviewPhoneFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const pendingGiftRef = useRef<GiftPlayPayload | null>(null);

  const embedSrc = React.useMemo(() => {
    const base = appBasePath();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}${base}/admin-embed/gift-preview`;
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string } | null;
      if (data?.type !== ADMIN_GIFT_PREVIEW_READY) return;
      setReady(true);
      const pending = pendingGiftRef.current;
      if (pending && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: ADMIN_GIFT_PREVIEW_PLAY, payload: pending },
          window.location.origin,
        );
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    pendingGiftRef.current = gift;
    if (!gift || !ready || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: ADMIN_GIFT_PREVIEW_PLAY, payload: gift },
      window.location.origin,
    );
  }, [gift, ready]);

  return (
    <div className="self-start xl:sticky xl:top-4 mx-auto w-[min(100%,280px)]">
      <div className="rounded-[2.1rem] border-[3px] border-zinc-700/90 bg-zinc-900 p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
        <div className="mx-auto mb-2 flex h-5 w-[42%] items-center justify-center rounded-full bg-zinc-950">
          <div className="h-1.5 w-10 rounded-full bg-zinc-700" />
        </div>
        <div className="relative aspect-[9/19.5] w-full overflow-hidden rounded-[1.55rem] bg-black ring-1 ring-white/10">
          <iframe
            ref={iframeRef}
            src={embedSrc}
            title="Gift effect mobile preview"
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; fullscreen"
            loading="eager"
          />
        </div>
        <div className="mx-auto mt-2.5 h-1 w-12 rounded-full bg-zinc-600/80" />
      </div>
      <p className="mt-2 text-center text-[10px] font-bold text-muted-foreground">
        Mobile screen · SVGA / particle preview
      </p>
    </div>
  );
}
