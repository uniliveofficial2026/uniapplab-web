import type { RefObject } from 'react';

/** Hidden media sink — LiveKit attaches here; UI mirrors streams into fullscreen / PiP. */
export function ChatCallMediaHost({
  remoteAudioRef,
  remoteVideoRef,
  localVideoRef,
}: {
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  localVideoRef: RefObject<HTMLVideoElement | null>;
}) {
  return (
    <div
      className="fixed w-px h-px overflow-hidden opacity-0 pointer-events-none"
      style={{ left: -9999, top: -9999 }}
      aria-hidden
    >
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <video ref={remoteVideoRef} autoPlay playsInline />
      <video ref={localVideoRef} autoPlay playsInline muted />
    </div>
  );
}
