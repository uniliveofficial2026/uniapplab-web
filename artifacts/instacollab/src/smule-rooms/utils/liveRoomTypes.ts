import type { PartyGiftDefinition } from './roomGifts';

export type GiftPlayPayload = {
  action: 'play';
  playId?: string;
  giftId?: string;
  giftName: string;
  giftIcon: string;
  starValue: number;
  senderName: string;
  senderId?: string;
  receiverName: string;
  receiverUserId?: string;
  effectVideoUrl?: string;
  effectSvgaUrl?: string;
};

export type PKPhase = 'idle' | 'inviting' | 'active' | 'ended';

export type PKMode = 'single' | 'team';

export type PKFighter = {
  userId: string;
  name: string;
  score: number;
  avatarUrl?: string;
};

export type PKBattleState = {
  phase: PKPhase;
  mode: PKMode;
  teamA: PKFighter[];
  teamB: PKFighter[];
  teamAScore: number;
  teamBScore: number;
  durationSec: number;
  startedAt: number | null;
  endsAt: number | null;
  winnerSide: 'a' | 'b' | null;
};

export const DEFAULT_PK_STATE: PKBattleState = {
  phase: 'idle',
  mode: 'single',
  teamA: [],
  teamB: [],
  teamAScore: 0,
  teamBScore: 0,
  durationSec: 180,
  startedAt: null,
  endsAt: null,
  winnerSide: null,
};

export type PKPayload =
  | {
      action: 'invite';
      opponentUserId: string;
      opponentName: string;
      mode?: PKMode;
      teamA?: PKFighter[];
      teamB?: PKFighter[];
      durationSec?: number;
      crossRoom?: boolean;
      hostRoomId?: string;
      hostRoomMode?: string;
      opponentRoomId?: string;
      opponentRoomMode?: string;
    }
  | { action: 'accept' }
  | { action: 'decline' }
  | { action: 'score'; userId: string; delta: number }
  | { action: 'end'; winnerSide?: 'a' | 'b' }
  | { action: 'sync'; state: PKBattleState };

export type CommercePriceType = 'coins' | 'cash';

export type CommerceProduct = {
  id: string;
  title: string;
  priceType: CommercePriceType;
  priceCoins?: number;
  /** USD price when priceType is cash (e.g. 29.99). */
  priceUsd?: number;
  imageUrl?: string;
  description?: string;
};

export const DEFAULT_COMMERCE_CATALOG: CommerceProduct[] = [
  { id: 'c1', title: 'Glow Serum', priceType: 'coins', priceCoins: 120, description: 'Hydrating daily serum' },
  { id: 'c2', title: 'Live Bundle', priceType: 'coins', priceCoins: 299, description: 'Creator starter kit' },
  { id: 'c3', title: 'VIP Pass', priceType: 'coins', priceCoins: 49, description: 'Room perks for 7 days' },
  { id: 'c4', title: 'Merch Tee', priceType: 'coins', priceCoins: 450, description: 'Limited live drop' },
];

