import { useEffect, useMemo, useState } from 'react';
import { getActivePartyGiftCatalog } from '../utils/roomGifts';
import { PARTY_GIFT_CATALOG_UPDATED_EVENT } from '../../lib/cloudSocial/platformGiftCatalogCloud';
import { useDbRevision } from '../../lib/useDB';
import type { PartyGiftDefinition } from '../utils/roomGifts';

/** Live party gift catalog — refreshes on studio edits, cloud sync, and platform realtime. */
export function usePartyGiftCatalog(): PartyGiftDefinition[] {
  useDbRevision();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onUpdate = () => setTick((value) => value + 1);
    window.addEventListener(PARTY_GIFT_CATALOG_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PARTY_GIFT_CATALOG_UPDATED_EVENT, onUpdate);
  }, []);

  return useMemo(() => getActivePartyGiftCatalog(), [tick]);
}
