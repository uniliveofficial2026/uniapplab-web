import { ScaledRoomModePreview } from './ScaledRoomModePreview';

type CreateRoomModePreviewProps = {
  mode: string;
  fill?: boolean;
};

const MODE_LABELS: Record<string, string> = {
  Chat: 'Chat room',
  Party: 'Party room',
  Karaoke: 'Karaoke chorus',
  Radio: 'Watch together',
  'Game-Live': 'Game live',
  'Multi-Guest': 'Multi-guest video',
  'Solo-Live': 'Solo live',
  'Commerce-Live': 'Shop live',
};

export function CreateRoomModePreview({ mode, fill }: CreateRoomModePreviewProps) {
  const label = MODE_LABELS[mode] ?? 'Room preview';

  return (
    <section className={`space-y-3${fill ? ' flex min-h-0 flex-1 flex-col' : ''}`}>
      <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
        {label}
      </label>
      {(mode === 'Solo-Live' || mode === 'Commerce-Live') ? (
        <p className="text-[11px] leading-relaxed text-slate-400">
          1v1 / Team PK is available in this live mode after you go live.
        </p>
      ) : null}
      <ScaledRoomModePreview mode={mode} />
    </section>
  );
}
