import { useEffect, useRef, useState } from 'react';

type VirtualBackgroundLayerProps = {
  url: string;
  onDecodedSize?: (width: number, height: number) => void;
};

/**
 * Full-resolution virtual background — uses the original image URL (blob or HTTPS)
 * with a cover-fit layout. Avoids canvas CSS sizing, which often displays a tiny buffer stretched.
 */
export function VirtualBackgroundLayer({ url, onDecodedSize }: VirtualBackgroundLayerProps) {
  const [ready, setReady] = useState(false);
  const reportedRef = useRef('');

  useEffect(() => {
    setReady(false);
    reportedRef.current = '';
  }, [url]);

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden bg-black"
      style={{ isolation: 'isolate' }}
      aria-hidden
    >
      <img
        key={url}
        src={url}
        alt=""
        decoding="sync"
        fetchPriority="high"
        draggable={false}
        className={`pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 select-none transition-opacity duration-150 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          minWidth: '100%',
          minHeight: '100%',
          width: 'auto',
          height: 'auto',
          imageRendering: 'auto',
        }}
        onLoad={(event) => {
          const img = event.currentTarget;
          setReady(true);
          const key = `${url}|${img.naturalWidth}x${img.naturalHeight}`;
          if (reportedRef.current === key) return;
          reportedRef.current = key;
          onDecodedSize?.(img.naturalWidth, img.naturalHeight);
        }}
        onError={() => setReady(false)}
      />
    </div>
  );
}
