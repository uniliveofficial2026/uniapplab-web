import { ChevronRight, LogOut, Mic, MicOff, Send, Sofa, Swords, User, Users } from 'lucide-react';
import { CoinIcon } from '../../components/common/CoinIcon';
import { RoomBackgroundLayer } from './RoomBackgroundLayer';
import { RoomLiveHeaderInfo } from './RoomLiveHeaderInfo';
import {
  PREVIEW_AVATARS,
  PREVIEW_CHAT_MESSAGES,
  PREVIEW_ROOM,
  buildPreviewPartySeats,
} from '../utils/roomModePreviewDemo';
import {
  formatGuestSeatNumber,
  formatMultiGuestSeatLabel,
  formatStaffSeatLabel,
  getMultiGuestVideoGridClass,
  getMultiGuestVideoLayout,
  splitChorusGuestSeatRows,
  splitPartyGuestSeatRows,
} from '../utils/roomSeats';
import { resolveRoomLayoutFromSettings } from '../utils/roomBackground';
import type { PartySeatMap, RoomGuest, RoomSeatKey } from '../utils/roomSeats';

const noop = () => {};
const noopMouse = (_event: React.MouseEvent) => {};

function PreviewHeader() {
  return (
    <div className="relative z-20 flex shrink-0 items-center justify-between gap-2 px-3 pt-2 pb-1">
      <RoomLiveHeaderInfo
        roomLevel={PREVIEW_ROOM.level}
        roomTitle={PREVIEW_ROOM.title}
        announcement={PREVIEW_ROOM.announcement}
        roomDisplayId={PREVIEW_ROOM.displayId}
        isRoomSaved={false}
        roomIdCopied={false}
        onOpenDetails={noop}
        onCopyRoomId={noopMouse}
        onToggleSaveRoom={noopMouse}
        className="max-w-[58%]"
      />
      <div className="flex shrink-0 items-center space-x-1.5">
        <div className="party-viewers-chip party-glass-chip flex min-h-[32px] items-center space-x-2 rounded-full px-2.5 py-1.5">
          <div className="-space-x-2 mr-0.5 flex">
            {[PREVIEW_AVATARS.viewer1, PREVIEW_AVATARS.viewer2, PREVIEW_AVATARS.viewer3].map((src, index) => (
              <img key={src} src={src} className="h-6 w-6 rounded-full border-2 border-[#07010a] object-cover" alt="" />
            ))}
          </div>
          <Users size={16} className="text-gray-300" />
          <span className="party-viewers-count font-black text-gray-100">{PREVIEW_ROOM.viewers}</span>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-gray-300"
          aria-hidden
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}

function PreviewOwnerStrip() {
  return (
    <div className="relative z-20 flex shrink-0 items-center gap-2 px-3 py-0.5">
      <div className="flex min-w-0 flex-1 items-center space-x-1.5 overflow-hidden">
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/40 py-0.5 pl-0.5 pr-2">
          <img src={PREVIEW_AVATARS.host} className="h-6 w-6 rounded-full object-cover" alt="" />
          <span className="max-w-[4.5rem] truncate text-[9px] font-black text-cyan-200">DJ Nova</span>
          <span className="flex items-center gap-0.5 rounded-full bg-black/60 px-1 py-0.5 text-[8px] font-black text-yellow-300">
            <CoinIcon className="h-2 w-2" />
            2.8k
          </span>
        </div>
        <div className="shrink-0 rounded-full px-2 py-0.5 text-[8.5px] font-bold text-teal-400 backdrop-blur">
          EXP {PREVIEW_ROOM.expToday}/{PREVIEW_ROOM.expCap}
          <ChevronRight size={8} className="ml-0.5 inline text-teal-500" />
        </div>
        <div className="shrink-0 rounded-full border border-pink-500/20 bg-[#240c1e]/80 px-2 py-0.5 text-[8.5px] font-bold text-pink-400 backdrop-blur">
          <CoinIcon className="mr-0.5 inline h-2 w-2" />
          {PREVIEW_ROOM.giftStars.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function PreviewChatFeed({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`party-chat-scroll space-y-2 overflow-hidden pr-1 ${compact ? 'max-h-[5.5rem]' : 'flex-1 min-h-0'}`}>
      {PREVIEW_CHAT_MESSAGES.map((message) => (
        <div key={message.user} className="flex flex-col space-y-1 pl-[2px]">
          <div className="flex items-center space-x-1.5">
            <img src={message.avatar} className="party-chat-avatar rounded-full border border-purple-500/30 object-cover" alt="" />
            <span className="party-chat-username font-black uppercase text-gray-300">{message.user}</span>
          </div>
          <div className="party-chat-bubble-indent w-fit max-w-[85%] rounded-2xl border border-white/5 bg-black/40 px-2.5 py-1.5 backdrop-blur-md">
            <p className="party-chat-bubble-text font-bold tracking-wide text-[#faf9f3]">{message.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewFooter() {
  return (
    <div className="relative z-20 shrink-0 border-t border-white/5 bg-black/50 px-3 py-2 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/15 text-cyan-300">
          <Mic size={14} />
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300">
          <Sofa size={14} />
        </div>
        <div className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[10px] text-gray-500">
          Let&apos;s talk…
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-300">
          <Send size={14} />
        </div>
      </div>
    </div>
  );
}

function StaffSeatBlock({
  seatKey,
  guest,
  variant,
}: {
  seatKey: 'host' | 'coowner' | 'admin';
  guest: RoomGuest | null;
  variant: 'host' | 'coowner' | 'admin';
}) {
  const label =
    seatKey === 'host' ? 'Host' : seatKey === 'coowner' ? 'Co-owner' : formatStaffSeatLabel('admin');
  const avatarRing =
    variant === 'host'
      ? 'party-host-avatar bg-gradient-to-tr from-cyan-400 via-purple-600 to-pink-500'
      : variant === 'coowner'
        ? 'party-coowner-avatar bg-gradient-to-tr from-amber-400 via-orange-500 to-yellow-500'
        : 'party-admin-avatar bg-gradient-to-tr from-violet-400 via-purple-500 to-fuchsia-500';

  if (!guest) {
    return (
      <div className={`party-${variant === 'admin' ? 'admin' : variant === 'coowner' ? 'coowner' : 'host'}-seat-block flex flex-col items-center`}>
        <div className="party-staff-seat-cell">
          <div className="party-empty-seat party-glass-tap flex items-center justify-center rounded-full">
            <User size={18} />
          </div>
          <span className="party-staff-seat-label mt-1.5 text-[10px] font-bold uppercase tracking-wide">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`party-${variant === 'admin' ? 'admin' : variant === 'coowner' ? 'coowner' : 'host'}-seat-block flex flex-col items-center`}>
      <div className="party-staff-seat-cell">
        <div className="relative overflow-visible">
          <div className={`relative rounded-full p-[2px] ${avatarRing}`}>
            <img src={guest.avatar} className="h-full w-full rounded-full border-2 border-[#07010a] object-cover" alt="" />
          </div>
          <div
            className={`absolute -bottom-0.5 -right-0.5 rounded-full border border-[#07010a] p-0.5 ${
              guest.isSpeaking ? 'bg-amber-500' : 'bg-red-500'
            }`}
          >
            {guest.isSpeaking ? <Mic size={10} className="text-white" /> : <MicOff size={10} className="text-white" strokeWidth={3} />}
          </div>
        </div>
        <span className="mt-1.5 max-w-[4rem] truncate text-center text-[10px] font-black tracking-wide text-white">{guest.name}</span>
        <div className="mt-1 flex items-center space-x-0.5 rounded-full border border-white/10 bg-black/75 px-1.5 py-[2px]">
          <CoinIcon className="h-2 w-2 shrink-0" />
          <span className="text-[8px] font-black font-mono leading-none text-yellow-300">{guest.stars}</span>
        </div>
      </div>
    </div>
  );
}

function GuestSeatCell({ seatKey, guest }: { seatKey: RoomSeatKey; guest: RoomGuest | null }) {
  const seatNum = formatGuestSeatNumber(seatKey);
  if (!guest) {
    return (
      <div className="flex flex-col items-center">
        <div className="party-empty-seat party-glass-seat-guest party-glass-tap flex items-center justify-center rounded-full">
          <Sofa size={16} strokeWidth={2.2} className="h-4 w-4" />
        </div>
        <span className="party-guest-seat-number mt-1 text-[9px] font-black uppercase tracking-wider">NO.{seatNum}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="party-guest-avatar relative rounded-full border-2 border-pink-500/50 p-[2px]">
        <img src={guest.avatar} className="h-full w-full rounded-full border-2 border-black object-cover" alt="" />
      </div>
      <span className="mt-1 max-w-[3.25rem] truncate text-[9px] font-bold text-white">{guest.name}</span>
      <div className="mt-1 flex items-center space-x-0.5 rounded-full border border-white/10 bg-black/75 px-1.5 py-[2px]">
        <CoinIcon className="h-[7px] w-[7px] shrink-0" />
        <span className="text-[8px] font-black font-mono leading-none text-yellow-300">{guest.stars}</span>
      </div>
    </div>
  );
}

function PartyLayoutPreview({
  seats,
  showAdmin,
  showPkBanner,
  chatDominant,
}: {
  seats: PartySeatMap;
  showAdmin: boolean;
  showPkBanner?: boolean;
  chatDominant?: boolean;
}) {
  const guestRows = splitPartyGuestSeatRows(
    Object.keys(seats).filter((key) => key.startsWith('guest')) as RoomSeatKey[],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#07010a] font-sans text-white">
      <RoomBackgroundLayer mode={{ type: 'css', value: 'bg-radial-gradient' }} />
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <PreviewHeader />
        <PreviewOwnerStrip />

        {showPkBanner ? (
          <div className="relative z-20 mx-3 mt-1 flex justify-center">
            <div className="flex items-center gap-2 rounded-full border border-blue-400/40 bg-gradient-to-r from-blue-950/90 via-indigo-900/80 to-blue-950/90 px-3 py-1 shadow-[0_0_20px_rgba(59,130,246,0.25)]">
              <Swords size={12} className="text-blue-300" />
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-100">PK Battle Live</span>
            </div>
          </div>
        ) : null}

        <div
          id="party-room-body"
          className={`party-seats-stage relative z-10 flex w-full shrink-0 flex-col items-center overflow-hidden px-2 py-1 ${
            chatDominant ? 'max-h-[38%]' : ''
          }`}
        >
          <div className="party-host-seat-row party-seat-grid relative z-10">
            <StaffSeatBlock seatKey="host" guest={seats.host} variant="host" />
            <StaffSeatBlock seatKey="coowner" guest={seats.coowner} variant="coowner" />
            {showAdmin ? <StaffSeatBlock seatKey="admin" guest={seats.admin} variant="admin" /> : null}
          </div>

          <div className="party-guest-seat-rows relative z-10 w-full max-w-full px-1">
            {guestRows.map((rowKeys) => (
              <div key={rowKeys.join('-')} className="party-seat-grid">
                {rowKeys.map((key) => (
                  <GuestSeatCell key={key} seatKey={key} guest={seats[key]} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="party-chat-grid room-conversation relative z-10 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden px-3">
          <PreviewChatFeed compact={chatDominant} />
        </div>

        <PreviewFooter />
      </div>
    </div>
  );
}

function ChorusLayoutPreview() {
  const seats = buildPreviewPartySeats(false);
  const guestRows = splitChorusGuestSeatRows(
    Object.keys(seats).filter((key) => key.startsWith('guest')) as RoomSeatKey[],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#07010a] font-sans text-white">
      <RoomBackgroundLayer mode={{ type: 'css', value: 'bg-radial-gradient' }} />
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <PreviewHeader />
        <PreviewOwnerStrip />

        <div className="chorus-room-stage room-stage relative z-10 flex min-h-0 shrink-0 flex-col overflow-hidden">
          <div className="chorus-performance-stage relative mx-3 mt-1 flex shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-purple-900/40 to-black/40 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
              <img
                src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80"
                className="h-8 w-8 rounded-lg object-cover"
                alt=""
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-black text-white">Shape of You</p>
                <p className="text-[8px] font-bold text-pink-300">Melodia is singing</p>
              </div>
              <span className="rounded-full bg-pink-500/20 px-2 py-0.5 text-[8px] font-black text-pink-200">LIVE</span>
            </div>
            <div className="space-y-1 px-4 py-3 text-center">
              <p className="text-[11px] font-bold text-white/35">The club isn&apos;t the best place to find a lover</p>
              <p className="text-[13px] font-black text-white drop-shadow-[0_0_12px_rgba(236,72,153,0.45)]">
                So the bar is where I go
              </p>
              <p className="text-[11px] font-bold text-white/35">Me and my friends at the table doing shots</p>
            </div>
            <div className="mx-3 mb-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-pink-500 to-purple-500" />
            </div>
          </div>

          <div id="party-room-body" className="party-seats-stage relative z-10 flex w-full shrink-0 flex-col items-center overflow-hidden px-2 py-1">
            <div className="party-host-seat-row party-seat-grid relative z-10">
              <StaffSeatBlock seatKey="host" guest={seats.host} variant="host" />
              <StaffSeatBlock seatKey="coowner" guest={seats.coowner} variant="coowner" />
            </div>
            <div className="party-guest-seat-rows relative z-10 w-full">
              {guestRows.map((rowKeys) => (
                <div
                  key={rowKeys.join('-')}
                  className="grid w-full gap-1"
                  style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}
                >
                  {rowKeys.map((key) => (
                    <GuestSeatCell key={key} seatKey={key} guest={seats[key]} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="party-chat-grid relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-3">
          <PreviewChatFeed />
        </div>
        <PreviewFooter />
      </div>
    </div>
  );
}

function GameLiveLayoutPreview() {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#07010a] font-sans text-white">
      <RoomBackgroundLayer mode={{ type: 'css', value: 'bg-radial-gradient' }} />
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <PreviewHeader />
        <PreviewOwnerStrip />

        <div className="game-live-stage relative mx-0 mt-0 min-h-0 flex-1">
          <img
            src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=450&fit=crop"
            className="game-live-screen-video object-cover"
            alt=""
          />
          <div className="absolute left-3 top-14 rounded-full border border-emerald-500/25 bg-emerald-950/50 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-200">
            Game Live
          </div>
          <div className="game-live-pip">
            <img src={PREVIEW_AVATARS.host} className="h-full w-full object-cover" alt="" />
            <span className="game-live-pip-label">HOST</span>
          </div>
        </div>

        <div className="relative z-10 shrink-0 px-3 py-1">
          <PreviewChatFeed compact />
        </div>
        <PreviewFooter />
      </div>
    </div>
  );
}

function WatchTogetherLayoutPreview() {
  const seats = buildPreviewPartySeats(false);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#07010a] font-sans text-white">
      <RoomBackgroundLayer mode={{ type: 'css', value: 'bg-radial-gradient' }} />
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <PreviewHeader />
        <PreviewOwnerStrip />

        <div className="watch-together-player-frame relative mx-3 mt-1 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black">
          <img src={PREVIEW_AVATARS.watchThumb} className="h-full w-full object-cover" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          <div className="absolute bottom-2 left-2 rounded bg-red-600 px-1.5 py-0.5 text-[8px] font-black text-white">WATCHING</div>
        </div>

        <div className="watch-together-seats shrink-0 px-2">
          <div className="party-host-seat-row party-seat-grid relative z-10">
            <StaffSeatBlock seatKey="host" guest={seats.host} variant="host" />
            <StaffSeatBlock seatKey="coowner" guest={seats.coowner} variant="coowner" />
          </div>
          <div className="watch-together-seat-grid-5">
            {(['no1', 'no2', 'no3', 'no4', 'no5'] as const).map((key) => (
              <div key={key} className="watch-together-seat-cell">
                <GuestSeatCell seatKey={key} guest={seats[key]} />
              </div>
            ))}
          </div>
        </div>

        <div className="watch-together-chat watch-together-chat-feed relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-3">
          <PreviewChatFeed />
        </div>
        <PreviewFooter />
      </div>
    </div>
  );
}

function MultiGuestLayoutPreview() {
  const gridClass = getMultiGuestVideoGridClass(16);
  const layout = getMultiGuestVideoLayout(16);

  return (
    <div className="multi-guest-layout relative flex h-full min-h-0 flex-col overflow-hidden bg-[#07010a] font-sans text-white">
      <RoomBackgroundLayer mode={{ type: 'css', value: 'bg-radial-gradient' }} />
      <div className="multi-guest-shell relative z-10 flex h-full min-h-0 flex-col">
        <header className="multi-guest-header shrink-0 bg-gradient-to-b from-black/90 via-black/80 to-transparent px-3 pb-1 pt-2">
          <PreviewHeader />
          <PreviewOwnerStrip />
        </header>

        <div className="multi-guest-stage min-h-0 flex-1">
          <div className={`multi-guest-video-grid ${gridClass} h-full`}>
            {layout.map((item) => {
              const label = formatMultiGuestSeatLabel(item.seatKey, 16, { uppercase: true });
              return (
                <div
                  key={item.seatKey}
                  className="multi-guest-video-tile relative overflow-hidden"
                  style={{
                    ...(item.gridColumn ? { gridColumn: item.gridColumn } : {}),
                    ...(item.gridRow ? { gridRow: item.gridRow } : {}),
                  }}
                >
                  <div className="multi-guest-video-tile-empty">
                    <div className="multi-guest-video-tile-empty-marker">
                      <Sofa size={16} className="multi-guest-video-tile-empty-icon" />
                      <span className="multi-guest-video-tile-label">{label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 shrink-0 px-3 py-2">
          <PreviewChatFeed compact />
        </div>
        <PreviewFooter />
      </div>
    </div>
  );
}

function SoloLayoutPreview({ commerce = false }: { commerce?: boolean }) {
  const seats = buildPreviewPartySeats(false);

  return (
    <div className="solo-live-layout relative flex h-full min-h-0 flex-col overflow-hidden bg-[#07010a] font-sans text-white">
      <RoomBackgroundLayer mode={{ type: 'css', value: 'bg-radial-gradient' }} />
      <div className="solo-live-shell relative z-10 flex h-full min-h-0 flex-col">
        <div className="solo-live-header relative z-30 shrink-0">
          <PreviewHeader />
          <PreviewOwnerStrip />
        </div>

        <div className="solo-live-stage relative min-h-0 flex-1">
          <img src={PREVIEW_AVATARS.soloVideo} className="solo-live-video solo-live-video--poster h-full w-full object-cover" alt="" />
          <div className="solo-live-stage-vignette pointer-events-none absolute inset-0" />
          <div className="solo-live-badge absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[9px] font-black text-white">
            <span className="solo-live-badge-dot h-1.5 w-1.5 rounded-full bg-white" />
            LIVE
          </div>

          {commerce ? (
            <div className="absolute bottom-24 left-3 right-3 rounded-xl border border-amber-400/30 bg-black/70 p-2 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <img
                  src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80"
                  className="h-10 w-10 rounded-lg object-cover"
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-black text-white">Wireless Earbuds Pro</p>
                  <p className="text-[9px] font-bold text-amber-300">$49.99 · 128 sold</p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500 px-2 py-1 text-[8px] font-black text-black">BUY</span>
              </div>
            </div>
          ) : null}

          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-3 px-3">
            {(['no1', 'no2', 'no3'] as const).map((key) => (
              <GuestSeatCell key={key} seatKey={key} guest={seats[key]} />
            ))}
          </div>
        </div>

        <div className="relative z-10 shrink-0 px-3 py-1">
          <PreviewChatFeed compact />
        </div>
        <PreviewFooter />
      </div>
    </div>
  );
}

type RoomModePreviewShellProps = {
  mode: string;
};

export function RoomModePreviewShell({ mode }: RoomModePreviewShellProps) {
  const layout = resolveRoomLayoutFromSettings(mode);

  if (layout.layout === 'Chorus') {
    return <ChorusLayoutPreview />;
  }
  if (layout.layout === 'WatchTogether') {
    return <WatchTogetherLayoutPreview />;
  }
  if (layout.layout === 'GameLive') {
    return <GameLiveLayoutPreview />;
  }
  if (layout.layout === 'MultiGuest') {
    return <MultiGuestLayoutPreview />;
  }
  if (layout.layout === 'SoloLive') {
    return <SoloLayoutPreview commerce={mode === 'Commerce-Live'} />;
  }
  if (mode === 'Party') {
    return (
      <PartyLayoutPreview
        seats={buildPreviewPartySeats(false)}
        showAdmin={false}
      />
    );
  }

  return (
    <PartyLayoutPreview
      seats={buildPreviewPartySeats(true)}
      showAdmin
      chatDominant
    />
  );
}
