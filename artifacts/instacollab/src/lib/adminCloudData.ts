/**
 * Real-time cloud data lane for Admin Control Center.
 * Uses Supabase SELECT (RLS) + postgres_changes for live feed.
 * Admin API remains the mutation path when role=admin.
 */
import { getSupabaseClient, getSupabaseClientAsync } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';
import type {
  AdminChatMessageRow,
  AdminCommentRow,
  AdminContentRow,
  AdminGiftRow,
  AdminOverview,
  AdminPartyRoomRow,
  AdminStreamRow,
  AdminWalletRow,
} from './adminApi';

const ADMIN_RT_TOPIC = 'admin-control-center';

type ProfileLite = { username?: string; display_name?: string };

async function client() {
  if (!isSupabaseConfigured()) return null;
  return (await getSupabaseClientAsync()) ?? getSupabaseClient();
}

async function countExact(
  table: string,
  filter?: { column: string; value: string },
  idColumn = 'id',
): Promise<number> {
  const sb = await client();
  if (!sb) return 0;
  let q = sb.from(table).select(idColumn, { count: 'exact', head: true });
  if (filter) q = q.eq(filter.column, filter.value);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

async function profilesByIds(ids: string[]): Promise<Map<string, ProfileLite>> {
  const map = new Map<string, ProfileLite>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const sb = await client();
  if (!sb) return map;
  const { data } = await sb.from('profiles').select('id, username, display_name').in('id', unique);
  for (const row of (data ?? []) as Array<{ id: string; username: string | null; display_name: string | null }>) {
    map.set(String(row.id), {
      username: row.username ?? undefined,
      display_name: row.display_name ?? undefined,
    });
  }
  return map;
}

type PostLite = {
  id: string;
  author_id: string;
  payload: Record<string, unknown> | null;
  is_archived: boolean;
  created_at: string;
};

type CommentLite = {
  id: string;
  target_kind: string;
  target_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type StreamLite = {
  id: string;
  user_id: string;
  title: string | null;
  status: string | null;
  started_at: string;
  ended_at: string | null;
};

type PartyRoomLite = {
  id: string;
  owner_id: string;
  room_name: string | null;
  room_mode: string | null;
  status: string | null;
  participant_count: number | null;
  created_at: string;
  privacy?: string | null;
};

type GiftLite = {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string | null;
  body: string | null;
  kind: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

type ChatLite = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
};

type WalletLite = {
  user_id: string;
  balance: number | null;
  updated_at: string | null;
};

export async function cloudAdminFetchOverview(): Promise<AdminOverview | null> {
  const sb = await client();
  if (!sb) return null;

  const [users, postsRes, comments, chatMessages, liveStreams, activePartyRooms, giftMessages, wallets] =
    await Promise.all([
      countExact('profiles'),
      sb.from('posts').select('id, payload').eq('is_archived', false).limit(500),
      countExact('social_comments'),
      countExact('chat_messages'),
      countExact('streams', { column: 'status', value: 'live' }),
      countExact('party_rooms', { column: 'status', value: 'active' }),
      countExact('party_room_messages', { column: 'kind', value: 'gift' }),
      countExact('wallets', undefined, 'user_id'),
    ]);

  const posts = (postsRes.data ?? []) as Array<{ id: string; payload: Record<string, unknown> | null }>;
  const reels = posts.filter((row) => {
    const payload = row.payload;
    return payload?.contentKind === 'reel';
  }).length;

  return {
    users,
    posts: posts.length,
    reels,
    comments,
    chatMessages,
    liveStreams,
    activePartyRooms,
    giftMessages,
    wallets,
  };
}

export async function cloudAdminListPosts(q?: string): Promise<AdminContentRow[]> {
  const sb = await client();
  if (!sb) return [];
  const { data, error } = await sb
    .from('posts')
    .select('id, author_id, payload, is_archived, created_at')
    .order('created_at', { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const rows = data as PostLite[];
  const authors = await profilesByIds(rows.map((r) => String(r.author_id)));
  const needle = q?.trim().toLowerCase();
  return rows
    .map((row) => ({
      id: row.id,
      author_id: row.author_id,
      payload: row.payload ?? {},
      is_archived: Boolean(row.is_archived),
      created_at: row.created_at,
      author: authors.get(String(row.author_id)) ?? null,
    }))
    .filter((row) => row.payload.contentKind !== 'reel')
    .filter((row) => {
      if (!needle) return true;
      const caption = String(row.payload.caption ?? '').toLowerCase();
      const author = `${row.author?.username ?? ''} ${row.author?.display_name ?? ''}`.toLowerCase();
      return caption.includes(needle) || author.includes(needle) || row.id.includes(needle);
    });
}

export async function cloudAdminListReels(q?: string): Promise<AdminContentRow[]> {
  const sb = await client();
  if (!sb) return [];
  const { data, error } = await sb
    .from('posts')
    .select('id, author_id, payload, is_archived, created_at')
    .order('created_at', { ascending: false })
    .limit(120);
  if (error || !data) return [];
  const rows = data as PostLite[];
  const authors = await profilesByIds(rows.map((r) => String(r.author_id)));
  const needle = q?.trim().toLowerCase();
  return rows
    .map((row) => ({
      id: row.id,
      author_id: row.author_id,
      payload: row.payload ?? {},
      is_archived: Boolean(row.is_archived),
      created_at: row.created_at,
      author: authors.get(String(row.author_id)) ?? null,
    }))
    .filter((row) => row.payload.contentKind === 'reel')
    .filter((row) => {
      if (!needle) return true;
      const caption = String(row.payload.caption ?? '').toLowerCase();
      const author = `${row.author?.username ?? ''} ${row.author?.display_name ?? ''}`.toLowerCase();
      return caption.includes(needle) || author.includes(needle) || row.id.includes(needle);
    });
}

export async function cloudAdminListComments(q?: string): Promise<AdminCommentRow[]> {
  const sb = await client();
  if (!sb) return [];
  const { data, error } = await sb
    .from('social_comments')
    .select('id, target_kind, target_id, author_id, body, created_at')
    .order('created_at', { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const rows = data as CommentLite[];
  const authors = await profilesByIds(rows.map((r) => String(r.author_id)));
  const needle = q?.trim().toLowerCase();
  return rows
    .map((row) => ({
      id: row.id,
      target_kind: String(row.target_kind),
      target_id: String(row.target_id),
      author_id: String(row.author_id),
      body: String(row.body ?? ''),
      created_at: String(row.created_at),
      author: authors.get(String(row.author_id)) ?? null,
    }))
    .filter((row) => {
      if (!needle) return true;
      return (
        row.body.toLowerCase().includes(needle) ||
        `${row.author?.username ?? ''} ${row.author?.display_name ?? ''}`.toLowerCase().includes(needle)
      );
    });
}

export async function cloudAdminListStreams(): Promise<AdminStreamRow[]> {
  const sb = await client();
  if (!sb) return [];
  const { data, error } = await sb
    .from('streams')
    .select('id, user_id, title, status, started_at, ended_at')
    .order('started_at', { ascending: false })
    .limit(60);
  if (error || !data) return [];
  const rows = data as StreamLite[];
  const hosts = await profilesByIds(rows.map((r) => String(r.user_id)));

  // Enrich with party-room privacy / room id so admin Live Streams can open
  // private Solo-Live / Multi-Guest rooms without filtering them out.
  const hostIds = [...new Set(rows.map((r) => String(r.user_id)))];
  const partyByOwner = new Map<
    string,
    { id: string; privacy: string | null; room_mode: string | null }
  >();
  if (hostIds.length > 0) {
    const { data: parties } = await sb
      .from('party_rooms')
      .select('id, owner_id, privacy, room_mode, status')
      .in('owner_id', hostIds)
      .eq('status', 'active')
      .limit(120);
    for (const party of parties ?? []) {
      const ownerId = String((party as { owner_id: string }).owner_id);
      if (partyByOwner.has(ownerId)) continue;
      partyByOwner.set(ownerId, {
        id: String((party as { id: string }).id),
        privacy: (party as { privacy?: string | null }).privacy ?? null,
        room_mode: (party as { room_mode?: string | null }).room_mode ?? null,
      });
    }
  }

  return rows.map((row) => {
    const party = partyByOwner.get(String(row.user_id));
    return {
      id: row.id,
      user_id: row.user_id,
      title: String(row.title ?? ''),
      status: String(row.status ?? ''),
      started_at: String(row.started_at),
      ended_at: row.ended_at ? String(row.ended_at) : null,
      privacy: party?.privacy ?? null,
      party_room_id: party?.id ?? null,
      room_mode: party?.room_mode ?? null,
      host: hosts.get(String(row.user_id)) ?? null,
    };
  });
}

export async function cloudAdminListPartyRooms(q?: string): Promise<AdminPartyRoomRow[]> {
  const sb = await client();
  if (!sb) return [];
  let query = sb
    .from('party_rooms')
    .select('id, owner_id, room_name, room_mode, status, participant_count, created_at, privacy')
    .order('created_at', { ascending: false })
    .limit(60);
  const needle = q?.trim();
  if (needle) {
    query = query.or(`room_name.ilike.%${needle}%,room_mode.ilike.%${needle}%`);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  const rows = data as PartyRoomLite[];
  const owners = await profilesByIds(rows.map((r) => String(r.owner_id)));
  return rows.map((row) => ({
    id: row.id,
    owner_id: row.owner_id,
    room_name: String(row.room_name ?? ''),
    room_mode: String(row.room_mode ?? ''),
    status: String(row.status ?? ''),
    participant_count: Number(row.participant_count ?? 0),
    created_at: String(row.created_at),
    privacy: row.privacy ?? null,
    owner: owners.get(String(row.owner_id)) ?? null,
  }));
}

export async function cloudAdminListGifts(): Promise<AdminGiftRow[]> {
  const sb = await client();
  if (!sb) return [];
  const { data, error } = await sb
    .from('party_room_messages')
    .select('id, room_id, sender_id, sender_name, body, kind, meta, created_at')
    .eq('kind', 'gift')
    .order('created_at', { ascending: false })
    .limit(80);
  if (error || !data) return [];
  return (data as GiftLite[]).map((row) => ({
    id: row.id,
    room_id: String(row.room_id),
    sender_id: String(row.sender_id),
    sender_name: String(row.sender_name ?? ''),
    body: String(row.body ?? ''),
    kind: String(row.kind ?? 'gift'),
    meta: row.meta ?? {},
    created_at: String(row.created_at),
  }));
}

export async function cloudAdminListChatMessages(q?: string): Promise<AdminChatMessageRow[]> {
  const sb = await client();
  if (!sb) return [];
  const { data, error } = await sb
    .from('chat_messages')
    .select('id, thread_id, sender_id, body, created_at')
    .order('created_at', { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const rows = data as ChatLite[];
  const senders = await profilesByIds(rows.map((r) => String(r.sender_id)));
  const needle = q?.trim().toLowerCase();
  return rows
    .map((row) => ({
      id: row.id,
      thread_id: String(row.thread_id),
      sender_id: String(row.sender_id),
      body: String(row.body ?? ''),
      created_at: String(row.created_at),
      sender: senders.get(String(row.sender_id)) ?? null,
    }))
    .filter((row) => {
      if (!needle) return true;
      return (
        row.body.toLowerCase().includes(needle) ||
        `${row.sender?.username ?? ''} ${row.sender?.display_name ?? ''}`.toLowerCase().includes(needle)
      );
    });
}

export async function cloudAdminListWallets(q?: string): Promise<AdminWalletRow[]> {
  const sb = await client();
  if (!sb) return [];
  const { data, error } = await sb
    .from('wallets')
    .select('user_id, balance, updated_at')
    .order('updated_at', { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const rows = data as WalletLite[];
  const profiles = await profilesByIds(rows.map((r) => String(r.user_id)));
  const needle = q?.trim().toLowerCase();
  return rows
    .map((row) => ({
      user_id: String(row.user_id),
      balance: Number(row.balance ?? 0),
      updated_at: row.updated_at ? String(row.updated_at) : null,
      profile: profiles.get(String(row.user_id)) ?? null,
    }))
    .filter((row) => {
      if (!needle) return true;
      return (
        row.user_id.includes(needle) ||
        `${row.profile?.username ?? ''} ${row.profile?.display_name ?? ''}`.toLowerCase().includes(needle)
      );
    });
}

/** Subscribe to cloud tables that power the Control Center; returns unsubscribe. */
export function subscribeAdminCloudRealtime(onChange: () => void): () => void {
  let cancelled = false;
  let channel: ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>['channel']> | null = null;
  let timer: number | null = null;

  const schedule = () => {
    if (cancelled) return;
    if (timer != null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      onChange();
    }, 250);
  };

  void (async () => {
    const sb = await client();
    if (!sb || cancelled) return;
    channel = sb
      .channel(`${ADMIN_RT_TOPIC}:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_comments' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_rooms' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_room_messages' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, schedule)
      .subscribe();
  })();

  return () => {
    cancelled = true;
    if (timer != null) window.clearTimeout(timer);
    const sb = getSupabaseClient();
    if (sb && channel) void sb.removeChannel(channel);
  };
}
