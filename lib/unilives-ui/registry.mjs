/**
 * UniLive UI Kit foundation — maps feature domains to kit slots.
 * Does NOT redesign the reference app.
 */

/** @typedef {'Auth'|'Profile'|'Posts'|'Reels'|'Messaging'|'Calls'|'Live'|'AudioRoom'|'MultiGuest'|'PK'|'Gifts'|'Beauty'|'Games'|'Marketplace'|'Checkout'|'Orders'|'Seller'} UniLiveUiSurface */

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
