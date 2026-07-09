import { ScaledRoomModePreview } from './ScaledRoomModePreview';

type CreateRoomModePreviewProps = {
  mode: string;
  fill?: boolean;
};

const MODE_LABELS: Record<string, string> = {
  Chat: 'Chat room',
  Party: 'PK room demo',
  Karaoke: 'Karaoke chorus',
  Radio: 'Watch together',
  'Game-Live': 'Game live',
  'Multi-Guest': 'Multi-guest video',
  'Solo-Live': 'Solo live',
  'Commerce-Live': 'Shop live',
};

export function CreateRoomModePreview({ mode, fill }: CreateRoomModePreviewProps) {
  const label = MODE_LABELS[mode] ?? 'Room preview';
  const isPk = mode === 'Party';

  return (
    <section className={`space-y-3${fill ? ' flex min-h-0 flex-1 flex-col' : ''}`}>
      <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
        {label}
      </label>
      {isPk ? (
        <p className="text-[11px] leading-relaxed text-slate-400">
          Demo layout only — live PK rooms may differ while we finish the layout.
        </p>
      ) : null}
      <ScaledRoomModePreview mode={mode} />
    </section>
  );
}
