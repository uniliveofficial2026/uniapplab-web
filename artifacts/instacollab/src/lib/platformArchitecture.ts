/**
 * Authoritative platform architecture — keep product data on these lanes only.
 * MongoDB Atlas / Amazon Aurora may exist in Vercel Marketplace but are NOT app data stores.
 *
 * | Service        | Provider                                                              |
 * | -------------- | --------------------------------------------------------------------- |
 * | Authentication | Supabase                                                              |
 * | Database       | Supabase Postgres                                                     |
 * | Realtime       | Supabase Realtime                                                     |
 * | Images         | Cloudflare R2                                                         |
 * | Videos         | Cloudflare R2                                                         |
 * | Livestream     | LiveKit or Tencent TRTC                                               |
 * | AI Beauty      | Third-party AI SDK                                                    |
 * | Voice Changer  | Dedicated voice SDK                                                   |
 * | CDN            | Cloudflare                                                            |
 * | Frontend       | Vercel                                                                |
 * | Backend APIs   | Supabase Edge Functions (or Cloudflare Workers for heavier workloads) |
 */
export const PLATFORM_ARCHITECTURE = {
  authentication: {
    provider: 'Supabase',
    role: 'Auth (sessions, OAuth, JWT)',
    status: 'active',
  },
  database: {
    provider: 'Supabase Postgres',
    role: 'Canonical app data (profiles, wallets, gifts, posts metadata, chat rows)',
    status: 'active',
  },
  realtime: {
    provider: 'Supabase Realtime',
    role: 'postgres_changes / presence for cross-user surfaces',
    status: 'active',
  },
  images: {
    provider: 'Cloudflare R2',
    role: 'Binary images; Postgres stores public URLs only',
    status: 'active',
    note: 'Bucket uniapplab-media via Cloudflare Worker + public r2.dev CDN URL.',
  },
  videos: {
    provider: 'Cloudflare R2',
    role: 'Binary videos / karaoke / reels media; Postgres stores public URLs only',
    status: 'active',
    note: 'Same object-storage lane as images.',
  },
  livestream: {
    provider: 'LiveKit',
    role: 'A/V transport for live, party, and calls — never store stream bytes in Postgres',
    status: 'active',
    note:
      'Primary: LiveKit. Optional backup: Tencent RTC (Call/Conference/Live/Chat/RTC Engine) credentials + UserSig are stored for a future opt-in — not used for transport unless explicitly enabled.',
  },
  aiBeauty: {
    provider: 'Third-party AI SDK',
    role: 'Tencent WebAR / DeepAR / CSS beauty pipelines on camera tracks',
    status: 'active',
  },
  voiceChanger: {
    provider: 'Dedicated voice SDK',
    role: 'Web Audio / room voice-effect pipeline on published audio tracks',
    status: 'active',
  },
  cdn: {
    provider: 'Cloudflare',
    role: 'Cache immutable media at the edge in front of R2',
    status: 'active',
    note: 'Public reads use https://pub-*.r2.dev (Cloudflare). Custom media.* domain can be added later.',
  },
  frontend: {
    provider: 'Vercel',
    role: 'Vite/React SPA + PWA',
    status: 'active',
  },
  backendApis: {
    provider: 'Supabase Edge Functions (or Cloudflare Workers for heavier workloads)',
    role: 'Privileged mutations, signed uploads, wallet settle, LiveKit tokens',
    status: 'active',
    note:
      'Edge Functions live: architecture, media, wallet, gifts, livekit, admin, me, chat, stream, presence, payments, platform/brand, automation, disk-cleanup. Client routes migrated /api/* groups to Edge for the Supabase-auth lane and falls back to Vercel Express for Firebase / binary brand-icon / manifest. Media bytes: Cloudflare Worker (R2). Additive client facades: src/services/* (Auth, Upload, Wallet, Gift, Room, …) wrap lib/ without UI changes.',
  },
} as const;

/** Explicit non-goals — Marketplace extras must not become app databases. */
export const PLATFORM_NON_GOALS = [
  'MongoDB Atlas — not an app data store (auth/wallets/media/realtime stay off Mongo)',
  'Amazon Aurora — not an app data store (Supabase Postgres is canonical)',
  'Supabase Storage — media bytes belong on Cloudflare R2, not Storage buckets',
  'Auth0 / Firebase Auth as primary — Supabase Auth is canonical',
] as const;

export type PlatformArchitectureKey = keyof typeof PLATFORM_ARCHITECTURE;
