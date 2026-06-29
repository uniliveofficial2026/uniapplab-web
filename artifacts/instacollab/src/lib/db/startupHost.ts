import type { AppSettings, CloudConnection } from '../dbTypes';
import type { CloudSyncResult, User } from '../../types';

/** Methods/properties `DbCore` invokes before the full mixin stack is typed on `this`. */
export interface DbCoreStartupHost {
  migrateGlobalMuteDefault(): void;
  trimHighChurnCollections(): void;
  seedDemoStoriesIfNeeded(): Promise<void>;
  ensureFollowGraph(): void;
  ensureDemoProfileVisitors(): void;
  backfillProfileVisitorSurfaces(): void;
  purgeHiddenProfileVisitEntries(): void;
  enforcePremiumExpiryForCurrentUser(): void;
  migrateLegacyNotificationsInbox(): void;
  compactNotificationInboxForCurrentUser(): void;
  ensureDemoNotifications(): void;
  refreshStorageDeviceEstimate(): Promise<void>;
  notifyListeners(): void;
  settings: AppSettings;
  currentUserId: string;
  users: User[];
  updateUser(id: string, updateFn: (user: User) => User): void;
  getActiveCloudConnection(settings?: AppSettings): CloudConnection | null;
  syncToCloud(isAuto?: boolean): CloudSyncResult;
  cloudSyncInProgress: boolean;
  isInitialized: boolean;
  autoSyncTimer: number | null;
  hasUnlimitedPlan(): boolean;
}
