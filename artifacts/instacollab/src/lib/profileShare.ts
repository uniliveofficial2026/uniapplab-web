import type { User } from '../types';
import type { KaraokeProfileTab } from './karaokeSearch';
import { isKaraokeProfileSurface } from './profileSurface';
import { buildProfileSharePayloadFromUser, type SharePayload } from './shareLinks';

export type ProfileSharePayload = SharePayload;

export function buildContextualProfileSharePayload(options: {
  user: Pick<User, 'id' | 'username' | 'displayName'> & { handle?: string };
  isSelf: boolean;
  profileTab?: KaraokeProfileTab | null;
  surface?: 'app' | 'karaoke';
}): SharePayload {
  const surface =
    options.surface ?? (isKaraokeProfileSurface() ? 'karaoke' : 'app');
  return buildProfileSharePayloadFromUser(options.user, {
    isSelf: options.isSelf,
    surface,
    profileTab: options.profileTab,
  });
}
