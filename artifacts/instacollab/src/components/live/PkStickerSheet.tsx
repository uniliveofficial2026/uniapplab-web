import { useMemo, useState } from 'react';
import { User } from 'lucide-react';
import { safeAvatarUrl } from '../../lib/safe';
import {
  V14_STICKERS,
  V14_STICKER_TABS,
  type LiveStickerPayload,
  type V14StickerSpec,
} from '../../smule-rooms/components/liveToolsV14Artwork';
import '../../smule-rooms/components/live-tools-approved-v15.css';
import { ONE_VS_ONE_PK_UI_IDS } from './OneVsOnePkRoom';
import { V14AnimatedStickerArtwork } from '../../smule-rooms/components/V14AnimatedArtwork';

export function PkStickerSheet({
  open,
  title,
  onClose,
  onPick,
  receiverName = 'Room',
  receiverAvatarUrl,
  senderId = '',
  roomId = '',
  onCycleReceiver,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onPick: (sticker: LiveStickerPayload) => void;
  receiverName?: string;
  receiverAvatarUrl?: string;
  senderId?: string;
  roomId?: string;
  onCycleReceiver?: () => void;
}) {
  const [tab, setTab] = useState('All');

  const visible = useMemo(() => {
    const allowed = new Set(V14_STICKER_TABS[tab] ?? V14_STICKER_TABS.All);
    return V14_STICKERS.filter((row) => allowed.has(row.id));
  }, [tab]);

  if (!open) return null;

  const receiverAvatar = safeAvatarUrl(receiverAvatarUrl || '');

  const sendSticker = (row: V14StickerSpec) => {
    const sentAt = Date.now();
    const payload: LiveStickerPayload = {
      type: 'sticker',
      stickerId: row.id,
      assetUrl: row.artwork,
      label: row.label,
      senderId,
      roomId,
      eventId: `sticker_${sentAt}_${row.id}_1`,
      sentAt,
      motion: row.motion,
      motionDurationMs: row.motionDurationMs,
      quantityIndex: 1,
      quantityTotal: 1,
    };
    onPick(payload);
    onClose();
  };

  return (
    <div className="lt15-overlay" data-ui-id="live.pk.sticker.v14.exact">
      <button type="button" className="lt15-scrim" onClick={onClose} aria-label="Close stickers" />
      <section className="lt15-sheet lt15-stickers" role="dialog" aria-modal="true" aria-label={title || 'Stickers'}>
        <div className="lt15-handle" />
        <div className="lt15-head">
          <div className="lt15-title">Stickers ✨</div>
        </div>
        <div className="lt15-tabs">
          {Object.keys(V14_STICKER_TABS).map((label) => (
            <button
              key={label}
              type="button"
              className={`lt15-tab ${tab === label ? 'is-active' : ''}`}
              onClick={() => setTab(label)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="lt15-sticker-grid">
          {visible.map((row) => (
            <button
              key={row.id}
              type="button"
              data-ui-id={`${ONE_VS_ONE_PK_UI_IDS.sticker}.${row.id}`}
              className="lt15-sticker-card"
              onClick={() => sendSticker(row)}
              aria-label={`Send ${row.label} sticker`}
            >
              <V14AnimatedStickerArtwork
                stickerId={row.id}
                src={row.artwork}
                alt={row.label}
                className="h-full w-full"
                imgClassName="h-full w-full object-cover"
                animate
                playKey={row.id}
              />
            </button>
          ))}
        </div>
        <div className="lt15-footer lt15-sticker-footer">
          <div
            className="lt15-recipient"
            role={onCycleReceiver ? 'button' : undefined}
            tabIndex={onCycleReceiver ? 0 : undefined}
            onClick={onCycleReceiver}
            onKeyDown={(event) => {
              if (!onCycleReceiver || (event.key !== 'Enter' && event.key !== ' ')) return;
              event.preventDefault();
              onCycleReceiver();
            }}
          >
            <div className="lt15-recipient-avatar">
              {receiverAvatar ? <img src={receiverAvatar} alt="" /> : <User size={20} aria-hidden />}
            </div>
            <div>
              <small>Send to</small>
              <b>{receiverName}</b>
            </div>
            <span>›</span>
          </div>
        </div>
      </section>
    </div>
  );
}
