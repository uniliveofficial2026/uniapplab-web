import React, { useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { isDeepARConfigured } from '../../lib/deepar/deeparConfig';
import { useDeepAR } from '../../lib/deepar/useDeepAR';
import { DeepAREffectPicker } from './DeepAREffectPicker';

export type DeepARLivePreviewProps = {
  enabled: boolean;
  className?: string;
  onReady?: (getStream: () => Promise<MediaStream | null>) => void;
  onError?: (message: string) => void;
};

/** Live broadcast preview with DeepAR effects — exposes processed stream via onReady. */
export function DeepARLivePreview({
  enabled,
  className = '',
  onReady,
  onError,
}: DeepARLivePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const configured = isDeepARConfigured();

  const deepar = useDeepAR({ previewRef, enabled: enabled && configured });

  React.useEffect(() => {
    if (deepar.error) onError?.(deepar.error);
  }, [deepar.error, onError]);

  React.useEffect(() => {
    if (deepar.ready) {
      onReady?.(() => deepar.getProcessedStream(30));
    }
  }, [deepar.ready, deepar, onReady]);

  if (!configured) {
    return (
      <div className={`rounded-lg border border-border bg-secondary/30 p-4 text-xs text-muted-foreground ${className}`}>
        Set <code>VITE_DEEPAR_LICENSE_KEY</code> in .env for AR live effects.
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg border border-border bg-black ${className}`}>
      <div ref={previewRef} className="w-full aspect-video" />
      {deepar.loading && !deepar.ready && !deepar.error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-2">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
          {deepar.loadProgress > 0 && (
            <span className="text-[10px] text-white/70">{deepar.loadProgress}%</span>
          )}
        </div>
      )}
      {deepar.ready && (
        <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
          <DeepAREffectPicker
            activeEffectId={deepar.activeEffectId}
            onSelect={(id) => void deepar.switchEffect(id)}
            className="max-w-full"
          />
        </div>
      )}
    </div>
  );
}
