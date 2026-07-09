import React, { useEffect } from 'react';
import { KaraokeSmuleRoomFlow } from '../karaoke/KaraokeSmuleRoomFlow';

type AdminEmbedRoomHostProps = {
  roomId: string;
};

/** Full-viewport host for admin iframe — verbatim live/party room UX (LiveKit, chat, gifts, beauty). */
export function AdminEmbedRoomHost({ roomId }: AdminEmbedRoomHostProps) {
  const safeId = String(roomId || '').trim();
  const initialPath = `/room/${safeId}`;

  useEffect(() => {
    document.documentElement.classList.add('admin-embed-room-active');
    document.body.classList.add('admin-embed-room-active');
    return () => {
      document.documentElement.classList.remove('admin-embed-room-active');
      document.body.classList.remove('admin-embed-room-active');
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" data-admin-embed-room={safeId}>
      <KaraokeSmuleRoomFlow
        onClose={() => {
          /* iframe preview — no-op close */
        }}
        initialPath={initialPath}
        flowEntry="admin-embed"
        embedVariant="full"
        flowKey={Number(safeId.replace(/\D/g, '').slice(0, 9)) || 1}
      />
    </div>
  );
}
