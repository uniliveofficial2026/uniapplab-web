import type { BeautyPresetId } from '../../lib/ar/beautyFilters';
import type { PartyGiftDefinition } from '../utils/roomGifts';
import type { VoiceChangerEffectId } from '../utils/voiceEffects';

const ASSET_ROOT = '/live-tools-v14';

export type V14GiftSpec = {
  name: string;
  giftId: string;
  price: number;
  displayPrice?: string;
  artwork: string;
  motion: V14GiftMotionId;
  motionDurationMs: number;
  badge?: 'HOT' | 'NEW';
};

export type V14GiftMotionId =
  | 'bill-flutter'
  | 'mystery-wobble'
  | 'lucky-pop'
  | 'mega-bloom'
  | 'diamond-shine'
  | 'chest-bounce'
  | 'wheel-spin'
  | 'fortune-pulse'
  | 'golden-glow'
  | 'surprise-burst'
  | 'airplane-flight'
  | 'castle-rise'
  | 'carriage-glide'
  | 'whale-swim'
  | 'phoenix-soar';

export type V14GiftCard = V14GiftSpec & {
  assetId: string;
  gift: PartyGiftDefinition | null;
};

export const V14_GIFT_SPECS: readonly V14GiftSpec[] = [
  { name: 'Lucky Bill', giftId: 'v14_lucky_bill', price: 5, artwork: `${ASSET_ROOT}/gifts/lucky-bill.png`, motion: 'bill-flutter', motionDurationMs: 1700 },
  { name: 'Mystery Box', giftId: 'v14_mystery_box', price: 10, displayPrice: 'Custom', artwork: `${ASSET_ROOT}/gifts/mystery-box.png`, motion: 'mystery-wobble', motionDurationMs: 1800 },
  { name: 'Lucky Box', giftId: 'v14_lucky_box', price: 20, artwork: `${ASSET_ROOT}/gifts/lucky-box.png`, motion: 'lucky-pop', motionDurationMs: 1600 },
  { name: 'Mega Lucky Box', giftId: 'v14_mega_lucky_box', price: 100, artwork: `${ASSET_ROOT}/gifts/mega-lucky-box.png`, motion: 'mega-bloom', motionDurationMs: 2100 },
  { name: 'Diamond Bag', giftId: 'v14_diamond_bag', price: 200, artwork: `${ASSET_ROOT}/gifts/diamond-bag.png`, motion: 'diamond-shine', motionDurationMs: 2200 },
  { name: 'Mystery Chest', giftId: 'v14_mystery_chest', price: 300, artwork: `${ASSET_ROOT}/gifts/mystery-chest.png`, motion: 'chest-bounce', motionDurationMs: 2000 },
  { name: 'Lucky Wheel', giftId: 'v14_lucky_wheel', price: 50, artwork: `${ASSET_ROOT}/gifts/lucky-wheel.png`, motion: 'wheel-spin', motionDurationMs: 2200 },
  { name: 'Fortune Egg', giftId: 'v14_fortune_egg', price: 100, artwork: `${ASSET_ROOT}/gifts/fortune-egg.png`, motion: 'fortune-pulse', motionDurationMs: 1900 },
  { name: 'Golden Egg', giftId: 'v14_golden_egg', price: 200, artwork: `${ASSET_ROOT}/gifts/golden-egg.png`, motion: 'golden-glow', motionDurationMs: 2100 },
  { name: 'Surprise Gift', giftId: 'v14_surprise_gift', price: 300, artwork: `${ASSET_ROOT}/gifts/surprise-gift.png`, motion: 'surprise-burst', motionDurationMs: 2200 },
  { name: 'Love Airplane', giftId: 'v14_love_airplane', price: 500, artwork: `${ASSET_ROOT}/gifts/love-airplane.png`, motion: 'airplane-flight', motionDurationMs: 2600 },
  { name: 'Dream Castle', giftId: 'v14_dream_castle', price: 1000, artwork: `${ASSET_ROOT}/gifts/dream-castle.png`, motion: 'castle-rise', motionDurationMs: 2600 },
  { name: 'Crystal Carriage', giftId: 'v14_crystal_carriage', price: 1200, artwork: `${ASSET_ROOT}/gifts/crystal-carriage.png`, motion: 'carriage-glide', motionDurationMs: 2800 },
  { name: 'Galaxy Whale', giftId: 'v14_galaxy_whale', price: 1500, artwork: `${ASSET_ROOT}/gifts/galaxy-whale.png`, motion: 'whale-swim', motionDurationMs: 3000 },
  { name: 'Phoenix', giftId: 'v14_phoenix', price: 2000, artwork: `${ASSET_ROOT}/gifts/phoenix.png`, motion: 'phoenix-soar', motionDurationMs: 3200 },
];

function normalizeCatalogKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function buildV14GiftCards(gifts: readonly PartyGiftDefinition[]): V14GiftCard[] {
  const byId = new Map<string, PartyGiftDefinition>();
  const byName = new Map<string, PartyGiftDefinition>();
  gifts.forEach((gift) => {
    const id = normalizeCatalogKey(gift.id);
    const name = normalizeCatalogKey(gift.name);
    if (id) byId.set(id, gift);
    if (name) byName.set(name, gift);
  });

  return V14_GIFT_SPECS.map((spec) => {
    const mapped = byId.get(normalizeCatalogKey(spec.giftId)) ?? byName.get(normalizeCatalogKey(spec.name)) ?? null;
    return {
      ...spec,
      assetId: spec.giftId,
      // Preserve the authoritative backend ID/price/effect URLs while guaranteeing
      // that chat and fallback playback use the approved V14 artwork.
      gift: mapped ? { ...mapped, icon: spec.artwork } : null,
    };
  });
}

export function findV14GiftSpec(giftId?: string | null, giftName?: string | null): V14GiftSpec | undefined {
  const id = normalizeCatalogKey(giftId);
  const name = normalizeCatalogKey(giftName);
  return V14_GIFT_SPECS.find((spec) =>
    (id && normalizeCatalogKey(spec.giftId) === id) || (name && normalizeCatalogKey(spec.name) === name));
}

export type V14StickerSpec = {
  id: string;
  label: string;
  artwork: string;
  motion: V14StickerMotionId;
  motionDurationMs: number;
};

export type V14StickerMotionId =
  | 'hi-wave'
  | 'hello-bounce'
  | 'hey-pop'
  | 'night-float'
  | 'morning-rise'
  | 'love-heartbeat'
  | 'kiss-float'
  | 'hug-squeeze'
  | 'thanks-bow'
  | 'cute-tilt'
  | 'lol-shake'
  | 'wow-zoom'
  | 'hearts-float'
  | 'happy-bounce'
  | 'cry-tremble'
  | 'angry-rumble'
  | 'excited-jump'
  | 'sorry-bow'
  | 'shy-sway'
  | 'bye-wave';

export type LiveStickerPayload = {
  type: 'sticker';
  stickerId: string;
  assetUrl: string;
  label: string;
  senderId: string;
  roomId: string;
  eventId?: string;
  sentAt?: number;
  motion?: V14StickerMotionId;
  motionDurationMs?: number;
  quantityIndex?: number;
  quantityTotal?: number;
};

export const V14_STICKERS: readonly V14StickerSpec[] = [
  { id: 'hi', label: 'Hi!', artwork: `${ASSET_ROOT}/stickers/hi.png`, motion: 'hi-wave', motionDurationMs: 1500 },
  { id: 'hello', label: 'Hello!', artwork: `${ASSET_ROOT}/stickers/hello.png`, motion: 'hello-bounce', motionDurationMs: 1500 },
  { id: 'hey', label: 'Hey!', artwork: `${ASSET_ROOT}/stickers/hey.png`, motion: 'hey-pop', motionDurationMs: 1400 },
  { id: 'good-night', label: 'Good Night', artwork: `${ASSET_ROOT}/stickers/good-night.png`, motion: 'night-float', motionDurationMs: 2100 },
  { id: 'good-morning', label: 'Good Morning', artwork: `${ASSET_ROOT}/stickers/good-morning.png`, motion: 'morning-rise', motionDurationMs: 1800 },
  { id: 'love-you', label: 'Love You', artwork: `${ASSET_ROOT}/stickers/love-you.png`, motion: 'love-heartbeat', motionDurationMs: 1700 },
  { id: 'kiss', label: 'Kiss', artwork: `${ASSET_ROOT}/stickers/kiss.png`, motion: 'kiss-float', motionDurationMs: 1800 },
  { id: 'hug', label: 'Hug', artwork: `${ASSET_ROOT}/stickers/hug.png`, motion: 'hug-squeeze', motionDurationMs: 1700 },
  { id: 'thank-you', label: 'Thank You', artwork: `${ASSET_ROOT}/stickers/thank-you.png`, motion: 'thanks-bow', motionDurationMs: 1800 },
  { id: 'so-cute', label: 'So Cute', artwork: `${ASSET_ROOT}/stickers/so-cute.png`, motion: 'cute-tilt', motionDurationMs: 1700 },
  { id: 'lol', label: 'LOL', artwork: `${ASSET_ROOT}/stickers/lol.png`, motion: 'lol-shake', motionDurationMs: 1600 },
  { id: 'wow', label: 'Wow!', artwork: `${ASSET_ROOT}/stickers/wow.png`, motion: 'wow-zoom', motionDurationMs: 1500 },
  { id: 'happy-hearts', label: 'Happy Hearts', artwork: `${ASSET_ROOT}/stickers/happy-hearts.png`, motion: 'hearts-float', motionDurationMs: 2100 },
  { id: 'happy', label: 'Happy', artwork: `${ASSET_ROOT}/stickers/happy.png`, motion: 'happy-bounce', motionDurationMs: 1700 },
  { id: 'cry', label: 'Cry', artwork: `${ASSET_ROOT}/stickers/cry.png`, motion: 'cry-tremble', motionDurationMs: 1900 },
  { id: 'angry', label: 'Angry', artwork: `${ASSET_ROOT}/stickers/angry.png`, motion: 'angry-rumble', motionDurationMs: 1600 },
  { id: 'excited', label: 'Excited', artwork: `${ASSET_ROOT}/stickers/excited.png`, motion: 'excited-jump', motionDurationMs: 1700 },
  { id: 'sorry', label: 'Sorry', artwork: `${ASSET_ROOT}/stickers/sorry.png`, motion: 'sorry-bow', motionDurationMs: 1900 },
  { id: 'shy', label: 'Shy', artwork: `${ASSET_ROOT}/stickers/shy.png`, motion: 'shy-sway', motionDurationMs: 1800 },
  { id: 'bye-bye', label: 'Bye Bye', artwork: `${ASSET_ROOT}/stickers/bye-bye.png`, motion: 'bye-wave', motionDurationMs: 1900 },
];

