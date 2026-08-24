import { COMPONENT_PALETTE_STUBS, getComponentStub, listComponentPalette } from './componentTypes.mjs';

export { COMPONENT_PALETTE_STUBS, getComponentStub, listComponentPalette };

/**
 * UniLive UI Kit foundation — contracts for reusable production surfaces.
 * Does NOT redesign the reference app. Maps existing feature domains to kit slots.
 */

/** @typedef {'Auth'|'Profile'|'Posts'|'Reels'|'Messaging'|'Calls'|'Live'|'AudioRoom'|'MultiGuest'|'PK'|'Gifts'|'Beauty'|'Games'|'Marketplace'|'Checkout'|'Orders'|'Seller'} UniLiveUiSurface */

/**
 * @returns {{ surfaces: Array<{ id: UniLiveUiSurface, status: 'reference_bound'|'foundation', referencePath?: string }> }}
 */
export function createUiKitRegistry() {
  /** @type {Array<{ id: UniLiveUiSurface, status: 'reference_bound'|'foundation', referencePath?: string }>} */
  const surfaces = [
    { id: 'Auth', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/components/auth' },
    { id: 'Profile', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/components/profile' },
    { id: 'Posts', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/components' },
    { id: 'Reels', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/components' },
    { id: 'Messaging', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/components' },
    { id: 'Calls', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/lib/unilive-rtc/callDomain.ts' },
    { id: 'Live', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/smule-rooms' },
    { id: 'AudioRoom', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/smule-rooms' },
    { id: 'MultiGuest', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/smule-rooms' },
    { id: 'PK', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/components/live' },
    { id: 'Gifts', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/smule-rooms/components/GiftPlayOverlay.tsx' },
    { id: 'Beauty', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/lib/ar' },
    { id: 'Games', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/smule-rooms' },
    { id: 'Marketplace', status: 'reference_bound', referencePath: 'artifacts/instacollab/src/components' },
    { id: 'Checkout', status: 'foundation' },
    { id: 'Orders', status: 'foundation' },
    { id: 'Seller', status: 'foundation' },
  ];
  return {
    surfaces,
    list() {
      return surfaces.slice();
    },
    get(id) {
      return surfaces.find((s) => s.id === id) || null;
    },
  };
}
