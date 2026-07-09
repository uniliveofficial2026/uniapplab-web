import type { GiftEffectDefinition } from './giftEffectCatalogTypes';

export const GIFT_EFFECT_CATALOG_BASE: GiftEffectDefinition[] = [
  { id: 'rose', name: 'Rose', icon: '🌹', stars: 5, tier: 'combo', particleColor: '#fb7185' },
  { id: 'heart', name: 'Heart', icon: '💖', stars: 10, tier: 'combo', particleColor: '#f472b6' },
  {
    id: 'mic',
    name: 'Mic',
    icon: '🎤',
    stars: 25,
    tier: 'standard',
    effectSvgaUrl: '/live-gifts/mic.svga',
    particleColor: '#a78bfa',
  },
  {
    id: 'star',
    name: 'Star',
    icon: '⭐',
    stars: 50,
    tier: 'standard',
    effectSvgaUrl: '/live-gifts/star.svga',
    particleColor: '#fbbf24',
  },
  {
    id: 'crown',
    name: 'Crown',
    icon: '👑',
    stars: 100,
    tier: 'fullscreen',
    effectSvgaUrl: '/live-gifts/crown.svga',
    particleColor: '#fcd34d',
  },
  {
    id: 'rocket',
    name: 'Rocket',
    icon: '🚀',
    stars: 250,
    tier: 'fullscreen',
    effectSvgaUrl: '/live-gifts/rocket.svga',
    particleColor: '#60a5fa',
  },
];
