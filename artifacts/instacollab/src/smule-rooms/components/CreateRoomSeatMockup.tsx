import type { ReactNode } from 'react';
import { Mic, Sofa, Tv, Gamepad2, Music2, Users2 } from 'lucide-react';
import { PREVIEW_AVATARS, buildPreviewPartySeats } from '../utils/roomModePreviewDemo';
import type { PendingCreateRoomBeauty } from '../utils/pendingCreateRoomBeauty';
import { CreateRoomLivePreview } from './CreateRoomLivePreview';

type CreateRoomSeatMockupProps = {
  mode: string;
  livePreviewEnabled?: boolean;
  initialSeatCount?: 2 | 4 | 8 | 16 | 24;
  onLiveSetupChange?: (setup: PendingCreateRoomBeauty) => void;
};

const INLINE_SEAT_MODES = new Set([
  'Chat',
  'Radio',
  'Game-Live',
  'Karaoke',
  'Party',
]);

function SeatChip({
  label,
  avatar,
  filled,
  accent = false,
  wide = false,
}: {
  label: string;
  avatar?: string | null;
  filled?: boolean;
  accent?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 ${wide ? 'min-w-[3.25rem]' : 'min-w-0'}`}
      aria-hidden
    >
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-full border ${
          wide ? 'h-11 w-11' : 'h-9 w-9'
        } ${
          accent
            ? 'border-cyan-400/70 bg-cyan-500/15 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
            : filled
              ? 'border-white/25 bg-slate-800'
              : 'border-dashed border-white/15 bg-slate-900/80'
        }`}
      >
        {filled && avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <Sofa size={wide ? 16 : 14} className="text-slate-500" />
        )}
      </div>
      <span className="max-w-[3.5rem] truncate text-[8px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
    </div>
  );
}

function StaffRow() {
  const seats = buildPreviewPartySeats(true);
  return (
    <div className="flex items-center justify-center gap-3">
      <SeatChip label="Co" avatar={seats.coowner?.avatar} filled={Boolean(seats.coowner)} />
      <SeatChip label="Host" avatar={seats.host?.avatar} filled accent wide />
      <SeatChip label="Boss" avatar={seats.admin?.avatar} filled={Boolean(seats.admin)} />
    </div>
  );
}

function GuestGrid({
  count,
  cols,
  filledIndexes,
}: {
  count: number;
  cols: number;
  filledIndexes: number[];
}) {
  const seats = buildPreviewPartySeats(true);
  const guestAvatars = [seats.no1?.avatar, seats.no2?.avatar, seats.no5?.avatar, PREVIEW_AVATARS.viewer1];
  return (
    <div
      className="grid justify-items-center gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }, (_, index) => {
        const filled = filledIndexes.includes(index);
        return (
          <SeatChip
            key={`g-${index}`}
            label={`No.${index + 1}`}
            avatar={filled ? guestAvatars[index % guestAvatars.length] : null}
            filled={filled}
          />
        );
      })}
    </div>
  );
}

function ChatLikeMockup({ title, icon: Icon }: { title: string; icon: typeof Mic }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        <Icon size={12} className="text-indigo-300" />
        {title} · seat layout
      </div>
      <StaffRow />
      <GuestGrid count={8} cols={4} filledIndexes={[0, 1, 4]} />
    </div>
  );
}

function WatchMockup() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        <Tv size={12} className="text-rose-300" />
        Watch · seat layout
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/50">
        <div className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-950">
          <img
            src={PREVIEW_AVATARS.watchThumb}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white">
              Shared screen
            </span>
          </div>
        </div>
      </div>
      <StaffRow />
      <GuestGrid count={9} cols={5} filledIndexes={[0, 1, 2]} />
    </div>
  );
}

function KaraokeMockup() {
  const seats = buildPreviewPartySeats(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        <Music2 size={12} className="text-fuchsia-300" />
        Karaoke · chorus stage
      </div>

      <div className="overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-b from-purple-900/40 to-black/50 shadow-inner">
        <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
          <img
            src={PREVIEW_AVATARS.guest1}
            alt=""
            className="h-8 w-8 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-black text-white">Shape of You</p>
            <p className="text-[8px] font-bold text-pink-300">Melodia is singing</p>
          </div>
          <span className="rounded-full bg-pink-500/20 px-2 py-0.5 text-[8px] font-black text-pink-200">
            LIVE
          </span>
        </div>
        <div className="space-y-1 px-4 py-3 text-center">
          <p className="text-[10px] font-bold text-white/35">
            The club isn&apos;t the best place to find a lover
          </p>
          <p className="text-[12px] font-black text-white drop-shadow-[0_0_12px_rgba(236,72,153,0.45)]">
            So the bar is where I go
          </p>
          <p className="text-[10px] font-bold text-white/35">
            Me and my friends at the table doing shots
          </p>
        </div>
        <div className="mx-3 mb-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-pink-500 to-purple-500" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <SeatChip label="Host" avatar={seats.host?.avatar} filled accent wide />
        <SeatChip label="Co" avatar={seats.coowner?.avatar} filled={Boolean(seats.coowner)} />
      </div>
      <GuestGrid count={12} cols={6} filledIndexes={[0, 1, 4]} />
    </div>
  );
}