export function findV14StickerSpec(stickerId?: string | null): V14StickerSpec | undefined {
  const id = normalizeCatalogKey(stickerId);
  return V14_STICKERS.find((spec) => normalizeCatalogKey(spec.id) === id);
}

const stickerIds = (...ids: string[]) => ids;
export const V14_STICKER_TABS: Record<string, string[]> = {
  All: V14_STICKERS.map((row) => row.id),
  Hi: stickerIds('hi', 'hello', 'hey', 'good-morning', 'good-night', 'bye-bye'),
  Love: stickerIds('love-you', 'kiss', 'hug', 'thank-you', 'so-cute', 'happy-hearts'),
  Fun: stickerIds('lol', 'wow', 'happy', 'excited'),
  Actions: stickerIds('hi', 'kiss', 'hug', 'bye-bye'),
  Emotions: stickerIds('happy-hearts', 'happy', 'cry', 'angry', 'excited', 'sorry', 'shy'),
  Luxury: stickerIds('so-cute', 'wow', 'happy-hearts'),
  Special: stickerIds('good-night', 'good-morning', 'thank-you'),
};

export type V14VoiceSpec = {
  id: VoiceChangerEffectId;
  label: string;
  artwork: string;
};

export const V14_VOICES: readonly V14VoiceSpec[] = [
  { id: 'original', label: 'Original', artwork: `${ASSET_ROOT}/voices/original.png` },
  { id: 'sweet-girl', label: 'Sweet Girl', artwork: `${ASSET_ROOT}/voices/sweet-girl.png` },
  { id: 'deep', label: 'Deep Male', artwork: `${ASSET_ROOT}/voices/deep-male.png` },
  { id: 'baby', label: 'Baby', artwork: `${ASSET_ROOT}/voices/baby.png` },
  { id: 'lolita', label: 'Lolita', artwork: `${ASSET_ROOT}/voices/lolita.png` },
  { id: 'young-boy', label: 'Young Boy', artwork: `${ASSET_ROOT}/voices/young-boy.png` },
  { id: 'elder', label: 'Elder', artwork: `${ASSET_ROOT}/voices/elder.png` },
  { id: 'helium', label: 'Helium', artwork: `${ASSET_ROOT}/voices/helium.png` },
  { id: 'chipmunk', label: 'Chipmunk', artwork: `${ASSET_ROOT}/voices/chipmunk.png` },
  { id: 'monster', label: 'Monster', artwork: `${ASSET_ROOT}/voices/monster.png` },
  { id: 'robot', label: 'Robot', artwork: `${ASSET_ROOT}/voices/robot.png` },
  { id: 'alien', label: 'Alien', artwork: `${ASSET_ROOT}/voices/alien.png` },
  { id: 'devil', label: 'Devil', artwork: `${ASSET_ROOT}/voices/devil.png` },
  { id: 'ghost', label: 'Ghost', artwork: `${ASSET_ROOT}/voices/ghost.png` },
  { id: 'cave', label: 'Cave', artwork: `${ASSET_ROOT}/voices/cave.png` },
  { id: 'radio', label: 'Radio', artwork: `${ASSET_ROOT}/voices/radio.png` },
  { id: 'telephone', label: 'Telephone', artwork: `${ASSET_ROOT}/voices/telephone.png` },
  { id: 'megaphone', label: 'Megaphone', artwork: `${ASSET_ROOT}/voices/megaphone.png` },
];

