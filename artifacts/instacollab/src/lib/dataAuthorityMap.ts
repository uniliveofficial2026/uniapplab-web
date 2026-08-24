/**
 * Canonical data authority map — CU / AS / EP classification per feature.
 * Server/cloud is final authority for shared or valuable data; IndexedDB is cache + outbox.
 */
export const DATA_AUTHORITY = {
  auth: {
    class: 'CU',
    authority: 'supabase-auth',
    cache: 'session',
    realtime: true,
  },
  profile: {
    class: 'CU',
    authority: 'postgres-profiles',
    cache: 'indexeddb',
    realtime: true,
  },
  publicUserId: {
    class: 'CU',
    authority: 'postgres-unique-index',
    cache: 'indexeddb',
    realtime: true,
  },
  vipSvip: {
    class: 'CU',
    authority: 'user_entitlements',
    cache: 'indexeddb',
    realtime: true,
  },
  badgesFrames: {
    class: 'CU',
    authority: 'user_entitlements-role',
    cache: 'indexeddb',
    realtime: true,
  },
  posts: {
    class: 'CU',
    authority: 'postgres',
    cache: 'indexeddb',
    realtime: true,
  },
  reels: {
    class: 'CU',
    authority: 'postgres',
    cache: 'indexeddb',
    realtime: true,
  },
  comments: {
    class: 'CU',
    authority: 'postgres',
    cache: 'indexeddb',
    realtime: true,
  },
  likes: {
    class: 'CU',
    authority: 'postgres-relation',
    cache: 'indexeddb-optimistic',
    realtime: true,
  },
  follows: {
    class: 'CU',
    authority: 'postgres-relation',
    cache: 'indexeddb',
    realtime: true,
  },
  blocks: {
    class: 'CU',
    authority: 'postgres',
    cache: 'indexeddb',
    realtime: true,
  },
  messages: {
    class: 'CU',
    authority: 'postgres-chat_messages',
    cache: 'indexeddb',
    outbox: true,
    realtime: true,
  },
  readReceipts: {
    class: 'CU',
    authority: 'postgres-chat_read_state',
    cache: 'indexeddb',
    realtime: true,
  },
  typing: {
    class: 'EP',
    authority: 'redis-upstash',
    cache: 'memory',
    realtime: true,
  },
  presence: {
    class: 'EP',
    authority: 'redis-upstash',
    cache: 'last-known',
    realtime: true,
  },
  notifications: {
    class: 'CU',
    authority: 'postgres',
    cache: 'indexeddb',
    realtime: true,
  },
  wallet: {
    class: 'CU',
    authority: 'server-ledger',
    cache: 'indexeddb-read-only',
    realtime: true,
  },
  gifts: {
    class: 'CU',
    authority: 'server-settlement',
    cache: 'indexeddb',
    realtime: true,
  },
  liveDiscovery: {
    class: 'CU',
    authority: 'live_sessions-streams',
    cache: 'indexeddb',
    realtime: true,
  },
  liveSeats: {
    class: 'CU',
    authority: 'server-room-state',
    cache: 'room-projection',
    realtime: true,
  },
  pk: {
    class: 'CU',
    authority: 'server-pk-state',
    cache: 'room-projection',
    realtime: true,
  },
  viewerCount: {
    class: 'EP',
    authority: 'redis-ephemeral-membership',
    cache: 'memory',
    realtime: true,
  },
  audioVideo: {
    class: 'EP',
    authority: 'livekit',
    cache: 'none',
    realtime: true,
  },
  media: {
    class: 'CU',
    authority: 'cloudflare-r2',
    cache: 'device-cdn',
    realtime: false,
  },
  settings: {
    class: 'AS',
    authority: 'user_app_state',
    cache: 'indexeddb',
    realtime: true,
  },
  drafts: {
    class: 'AS',
    authority: 'user_app_state-composer',
    cache: 'indexeddb-local-first',
    realtime: false,
  },
} as const;

export type DataClass = 'CU' | 'AS' | 'EP';

export type DataAuthorityEntry = {
  class: DataClass;
  authority: string;
  cache: string;
  outbox?: boolean;
  realtime?: boolean;
};

export type DataAuthorityFeature = keyof typeof DATA_AUTHORITY;
