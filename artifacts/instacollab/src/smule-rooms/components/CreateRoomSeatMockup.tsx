import type { ReactNode } from 'react';
import { useState } from 'react';
import { Mic, Sofa, Tv, Gamepad2, Music2, Users2, Swords, Users } from 'lucide-react';
import { PREVIEW_AVATARS, buildPreviewPartySeats } from '../utils/roomModePreviewDemo';
import type { PendingCreateRoomBeauty } from '../utils/pendingCreateRoomBeauty';
import { CreateRoomLivePreview } from './CreateRoomLivePreview';

type CreateRoomSeatMockupProps = {
  mode: string;
  livePreviewEnabled?: boolean;
  onLiveSetupChange?: (setup: PendingCreateRoomBeauty) => void;
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

      <p className="text-center text-[9px] font-semibold text-slate-500">
        Fullscreen game share with host camera PiP — no sofa seats
      </p>
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

function PkVideoTile({
  name,
  avatar,
  accent,
  large = false,
}: {
  name: string;
  avatar: string;
  accent: 'fuchsia' | 'cyan';
  large?: boolean;
}) {
  const ring =
    accent === 'fuchsia'
      ? 'border-fuchsia-400/50 shadow-[0_0_16px_rgba(232,121,249,0.25)]'
      : 'border-cyan-400/50 shadow-[0_0_16px_rgba(34,211,238,0.25)]';
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-black ${ring} ${
        large ? 'min-h-[7.5rem]' : 'aspect-square min-h-[3.5rem]'
      }`}
    >
      <img src={avatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white">
        {name}
      </span>
    </div>
  );
}

function PkScoreBar({ left, right, mode }: { left: number; right: number; mode: 'single' | 'team' }) {
  const total = Math.max(1, left + right);
  const leftPct = (left / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wide">
        <span className="text-fuchsia-200">{mode === 'team' ? 'Team A' : 'You'}</span>
        <span className="text-white/80">
          {left} : {right}
        </span>
        <span className="text-cyan-200">{mode === 'team' ? 'Team B' : 'Rival'}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-gradient-to-r from-fuchsia-600 to-fuchsia-400" style={{ width: `${leftPct}%` }} />
        <div className="h-full flex-1 bg-gradient-to-r from-cyan-400 to-cyan-600" />
      </div>
    </div>
  );
}

function PkMockup() {
  const [pkKind, setPkKind] = useState<'single' | 'team'>('single');
  const seats = buildPreviewPartySeats(true);
  const teamA = [
    { name: 'DJ Nova', avatar: PREVIEW_AVATARS.host },
    { name: 'Melodia', avatar: PREVIEW_AVATARS.guest1 },
    { name: 'Chou', avatar: PREVIEW_AVATARS.guest2 },
    { name: 'Soul', avatar: PREVIEW_AVATARS.guest3 },
  ];
  const teamB = [
    { name: 'Rival', avatar: PREVIEW_AVATARS.admin },
    { name: 'Ace', avatar: PREVIEW_AVATARS.viewer1 },
    { name: 'Kai', avatar: PREVIEW_AVATARS.viewer2 },
    { name: 'Rin', avatar: PREVIEW_AVATARS.viewer3 },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
          <Swords size={12} className="text-amber-300" />
          PK · video battle
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-black/40 p-0.5">
          {(
            [
              { id: 'single' as const, label: '1v1', icon: Swords },
              { id: 'team' as const, label: 'Team', icon: Users },
            ] as const
          ).map((option) => {
            const Icon = option.icon;
            const selected = pkKind === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setPkKind(option.id)}
                className={`flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide transition ${
                  selected
                    ? 'bg-indigo-500/30 text-indigo-100'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon size={11} aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-2">
        <PkScoreBar
          left={pkKind === 'single' ? 1280 : 3640}
          right={pkKind === 'single' ? 980 : 2910}
          mode={pkKind}
        />

        {pkKind === 'single' ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PkVideoTile
              name={seats.host?.name ?? 'You'}
              avatar={PREVIEW_AVATARS.host}
              accent="fuchsia"
              large
            />
            <PkVideoTile name="Rival" avatar={PREVIEW_AVATARS.admin} accent="cyan" large />
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="space-y-1.5 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-1.5">
              <p className="text-center text-[8px] font-black uppercase tracking-wide text-fuchsia-200">
                Team A · 4 video
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {teamA.map((fighter) => (
                  <PkVideoTile
                    key={fighter.name}
                    name={fighter.name}
                    avatar={fighter.avatar}
                    accent="fuchsia"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-1.5">
              <p className="text-center text-[8px] font-black uppercase tracking-wide text-cyan-200">
                Team B · 4 video
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {teamB.map((fighter) => (
                  <PkVideoTile
                    key={fighter.name}
                    name={fighter.name}
                    avatar={fighter.avatar}
                    accent="cyan"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="mt-2 text-center text-[9px] font-semibold text-slate-500">
          {pkKind === 'single'
            ? '1v1 video PK — two live stages with a shared score bar'
            : 'Team video PK — up to 4 fighters per side on a split stage'}
        </p>
      </div>
    </div>
  );
}

export function CreateRoomSeatMockup({
  mode,
  livePreviewEnabled = true,
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
    case 'Multi-Guest':
      body = <MultiMockup />;
      break;
    case 'Party':
      body = <PkMockup />;
      break;
    case 'Solo-Live':
    case 'Commerce-Live':
      body = (
        <CreateRoomLivePreview
          mode={mode}
          enabled={livePreviewEnabled}
          onSetupChange={onLiveSetupChange}
        />
      );
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
          {mode === 'Party'
            ? 'Toggle 1v1 or Team above to preview the video PK stage.'
            : mode === 'Game-Live'
              ? 'Game Live casts the screen — viewers watch with floating chat.'
              : mode === 'Karaoke'
                ? 'Chorus stage with lyrics, host/co seats, and 12 guest sofas (2×6).'
                : 'In-room seat preview — empty seats stay open for guests.'}
        </p>
      ) : null}
    </section>
  );
}
