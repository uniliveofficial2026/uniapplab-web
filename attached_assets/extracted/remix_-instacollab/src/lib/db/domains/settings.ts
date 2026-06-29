import type { AppSettings } from '../../dbTypes';
import type { CloudDataType } from '../types';
import type { SettingsLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

export function WithSettings<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, SettingsLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    get settings(): AppSettings {
      const defaults: AppSettings = {
        notificationsEnabled: true,
        theme: 'dark',
        isPrivate: false,
        /** When false, others' visits are not saved and the visitors list is hidden. */
        profileVisitorsEnabled: true,
        /** Premium only: do not record visits when browsing (leave no trace). */
        hiddenProfileViews: false,
        hideProfileViews: false,
        language: 'English',
        offlineSync: false,
        cloudSyncEnabled: false,
        cloudProvider: 'None',
        cloudAutoSync: false,
        cloudLastSyncAt: null as string | null,
        cloudActiveConnectionId: null as string | null,
        cloudConnections: [] as Array<{
          id: string;
          provider: string;
          connected: boolean;
          storageName: string;
          accountLabel: string;
          bucket: string;
          region: string;
          endpoint: string;
          credentialHint: string;
          lastValidatedAt: string;
          dataTypes: CloudDataType[];
        }>,
        cloudConnection: null as null | {
          id?: string;
          provider: string;
          connected: boolean;
          storageName?: string;
          accountLabel: string;
          bucket: string;
          region: string;
          endpoint: string;
          credentialHint: string;
          lastValidatedAt: string;
          dataTypes?: CloudDataType[];
        }
      };
      return this.load('app_settings', defaults) || defaults;
    }

    updateSettings(update: Partial<AppSettings>) {
      const next = { ...this.settings, ...update };
      if ('isPrivate' in update) {
        const meId = this.asLocalDB().currentUserId;
        if (meId) {
          this.asLocalDB().updateUser(meId, (u) => ({
            ...u,
            isPrivate: !!update.isPrivate,
          }));
        }
      }
      if ('hiddenProfileViews' in update && update.hiddenProfileViews === true) {
        if (!this.asLocalDB().hasProfilePremium()) {
          next.hiddenProfileViews = false;
        }
      }
      delete next.hideProfileViews;
      this.save('app_settings', next);
      if (
        'hiddenProfileViews' in update &&
        update.hiddenProfileViews === true &&
        next.hiddenProfileViews === true
      ) {
        this.asLocalDB().scrubViewerTracesFromAllProfiles(this.asLocalDB().currentUserId);
      }
      if (
        'profileVisitorsEnabled' in update &&
        typeof update.profileVisitorsEnabled === 'boolean'
      ) {
        const meId = this.asLocalDB().currentUserId;
        this.asLocalDB().updateUser(meId, (u) => ({
          ...u,
          profileVisitorsEnabled: update.profileVisitorsEnabled,
        }));
      }
    }
  } as unknown as MixinCtor<T, SettingsLayer>;
}
