export const PARTY_ROOM_PROFILE_PREVIEW_PORTAL_ID = 'party-room-profile-preview-portal';

export function getPartyRoomProfilePreviewPortal(): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('Party room profile preview portal is only available in the browser.');
  }

  let portal = document.getElementById(PARTY_ROOM_PROFILE_PREVIEW_PORTAL_ID);
  if (!portal) {
    portal = document.createElement('div');
    portal.id = PARTY_ROOM_PROFILE_PREVIEW_PORTAL_ID;
    portal.setAttribute('data-portal', 'party-room-profile-preview');
    portal.className = 'fixed inset-0 z-[9998] pointer-events-none';
    document.body.appendChild(portal);
  }
  return portal;
}
