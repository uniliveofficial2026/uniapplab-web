import type { UiFlagsLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

export function WithUiFlags<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, UiFlagsLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    /** One-time: prior builds defaulted to muted on load. */
    private migrateGlobalMuteDefault() {
      if (this.load('globalMutedDefaultV2', false)) return;
      this.save('globalMutedDefaultV2', true);
      this.save('globalMuted', false);
    }

    /** Default unmuted; user can toggle mute per session (persisted). */
    get globalMuted() { return this.load('globalMuted', false); }
    setGlobalMuted(muted: boolean) { this.save('globalMuted', muted); }

    get isFullScreenActive() { return this.load('isFullScreenActive', false); }
    setFullScreenActive(active: boolean) { this.save('isFullScreenActive', active); }

    /** True while Shell create / edit modal is open — pauses feed, reels, and modals. */
    get isCreatorEditingActive() { return this.load('isCreatorEditingActive', false); }
    setCreatorEditingActive(active: boolean) { this.save('isCreatorEditingActive', active); }

    get unreadMessagesCount() { return this.load('unreadMessagesCount', 3); }
    setUnreadMessagesCount(count: number) { this.save('unreadMessagesCount', count); }

    get hasUnreadNotifications() { return this.load('hasUnreadNotifications', true); }
    setHasUnreadNotifications(has: boolean) { this.save('hasUnreadNotifications', has); }

  } as unknown as MixinCtor<T, UiFlagsLayer>;
}