function GameMockup() {
  const seats = buildPreviewPartySeats(true);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        <Gamepad2 size={12} className="text-emerald-300" />
        Game · live cast
      </div>

      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
        <div className="relative aspect-video">
          <img
            src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=450&fit=crop"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />
          <div className="absolute left-2.5 top-2.5 rounded-full border border-emerald-500/30 bg-emerald-950/55 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-200">
            Game Live
          </div>
          <div className="absolute bottom-2 left-2 max-w-[55%] rounded-lg border border-white/10 bg-black/55 px-2 py-1.5 backdrop-blur-sm">
            <p className="text-[8px] font-bold text-emerald-200">@viewer</p>
            <p className="truncate text-[9px] font-semibold text-white/90">nice clutch!</p>
          </div>
          <div className="absolute bottom-2 right-2 h-[4.25rem] w-[5.5rem] overflow-hidden rounded-xl border border-white/25 shadow-[0_0_16px_rgba(0,0,0,0.45)]">
            <img src={PREVIEW_AVATARS.host} alt="" className="h-full w-full object-cover" />
            <span className="absolute left-1 top-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[7px] font-black uppercase text-white">
              Host
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5 px-0.5">
        <SeatChip label="No.1" avatar={seats.no1?.avatar} filled={Boolean(seats.no1)} />
        <SeatChip label="No.2" avatar={seats.no2?.avatar} filled={Boolean(seats.no2)} />
        <SeatChip label="No.3" avatar={seats.no3?.avatar} filled={Boolean(seats.no3)} />
        <SeatChip label="No.4" avatar={null} filled={false} />
        <SeatChip label="No.5" avatar={seats.no5?.avatar} filled={Boolean(seats.no5)} />
      </div>
      <div className="grid grid-cols-5 gap-1.5 px-0.5">
        <SeatChip label="No.6" avatar={null} filled={false} />
        <SeatChip label="No.7" avatar={null} filled={false} />
        <SeatChip label="No.8" avatar={null} filled={false} />
        <SeatChip label="No.9" avatar={null} filled={false} />
        <SeatChip label="No.10" avatar={null} filled={false} />
      </div>

      <p className="text-center text-[9px] font-semibold text-slate-500">
        Host: fullscreen cast + camera PiP. Viewer: Watch Together layout — cast player + 10 guest sofas (no host seat).
      </p>
    </div>
  );
}

export function CreateRoomSeatMockup({
  mode,
  livePreviewEnabled = true,
  initialSeatCount,
  onLiveSetupChange,
}: CreateRoomSeatMockupProps) {
  let body: ReactNode;
  switch (mode) {
    case 'Chat':
      body = <ChatLikeMockup title="Chat" icon={Mic} />;
      break;
    case 'Radio':
      body = <WatchMockup />;
      break;
    case 'Game-Live':
      body = <GameMockup />;
      break;
    case 'Karaoke':
      body = <KaraokeMockup />;
      break;
    case 'Party':
      body = <ChatLikeMockup title="Party" icon={Users2} />;
      break;
    case 'Multi-Guest':
    case 'Solo-Live':
    case 'Commerce-Live':
      return (
        <CreateRoomLivePreview
          mode={mode as 'Solo-Live' | 'Commerce-Live' | 'Multi-Guest'}
          enabled={livePreviewEnabled}
          fill
          initialSeatCount={initialSeatCount}
          onSetupChange={onLiveSetupChange}
        />
      );
    default:
      body = <ChatLikeMockup title="Room" icon={Mic} />;
  }

  return (
    <section
      className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      aria-label={`${mode} seat mockup`}
    >
      {body}
      {INLINE_SEAT_MODES.has(mode) ? (
        <p className="mt-3 text-center text-[10px] leading-relaxed text-slate-500">
          {mode === 'Party'
            ? 'Full party stage — 8 guest seats, sing & chat. PK battles are Solo Live and Shop Live only.'
            : mode === 'Game-Live'
              ? 'Host casts fullscreen with camera PiP. Viewers get Watch Together layout: cast player + 10 guest sofas (no host seat).'
              : mode === 'Karaoke'
                ? 'Chorus stage with lyrics, host/co seats, and 12 guest sofas (2×6).'
                : 'In-room seat preview — empty seats stay open for guests.'}
        </p>
      ) : null}
    </section>
  );
}
