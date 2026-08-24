import { fetchLiveKitToken, fetchPartyLiveKitToken } from '../platformApi';
import type { PkMediaSurface } from './pkLiveMediaRef';

export {
  parsePkLiveMediaRef,
  resolvePkMediaId,
  resolvePkMediaSurface,
  type PkLiveMediaRef,
  type PkMediaSurface,
} from './pkLiveMediaRef';

export async function fetchPkLiveKitAuth(
  mediaId: string,
  surface: PkMediaSurface,
  role: 'host' | 'viewer',
): Promise<{ token: string; url: string; roomName: string }> {
  const id = mediaId.trim();
  if (!id) throw new Error('pk_media_id_required');
  if (surface === 'party') {
    const auth = await fetchPartyLiveKitToken(id, role === 'host');
    return { token: auth.token, url: auth.url, roomName: auth.roomName };
  }
  const auth = await fetchLiveKitToken(id, role);
  return { token: auth.token, url: auth.url, roomName: auth.roomName };
}
