/**
 * Eagerly warm every major screen chunk so tab switches have 0 load delay.
 */
import { preloadInstant } from './instantTask';

let warmed = false;

export function preloadAllAppSurfaces(): void {
  if (warmed || typeof window === 'undefined') return;
  warmed = true;

  const factories: Array<() => Promise<unknown>> = [
    () => import('../components/feed/Feed'),
    () => import('../components/feed/StoryRing'),
    () => import('../components/reels/ReelsScreen'),
    () => import('../components/messages/MessagesScreen'),
    () => import('../components/notifications/NotificationsScreen'),
    () => import('../components/search/SearchScreen'),
    () => import('../components/profile/ProfileScreen'),
    () => import('../components/profile/UserProfilePreview'),
    () => import('../components/live/LiveScreen'),
    () => import('../components/karaoke/KaraokeScreen'),
    () => import('../smule-rooms/RoomsHost'),
    () => import('../components/wallet/WalletScreen'),
    () => import('../components/workspace/WorkspaceGate'),
    () => import('../components/dating/DatingScreen'),
    () => import('../components/games/LocalGamesScreen'),
    () => import('../components/games/ThirdPartyGamesScreen'),
    () => import('../pages/YouTube'),
    () => import('../lib/cloudSocial/cloudSocialContent'),
    () => import('../lib/chat/cloudChatSync'),
    () => import('../lib/cloudNotificationSync'),
  ];

  for (const factory of factories) {
    preloadInstant(factory);
  }
}
