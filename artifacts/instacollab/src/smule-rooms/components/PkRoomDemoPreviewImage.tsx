import { useState } from 'react';
import { PK_PARTY_PREVIEW_IMAGE } from '../utils/roomModePreviewDemo';

type PkRoomDemoPreviewImageProps = {
  fill?: boolean;
  className?: string;
};

/** Single static PK room demo screenshot — informational only on Create Room. */
export function PkRoomDemoPreviewImage({ fill = false, className = '' }: PkRoomDemoPreviewImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`pk-room-demo-preview ${fill ? 'pk-room-demo-preview--fill' : ''} ${className}`.trim()}
    >
      {failed ? (
        <div className="pk-room-demo-preview-fallback" aria-hidden>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300/80">PK room</p>
          <p className="mt-2 max-w-[12rem] text-center text-[11px] leading-relaxed text-white/55">
            1v1 battle · split rooms · score bar
          </p>
        </div>
      ) : (
        <img
          src={PK_PARTY_PREVIEW_IMAGE}
          alt="PK party room layout demo"
          className="pk-room-demo-preview-img"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
