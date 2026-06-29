import {
  openAppProfileSurface,
  openKaraokeProfileSurface,
  openUserProfileSurface,
  type KaraokeProfileTab,
} from '../../lib/profileSurface';
import { capturePartyRoomProfileReturnContext } from '../../lib/karaokeReturnContext';

export type { KaraokeProfileTab };

export function openKaraokeProfileFromPartyRoom(options: {
  userId: string | null;
  displayName?: string;
  username?: string;
  profileTab?: KaraokeProfileTab;
  isSelf?: boolean;
}): void {
  openKaraokeProfileSurface({
    userId: options.userId,
    displayName: options.displayName,
    username: options.username,
    isSelf: options.isSelf,
    profileTab: options.profileTab ?? null,
    closeRoomFlow: true,
    returnContext: capturePartyRoomProfileReturnContext(),
  });
}

export function openAppProfileFromPartyRoom(
  userId: string | null,
  isSelf?: boolean,
  displayName?: string,
  username?: string,
): void {
  openAppProfileSurface({ userId, displayName, username, isSelf });
}

export function openProfileFromPartyRoom(options: {
  userId: string | null;
  profileTab?: KaraokeProfileTab;
  isSelf?: boolean;
}): void {
  openUserProfileSurface({
    userId: options.userId,
    isSelf: options.isSelf,
    profileTab: options.profileTab ?? null,
    closeRoomFlow: true,
    returnContext: capturePartyRoomProfileReturnContext(),
  });
}