export type CommerceShippingInfo = {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type CommercePaymentMethod = 'coins' | 'cash_balance' | 'card';

export type CommerceOrder = {
  id: string;
  productId: string;
  productTitle: string;
  productImageUrl?: string;
  productDescription?: string;
  priceType: CommercePriceType;
  priceCoins?: number;
  priceUsd?: number;
  buyerUserId: string;
  buyerName: string;
  paid: boolean;
  paymentMethod: CommercePaymentMethod;
  shipping: CommerceShippingInfo;
  createdAt: number;
};

export function normalizeCommerceProduct(product: CommerceProduct): CommerceProduct {
  if (product.priceType === 'cash') {
    return {
      ...product,
      priceUsd: product.priceUsd ?? 0,
    };
  }
  if (product.priceType === 'coins') {
    return {
      ...product,
      priceCoins: product.priceCoins ?? 0,
    };
  }
  const legacyCoins = (product as CommerceProduct & { priceCoins?: number }).priceCoins ?? 0;
  return {
    ...product,
    priceType: 'coins',
    priceCoins: legacyCoins,
  };
}

export function formatCommercePrice(product: CommerceProduct): string {
  const normalized = normalizeCommerceProduct(product);
  if (normalized.priceType === 'cash') {
    return `$${(normalized.priceUsd ?? 0).toFixed(2)}`;
  }
  return `${normalized.priceCoins ?? 0} coins`;
}

export function formatCommerceOrderPrice(
  order: Pick<CommerceOrder, 'priceType' | 'priceCoins' | 'priceUsd'>,
): string {
  if (order.priceType === 'cash') {
    return `$${(order.priceUsd ?? 0).toFixed(2)}`;
  }
  return `${order.priceCoins ?? 0} coins`;
}

export function createCommerceOrderId(): string {
  return `co-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export type CommerceCardPosition = {
  /** Horizontal center, percent of stage width (0–100). */
  x: number;
  /** Vertical center, percent of stage height (0–100). */
  y: number;
};

export const DEFAULT_COMMERCE_CARD_POSITION: CommerceCardPosition = { x: 50, y: 72 };

export function clampCommerceCardPosition(position: CommerceCardPosition): CommerceCardPosition {
  return {
    x: Math.min(88, Math.max(12, position.x)),
    y: Math.min(88, Math.max(12, position.y)),
  };
}

export type GameLiveEdgeBounds = {
  stageWidth: number;
  stageHeight: number;
  elementWidth: number;
  elementHeight: number;
};

/** Game Live host overlays — keep the full widget visible while flush to stage edges. */
export function clampGameLiveEdgePosition(
  position: CommerceCardPosition,
  bounds?: GameLiveEdgeBounds,
): CommerceCardPosition {
  if (
    !bounds ||
    bounds.stageWidth < 1 ||
    bounds.stageHeight < 1 ||
    bounds.elementWidth < 1 ||
    bounds.elementHeight < 1
  ) {
    return {
      x: Math.min(100, Math.max(0, position.x)),
      y: Math.min(100, Math.max(0, position.y)),
    };
  }

  const halfW = (bounds.elementWidth / 2 / bounds.stageWidth) * 100;
  const halfH = (bounds.elementHeight / 2 / bounds.stageHeight) * 100;
  return {
    x: Math.min(100 - halfW, Math.max(halfW, position.x)),
    y: Math.min(100 - halfH, Math.max(halfH, position.y)),
  };
}

export type CommercePayload =
  | { action: 'pin'; product: CommerceProduct }
  | { action: 'unpin' }
  | { action: 'add_product'; product: CommerceProduct }
  | { action: 'catalog'; products: CommerceProduct[] }
  | { action: 'card_position'; x: number; y: number }
  | { action: 'purchase'; order: CommerceOrder }
  | {
      action: 'sync';
      pinnedProductId: string | null;
      salesCount: number;
      catalog?: CommerceProduct[];
      cardPosition?: CommerceCardPosition;
      orders?: CommerceOrder[];
    };

export function createCommerceProductId(): string {
  return `cp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function mergeCommerceCatalog(
  base: CommerceProduct[],
  incoming: CommerceProduct[],
): CommerceProduct[] {
  const byId = new Map<string, CommerceProduct>();
  for (const product of base) byId.set(product.id, normalizeCommerceProduct(product));
  for (const product of incoming) byId.set(product.id, normalizeCommerceProduct(product));
  return Array.from(byId.values());
}

export function findCommerceProduct(
  catalog: CommerceProduct[],
  productId: string | null | undefined,
): CommerceProduct | null {
  if (!productId) return null;
  return catalog.find((product) => product.id === productId) ?? null;
}

export type GamePhase = 'idle' | 'lobby' | 'active' | 'results';

export type GameLiveState = {
  phase: GamePhase;
  gameId: string;
  title: string;
  prompt: string;
  options: string[];
  correctIndex: number | null;
  scores: Record<string, number>;
  round: number;
  endsAt: number | null;
};

export const DEFAULT_GAME_STATE: GameLiveState = {
  phase: 'idle',
  gameId: 'trivia',
  title: 'Live Trivia',
  prompt: '',
  options: [],
  correctIndex: null,
  scores: {},
  round: 0,
  endsAt: null,
};

export const GAME_ROUNDS: Array<{ prompt: string; options: string[]; correctIndex: number }> = [
  {
    prompt: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correctIndex: 1,
  },
  {
    prompt: 'How many players are on a soccer team on the field?',
    options: ['9', '10', '11', '12'],
    correctIndex: 2,
  },
  {
    prompt: 'What year did the first iPhone launch?',
    options: ['2005', '2006', '2007', '2008'],
    correctIndex: 2,
  },
];

export type GamePayload =
  | { action: 'start'; gameId?: string }
  | { action: 'answer'; optionIndex: number; playerName: string; playerUserId: string }
  | { action: 'next_round' }
  | { action: 'end' }
  | { action: 'sync'; state: GameLiveState };

export type GiftPayload = GiftPlayPayload & { action: 'send' };

export function giftFromDefinition(
  gift: PartyGiftDefinition,
  sender: { id: string; name: string },
  receiver: { name: string; userId?: string },
): GiftPlayPayload {
  return {
    action: 'play',
    playId: `gift_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    giftId: gift.id ?? gift.name,
    giftName: gift.name,
    giftIcon: gift.icon,
    starValue: gift.stars,
    senderName: sender.name,
    senderId: sender.id,
    receiverName: receiver.name,
    receiverUserId: receiver.userId,
    effectVideoUrl: gift.effectVideoUrl,
    effectSvgaUrl: gift.effectSvgaUrl,
  };
}
