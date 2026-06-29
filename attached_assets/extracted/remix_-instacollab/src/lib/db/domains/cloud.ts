import type { CloudConnection } from '../../dbTypes';
import type { CloudDataType } from '../types';
import type { CloudSyncResult } from '../../../types';
import type { CloudLayer } from '../layers';
import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';

export function WithCloud<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, CloudLayer> {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    get cloudMeta() {
      const defaults = {
        syncedCollections: 0,
        syncedItems: 0,
        syncedSize: 0,
        status: 'idle' as 'idle' | 'syncing' | 'success'
      };
      return this.load('cloud_meta', defaults) || defaults;
    }

    private countItems(value: unknown): number {
      if (Array.isArray(value)) return value.length;
      if (value && typeof value === 'object') return Object.keys(value).length;
      if (value === null || value === undefined) return 0;
      return 1;
    }

    private getCloudDataTypes(connection: CloudConnection): CloudDataType[] {
      const allTypes: CloudDataType[] = ['photos', 'videos', 'files', 'messages', 'stories', 'posts'];
      if (!Array.isArray(connection?.dataTypes)) {
        return allTypes;
      }
      return connection.dataTypes.filter((type: string): type is CloudDataType =>
        allTypes.includes(type as CloudDataType)
      );
    }

    private isKeyAllowedForConnection(key: string, connection: CloudConnection): boolean {
      const keyMap: Record<CloudDataType, RegExp[]> = {
        photos: [/^posts$/, /^stories$/, /^reels$/],
        videos: [/^reels$/, /^stories$/],
        files: [/^workspace_files$/],
        messages: [/^messages$/, /^chat_wallpapers$/, /^chat_presence$/, /^chat_read_state$/, /^chat_peer_read_state$/],
        stories: [/^stories$/],
        posts: [/^posts$/, /^post_comments$/, /^reel_comments$/]
      };
      const dataTypes = this.getCloudDataTypes(connection);
      return dataTypes.some((type) => keyMap[type].some((pattern) => pattern.test(key)));
    }

    private getCloudConnections(settings = this.asLocalDB().settings) {
      if (Array.isArray(settings?.cloudConnections)) {
        return settings.cloudConnections;
      }
      if (settings?.cloudConnection?.connected) {
        const legacy = settings.cloudConnection;
        return [{
          ...legacy,
          id: legacy.id ?? `legacy_${legacy.provider}_${legacy.accountLabel || 'account'}_${legacy.bucket || 'bucket'}`,
          storageName: legacy.storageName || legacy.accountLabel || `${legacy.provider} storage`,
          dataTypes: legacy.dataTypes || ['photos', 'videos', 'files', 'messages', 'stories', 'posts'],
        }];
      }
      return [];
    }

    private getActiveCloudConnection(settings = this.asLocalDB().settings) {
      const connections = this.getCloudConnections(settings);
      if (!connections.length) return null;

      const activeId = settings?.cloudActiveConnectionId;
      if (activeId) {
        const active = connections.find((c) => c.id === activeId);
        if (active?.connected) return active;
      }

      const selectedProvider = settings?.cloudProvider;
      if (selectedProvider && selectedProvider !== 'None') {
        const byProvider = connections.find((c) => c.connected && c.provider === selectedProvider);
        if (byProvider) return byProvider;
      }

      return connections.find((c) => c.connected) || null;
    }

    syncToCloud(isAuto = false): CloudSyncResult {
      if (this.cloudSyncInProgress) {
        return { ok: false, reason: 'Cloud sync already in progress.' };
      }

      const settings = this.asLocalDB().settings;
      if (!settings.cloudSyncEnabled) {
        return { ok: false, reason: 'Cloud sync is disabled.' };
      }
      const connections = this.getCloudConnections(settings).filter((connection) => connection.connected);
      if (connections.length === 0) {
        return { ok: false, reason: 'Connect your cloud provider first.' };
      }

      this.cloudSyncInProgress = true;
      try {
        if (isAuto) {
          this.save('cloud_meta', {
            ...this.asLocalDB().cloudMeta,
            status: 'syncing'
          });
        }

        const cacheKeys = Object.keys(this.cache);
        let syncedCollections = 0;
        let syncedItems = 0;
        let syncedSize = 0;

        connections.forEach((connection) => {
          const routedKeys = cacheKeys.filter((key) => this.isKeyAllowedForConnection(key, connection));
          syncedCollections += routedKeys.length;
          routedKeys.forEach((key) => {
            const value = this.cache[key];
            syncedItems += this.countItems(value);
            try {
              const payload = JSON.stringify(value);
              syncedSize += (payload.length + key.length) * 2;
            } catch {
              // Ignore non-serializable entries in size estimate.
            }
          });
        });

        this.save('cloud_meta', {
          syncedCollections,
          syncedItems,
          syncedSize,
          status: 'success'
        });

        this.asLocalDB().updateSettings({
          cloudProvider: connections[0].provider,
          cloudActiveConnectionId: this.getActiveCloudConnection(settings)?.id || connections[0].id,
          cloudLastSyncAt: new Date().toISOString()
        });

        return {
          ok: true,
          syncedCollections,
          syncedItems,
          syncedSize
        };
      } finally {
        this.cloudSyncInProgress = false;
      }
    }

    connectCloudProvider(payload: {
      provider: string;
      storageName?: string;
      accountLabel: string;
      bucket: string;
      region?: string;
      endpoint?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      dataTypes?: CloudDataType[];
    }) {
      if (!payload.provider || payload.provider === 'None') {
        return { ok: false, reason: 'Select a cloud provider first.' };
      }
      if (!payload.accountLabel.trim() || !payload.bucket.trim()) {
        return { ok: false, reason: 'Account label and bucket/container are required.' };
      }

      const key = (payload.accessKeyId || '').trim();
      const credentialHint = key.length >= 6 ? `${key.slice(0, 4)}...${key.slice(-2)}` : (key ? `${key[0]}...` : 'configured');
      const connectionId = `cloud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const cloudConnection = {
        id: connectionId,
        provider: payload.provider,
        connected: true,
        storageName: (payload.storageName || payload.accountLabel || `${payload.provider} storage`).trim(),
        accountLabel: payload.accountLabel.trim(),
        bucket: payload.bucket.trim(),
        region: (payload.region || '').trim(),
        endpoint: (payload.endpoint || '').trim(),
        credentialHint,
        lastValidatedAt: new Date().toISOString(),
        dataTypes: Array.isArray(payload.dataTypes)
          ? payload.dataTypes
          : ['photos', 'videos', 'files', 'messages', 'stories', 'posts']
      };
      const existingConnections = this.getCloudConnections();
      const cloudConnections = [cloudConnection, ...existingConnections];

      this.asLocalDB().updateSettings({
        cloudProvider: payload.provider,
        cloudSyncEnabled: true,
        cloudActiveConnectionId: connectionId,
        cloudConnections,
        cloudConnection: cloudConnection
      });

      return { ok: true, cloudConnection };
    }

    updateCloudConnection(connectionId: string, patch: {
      storageName?: string;
      dataTypes?: CloudDataType[];
    }) {
      const settings = this.asLocalDB().settings;
      const existingConnections = this.getCloudConnections(settings);
      const cloudConnections = existingConnections.map((connection: CloudConnection) => {
        if (connection.id !== connectionId) return connection;
        return {
          ...connection,
          storageName: patch.storageName !== undefined ? patch.storageName.trim() : connection.storageName,
          dataTypes: patch.dataTypes !== undefined ? patch.dataTypes : connection.dataTypes
        };
      });
      const nextActive = cloudConnections.find((connection) => connection.id === settings.cloudActiveConnectionId) || cloudConnections[0] || null;
      this.asLocalDB().updateSettings({
        cloudProvider: nextActive?.provider || 'None',
        cloudActiveConnectionId: nextActive?.id || null,
        cloudConnections,
        cloudConnection: nextActive || null
      });
      return { ok: true };
    }

    disconnectCloudProvider(connectionId?: string) {
      const settings = this.asLocalDB().settings;
      const existingConnections = this.getCloudConnections(settings);
      const cloudConnections = connectionId
        ? existingConnections.filter((c) => c.id !== connectionId)
        : [];
      const nextActive = cloudConnections[0] || null;
      this.asLocalDB().updateSettings({
        cloudProvider: nextActive?.provider || 'None',
        cloudSyncEnabled: cloudConnections.length > 0 ? settings.cloudSyncEnabled : false,
        cloudAutoSync: cloudConnections.length > 0 ? settings.cloudAutoSync : false,
        cloudActiveConnectionId: nextActive?.id || null,
        cloudConnections,
        cloudConnection: nextActive || null
      });
      return { ok: true };
    }
  } as unknown as MixinCtor<T, CloudLayer>;
}
