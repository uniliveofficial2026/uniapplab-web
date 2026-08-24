/**
 * Dev-only isolated render of approved V13 live-tool panels for screenshot comparison.
 * Open: /?live_tools_v13_probe=1
 */
import { createRoot } from 'react-dom/client';
import { LiveGiftsPanel } from '../smule-rooms/components/LiveGiftsPanel';
import { GuestManagementOverlay } from '../smule-rooms/components/GuestManagementOverlay';
import { GameLivePanel } from '../smule-rooms/components/GameLivePanel';
import { VoiceChangerSheet } from '../smule-rooms/components/VoiceChangerSheet';
import { LiveBeautySheet } from '../smule-rooms/components/LiveBeautySheet';
import { DEFAULT_GAME_STATE } from '../smule-rooms/utils/liveRoomTypes';
import type { PartyGiftDefinition } from '../smule-rooms/utils/roomGifts';
import type { PartySeatMap, RoomSeatKey } from '../smule-rooms/utils/roomSeats';
import '../smule-rooms/components/live-tools-approved-v13.css';

const MOCK_GIFTS: PartyGiftDefinition[] = [
  { id: 'lucky_clover', name: 'Lucky Bill', icon: '🍀', stars: 5 },
  { id: 'approved_enchanted_rose', name: 'Mystery Box', icon: '/live-gifts/approved-v12/UG-001_enchanted-rose.png', stars: 20 },
  { id: 'approved_royal_crown', name: 'Lucky Box', icon: '/live-gifts/approved-v12/UG-002_royal-crown.png', stars: 20 },
  { id: 'approved_crystal_heart', name: 'Mega Lucky Box', icon: '/live-gifts/approved-v12/UG-003_crystal-heart.png', stars: 100 },
  { id: 'approved_treasure_chest', name: 'Diamond Bag', icon: '/live-gifts/approved-v12/UG-004_treasure-chest.png', stars: 200 },
  { id: 'approved_moon_carriage', name: 'Mystery Chest', icon: '/live-gifts/approved-v12/UG-005_moon-carriage.png', stars: 300 },
  { id: 'coffee', name: 'Lucky Wheel', icon: '☕', stars: 50 },
  { id: 'balloon', name: 'Fortune Egg', icon: '🎈', stars: 100 },
  { id: 'approved_crystal_castle', name: 'Golden Egg', icon: '/live-gifts/approved-v12/UG-006_crystal-castle.png', stars: 200 },
  { id: 'approved_purple_supercar', name: 'Surprise Gift', icon: '/live-gifts/approved-v12/UG-007_purple-supercar.png', stars: 300 },
];

const MOCK_SEATS = {
  host: { userId: 'h1', name: 'UniQueen', avatar: '', isOwner: true, isSpeaking: true, stars: 125600 },
  no1: { userId: 'g1', name: 'UniAngel', avatar: '', isSpeaking: false, stars: 89300 },
  no2: { userId: 'g2', name: 'UniStar', avatar: '', isSpeaking: false, stars: 67200 },
  no3: { userId: 'g3', name: 'UniBaby', avatar: '', isSpeaking: true, stars: 45100 },
} as PartySeatMap;

const MOCK_GUEST_KEYS: RoomSeatKey[] = ['host', 'no1', 'no2', 'no3', 'no4'];

function ProbeApp({ panel }: { panel: string }) {
  const noop = () => undefined;
  return (
    <div
      id="live-tools-v13-probe-root"
      style={{
        width: 390,
        height: 844,
        margin: '0 auto',
        background: 'linear-gradient(180deg, #1a1035 0%, #0a0014 40%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35, background: 'url(/reference-approved/live-tools-v13/01-approved-gift-panel.png) center/cover' }} />
      {panel === 'gifts' ? (
        <div style={{ position: 'absolute', insetInline: 0, bottom: 0 }}>
          <LiveGiftsPanel
            gifts={MOCK_GIFTS}
            userCoins={12560}
            receiverName="UniPrince"
            isVip={false}
            onToggleVip={noop}
            onOpenRecharge={noop}
            onSendGift={noop}
          />
        </div>
      ) : null}
      {panel === 'guests' ? (
        <GuestManagementOverlay
          isOpen
          onClose={noop}
          activeSeats={MOCK_SEATS}
          onRemoveGuest={noop}
          onMuteGuest={noop}
          guestRequests={[]}
          onAcceptRequest={noop}
          onDeclineRequest={noop}
          onJoinSeat={noop}
          guestSeatKeys={MOCK_GUEST_KEYS}
        />
      ) : null}
      {panel === 'games' ? (
        <GameLivePanel
          open
          isHost
          state={DEFAULT_GAME_STATE}
          lastGame={null}
          selfUserId="u1"
          selfName="Probe"
          receiverName="UniPrince"
          onClose={noop}
          onStart={noop}
          onAnswer={noop}
          onNextRound={noop}
          onEnd={noop}
        />
      ) : null}
      {panel === 'voice' ? (
        <VoiceChangerSheet
          open
          effectId="studio"
          onEffectChange={noop}
          onClose={noop}
          monitorEnabled={false}
          onMonitorEnabledChange={noop}
          effectStrength={70}
          onEffectStrengthChange={noop}
        />
      ) : null}
      {panel === 'beauty' ? (
        <div style={{ position: 'absolute', insetInline: 0, bottom: 0 }}>
          <LiveBeautySheet
            isOpen
            onClose={noop}
            activeBeautyId="beauty-smooth"
            onSelectBeauty={noop}
            variant="bottom"
          />
        </div>
      ) : null}
    </div>
  );
}

export function mountLiveToolsV13Probe() {
  const params = new URLSearchParams(window.location.search);
  const panel = params.get('live_tools_v13_probe') || 'gifts';
  const root = document.getElementById('root');
  if (!root) return;
  createRoot(root).render(<ProbeApp panel={panel} />);
}