const voiceIds = (...ids: VoiceChangerEffectId[]) => ids;
export const V14_VOICE_TABS: Record<string, VoiceChangerEffectId[]> = {
  All: V14_VOICES.map((row) => row.id),
  Popular: voiceIds('original', 'sweet-girl', 'deep', 'baby', 'robot', 'helium'),
  Character: voiceIds('sweet-girl', 'baby', 'lolita', 'young-boy', 'elder'),
  Funny: voiceIds('helium', 'chipmunk', 'monster', 'devil', 'ghost'),
  Robot: voiceIds('robot', 'radio', 'telephone', 'megaphone'),
  Fantasy: voiceIds('monster', 'alien', 'devil', 'ghost', 'cave'),
  Special: voiceIds('radio', 'telephone', 'megaphone'),
};

export const V14_BEAUTY: ReadonlyArray<readonly [string, string]> = [
  ['Natural', `${ASSET_ROOT}/beauty/natural.png`],
  ['Clear', `${ASSET_ROOT}/beauty/clear.png`],
  ['Cute', `${ASSET_ROOT}/beauty/cute.png`],
  ['Glamour', `${ASSET_ROOT}/beauty/glamour.png`],
  ['Korean', `${ASSET_ROOT}/beauty/korean.png`],
];

export const V14_BEAUTY_PRESET_IDS: Record<string, BeautyPresetId> = {
  None: 'none',
  Natural: 'beauty-natural',
  Clear: 'beauty-clear',
  Cute: 'beauty-soft',
  Glamour: 'beauty-glow',
  Korean: 'beauty-smooth',
};

export type V14GameSpec = {
  gameId: string;
  displayName: string;
  artwork: string;
  players: number;
  badge?: 'HOT' | 'NEW' | 'PK';
  enabled: true;
  launch: 'live-room';
};

export const V14_GAMES: readonly V14GameSpec[] = [
  { gameId: 'v14_lucky_wheel', displayName: 'Lucky Wheel', artwork: `${ASSET_ROOT}/games/lucky-wheel.png`, players: 12560, badge: 'HOT', enabled: true, launch: 'live-room' },
  { gameId: 'v14_treasure_box', displayName: 'Treasure Box', artwork: `${ASSET_ROOT}/games/treasure-box.png`, players: 8743, badge: 'HOT', enabled: true, launch: 'live-room' },
  { gameId: 'v14_fruit_slash', displayName: 'Fruit Slash', artwork: `${ASSET_ROOT}/games/fruit-slash.png`, players: 9245, badge: 'NEW', enabled: true, launch: 'live-room' },
  { gameId: 'v14_bubble_shooter', displayName: 'Bubble Shooter', artwork: `${ASSET_ROOT}/games/bubble-shooter.png`, players: 7845, badge: 'HOT', enabled: true, launch: 'live-room' },
  { gameId: 'v14_dice_king', displayName: 'Dice King', artwork: `${ASSET_ROOT}/games/dice-king.png`, players: 8231, enabled: true, launch: 'live-room' },
  { gameId: 'v14_card_battle', displayName: 'Card Battle', artwork: `${ASSET_ROOT}/games/card-battle.png`, players: 6895, badge: 'PK', enabled: true, launch: 'live-room' },
  { gameId: 'v14_whack_a_mole', displayName: 'Whack a Mole', artwork: `${ASSET_ROOT}/games/whack-a-mole.png`, players: 7312, badge: 'NEW', enabled: true, launch: 'live-room' },
  { gameId: 'v14_fishing_master', displayName: 'Fishing Master', artwork: `${ASSET_ROOT}/games/fishing-master.png`, players: 7689, enabled: true, launch: 'live-room' },
];

const gameIds = (...ids: string[]) => ids;
export const V14_GAME_TABS: Record<string, string[]> = {
  'All Games': V14_GAMES.map((row) => row.gameId),
  Popular: gameIds('v14_lucky_wheel', 'v14_treasure_box', 'v14_bubble_shooter', 'v14_fishing_master'),
  Casual: gameIds('v14_fruit_slash', 'v14_bubble_shooter', 'v14_whack_a_mole', 'v14_fishing_master'),
  'PK Games': gameIds('v14_card_battle'),
  Puzzle: gameIds('v14_fruit_slash', 'v14_bubble_shooter'),
  Card: gameIds('v14_card_battle'),
  Arcade: gameIds('v14_lucky_wheel', 'v14_treasure_box', 'v14_dice_king', 'v14_fishing_master'),
};
