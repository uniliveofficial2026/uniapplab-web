import React, { useRef, useState } from 'react';
import { Camera, Loader2, Video, X } from 'lucide-react';
import { isDeepARConfigured } from '../../lib/deepar/deeparConfig';
import { useDeepAR } from '../../lib/deepar/useDeepAR';
import { DeepAREffectPicker } from './DeepAREffectPicker';

export type DeepARCameraCaptureProps = {
  open: boolean;
  onClose: () => void;
  /** Photo data URL or video blob */
  onCaptured: (payload: { kind: 'photo' | 'video'; url: string; blob?: Blob }) => void;
  title?: string;
};

export function DeepARCameraCapture({
  open,
  onClose,
  onCaptured,
  title = 'AR Camera',
}: DeepARCameraCaptureProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [recording, setRecording] = useState(false);
  const configured = isDeepARConfigured();

  const deepar = useDeepAR({
    previewRef,
    enabled: open && configured,
  });

  if (!open) return null;

  const handlePhoto = async () => {
    const dataUrl = await deepar.takeScreenshot();
    if (!dataUrl) return;
    onCaptured({ kind: 'photo', url: dataUrl });
    onClose();
  };

  const handleToggleVideo = async () => {
    if (!recording) {
      await deepar.startVideoRecording(true);
      setRecording(true);
      return;
    }
    const blob = await deepar.finishVideoRecording();
    setRecording(false);
    if (!blob) return;
    onCaptured({ kind: 'video', url: URL.createObjectURL(blob), blob });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[3200] flex flex-col bg-black" data-app-overlay-root>
      <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-black/80">
        <h2 className="text-white font-bold text-sm">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="Close AR camera"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {!configured ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white/80">
          <p className="font-semibold mb-2">DeepAR license required</p>
          <p className="text-sm max-w-sm">
            Add <code className="text-primary">VITE_DEEPAR_LICENSE_KEY</code> to your{' '}
            <code>.env</code> from{' '}
            <a
              href="https://developer.deepar.ai"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              developer.deepar.ai
            </a>
            , then restart the dev server.
          </p>
        </div>
      ) : (
        <>
          <div className="relative flex-1 min-h-0 bg-zinc-950">
            <div ref={previewRef} className="absolute inset-0 w-full h-full" />
            {deepar.permissionDenied ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white/90 gap-4">
                <p className="font-semibold">Camera permission required</p>
                <p className="text-sm text-white/70 max-w-sm">
                  Allow camera access in your browser settings, then reload.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold"
                >
                  Reload
                </button>
              </div>
            ) : null}
            {deepar.loading && !deepar.ready && !deepar.error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-3">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                {deepar.loadProgress > 0 && (
                  <p className="text-xs text-white/70">Loading AR… {deepar.loadProgress}%</p>
                )}
              </div>
            )}
            {deepar.error && !deepar.permissionDenied && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-red-300 text-sm">
                {deepar.error}
              </div>
            )}
          </div>

          <div className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-black/90 space-y-3">
            <DeepAREffectPicker
              activeEffectId={deepar.activeEffectId}
              onSelect={(id) => void deepar.switchEffect(id)}
              disabled={!deepar.ready || recording}
            />
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                disabled={!deepar.ready || recording}
                onClick={() => void handlePhoto()}
                className="flex flex-col items-center gap-1 text-white disabled:opacity-40"
              >
                <span className="w-14 h-14 rounded-full border-4 border-white flex items-center justify-center">
                  <Camera className="w-6 h-6" />
                </span>
                <span className="text-[10px] font-bold uppercase">Photo</span>
              </button>
              <button
                type="button"
                disabled={!deepar.ready}
                onClick={() => void handleToggleVideo()}
                className="flex flex-col items-center gap-1 text-white disabled:opacity-40"
              >
                <span
                  className={`w-14 h-14 rounded-full border-4 flex items-center justify-center ${
                    recording ? 'border-red-500 bg-red-500/20' : 'border-white'
                  }`}
                >
                  <Video className="w-6 h-6" />
                </span>
                <span className="text-[10px] font-bold uppercase">
                  {recording ? 'Stop' : 'Video'}
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
