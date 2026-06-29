import type { CloudSyncCollectionKey } from './collectionKeys';

export const CLOUD_APP_STATE_VERSION = 1;

export type CloudAppStatePayload = {
  v: typeof CLOUD_APP_STATE_VERSION;
  /** Client ms timestamp — used for last-write-wins merge */
  updatedAt: number;
  collections: Partial<Record<CloudSyncCollectionKey, unknown>>;
};

export type CloudAppStateRow = {
  user_id: string;
  payload: CloudAppStatePayload;
  updated_at?: string;
};
