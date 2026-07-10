import type { ReactNode } from 'react';
import { Mic, Sofa, Tv, Gamepad2, Music2, Users2, Video, ShoppingBag, Swords } from 'lucide-react';
import { PREVIEW_AVATARS, buildPreviewPartySeats } from '../utils/roomModePreviewDemo';

type CreateRoomSeatMockupProps = {
  mode: string;
};

const INLINE_SEAT_MODES = new Set([
  'Chat',
  'Radio',
  'Game-Live',
  'Karaoke',
  'Multi-Guest',
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
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        <Music2 size={12} className="text-fuchsia-300" />
        Karaoke · chorus seats
      </div>
      <StaffRow />
      <GuestGrid count={12} cols={6} filledIndexes={[0, 1, 2, 6]} />
    </div>
  );
}

function MultiMockup() {
  const seats = buildPreviewPartySeats(true);
  const tiles = [
    { key: 'host', label: 'Host', avatar: seats.host?.avatar, span: true },
    { key: 'co', label: 'Co', avatar: seats.coowner?.avatar },
    { key: 'boss', label: 'Boss', avatar: seats.admin?.avatar },
    { key: '1', label: 'No.1', avatar: seats.no1?.avatar },
    { key: '2', label: 'No.2', avatar: seats.no2?.avatar },
    { key: '3', label: 'No.3', avatar: null },
    { key: '4', label: 'No.4', avatar: null },
    { key: '5', label: 'No.5', avatar: seats.no5?.avatar },
    { key: '6', label: 'No.6', avatar: null },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        <Users2 size={12} className="text-sky-300" />
        Multi · video seats
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className={`relative overflow-hidden rounded-lg border border-white/10 bg-slate-900 ${
              tile.span ? 'col-span-2 row-span-2 min-h-[5.5rem]' : 'aspect-square'
            }`}
          >
            {tile.avatar ? (
              <img src={tile.avatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Sofa size={14} className="text-slate-600" />
              </div>
            )}
            <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 py-0.5 text-[7px] font-black uppercase text-white">
              {tile.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PkMockup() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        <Swords size={12} className="text-amber-300" />
        PK · team seats
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-2">
          <p className="mb-2 text-center text-[9px] font-black uppercase text-rose-200">Red</p>
          <GuestGrid count={5} cols={3} filledIndexes={[0, 1]} />
        </div>
        <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-2">
          <p className="mb-2 text-center text-[9px] font-black uppercase text-sky-200">Blue</p>
          <GuestGrid count={5} cols={3} filledIndexes={[0]} />
        </div>
      </div>
    </div>
  );
}

function LaterMockup({ mode }: { mode: string }) {
  const isShop = mode === 'Commerce-Live';
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-slate-900/50 px-4 py-8 text-center">
      {isShop ? (
        <ShoppingBag size={22} className="text-emerald-300/80" />
      ) : (
        <Video size={22} className="text-violet-300/80" />
      )}
      <p className="text-xs font-bold text-slate-200">
        {isShop ? 'Shop layout coming next' : 'Solo layout coming next'}
      </p>
      <p className="max-w-xs text-[10px] leading-relaxed text-slate-500">
        Seat mockup for this mode will be added separately.
      </p>
    </div>
  );
}

export function CreateRoomSeatMockup({ mode }: CreateRoomSeatMockupProps) {
  let body: ReactNode;
  switch (mode) {
    case 'Chat':
      body = <ChatLikeMockup title="Chat" icon={Mic} />;
      break;
    case 'Radio':
      body = <WatchMockup />;
      break;
    case 'Game-Live':
      body = <ChatLikeMockup title="Game" icon={Gamepad2} />;
      break;
    case 'Karaoke':
      body = <KaraokeMockup />;
      break;
    case 'Multi-Guest':
      body = <MultiMockup />;
      break;
    case 'Party':
      body = <PkMockup />;
      break;
    case 'Solo-Live':
    case 'Commerce-Live':
      body = <LaterMockup mode={mode} />;
      break;
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
          In-room seat preview — empty seats stay open for guests.
        </p>
      ) : null}
    </section>
  );
}
