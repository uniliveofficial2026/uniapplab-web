import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Coins,
  Eye,
  FileText,
  Gift,
  Heart,
  KeyRound,
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  Mic2,
  Palette,
  PlaySquare,
  Sparkles,
  Plug,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
  X,
  Lock,
  Globe2,
  Ban,
  Square,
  Joystick,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useDB, useDbRevision } from '../../lib/useDB';
import { AppBrandPortalCard } from './AppBrandPortalCard';
import { AdminPanel } from './AdminPanel';
import { AutomationControlToggles } from '../workspace/AutomationControlToggles';
import { SplashAdMediaPicker, isSplashAdVideoUrl } from './SplashAdMediaPicker';
import {
  adminArchivePost,
  adminBanPartyRoom,
  adminBanStream,
  adminCreditWallet,
  adminDeleteChatMessage,
  adminDeleteComment,
  adminEndPartyRoom,
  adminFetchOverview,
  adminListChatMessages,
  adminListComments,
  adminListGifts,
  adminListPartyRooms,
  adminListPosts,
  adminListReels,
  adminListStreams,
  adminListTransactions,
  adminListWallets,
  adminStopStream,
  fetchMe,
  type AdminOverview,
} from '../../lib/adminApi';
import {
  cloudAdminFetchOverview,
  cloudAdminListChatMessages,
  cloudAdminListComments,
  cloudAdminListGifts,
  cloudAdminListPartyRooms,
  cloudAdminListPosts,
  cloudAdminListReels,
  cloudAdminListStreams,
  cloudAdminListWallets,
  subscribeAdminCloudRealtime,
} from '../../lib/adminCloudData';
import { hydratePlatformSession } from '../../lib/walletServerSync';
import { resolveUser } from '../../lib/safe';
import { AdminPreviewCard, AdminPreviewPanel, buildAdminPreview, type AdminPreviewModel } from './AdminLivePreview';
import { AdminUserProgressCard } from './AdminUserProgressCard';
import { IntegrationStatusPanel } from './IntegrationStatusPanel';
import { AdminCreationStudio } from './AdminCreationStudio';
import { AdminLeaderboardPanel } from './AdminLeaderboardPanel';
import { buildAdminUserInsights, type AdminUserInsights } from '../../lib/adminUserInsights';
import { consumeWorkspaceGreedyAdminHint, peekWorkspaceGreedyAdminHint, WORKSPACE_GREEDY_ADMIN_EVENT } from '../../lib/appBrandRuntime';
import { useGreedySession } from '../../contexts/GreedySessionContext';
import { lookupAdminUserRank } from '../../lib/adminLeaderboard';
import { resolveLiveCountry } from '../live/liveCountries';

export type AdminSection =
  | 'overview'
  | 'users'
  | 'posts'
  | 'reels'
  | 'comments'
  | 'messages'
  | 'live'
  | 'party'
  | 'gifts'
  | 'wallet'
  | 'dating'
  | 'karaoke'
  | 'greedy'
  | 'moderation'
  | 'platform'
  | 'integrations'
  | 'studio'
  | 'leaderboard'
  | 'auth';

type SectionMeta = {
  id: AdminSection;
  label: string;
  shortLabel: string;
  group: string;
  icon: LucideIcon;
  overviewKey?: keyof AdminOverview | 'moderation' | 'dating';
  tone: string;
};

const SECTIONS: SectionMeta[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Home', group: 'Control', icon: LayoutDashboard, tone: 'text-primary bg-primary/10' },
  { id: 'greedy', label: 'Greedy Tap Admin', shortLabel: 'Greedy', group: 'Control', icon: Joystick, tone: 'text-orange-500 bg-orange-500/10' },
  { id: 'leaderboard', label: 'Levels & Ranks', shortLabel: 'Ranks', group: 'Control', icon: Trophy, tone: 'text-amber-500 bg-amber-500/10' },
  { id: 'users', label: 'Users & Auth', shortLabel: 'Users', group: 'Control', icon: Users, tone: 'text-blue-500 bg-blue-500/10' },
  { id: 'auth', label: 'Roles & Sessions', shortLabel: 'Roles', group: 'Control', icon: KeyRound, tone: 'text-violet-500 bg-violet-500/10' },
  { id: 'posts', label: 'Posts', shortLabel: 'Posts', group: 'Content', icon: FileText, overviewKey: 'posts', tone: 'text-emerald-500 bg-emerald-500/10' },
  { id: 'reels', label: 'Reels', shortLabel: 'Reels', group: 'Content', icon: PlaySquare, overviewKey: 'reels', tone: 'text-pink-500 bg-pink-500/10' },
  { id: 'comments', label: 'Comments', shortLabel: 'Comments', group: 'Content', icon: MessageCircle, overviewKey: 'comments', tone: 'text-cyan-500 bg-cyan-500/10' },
  { id: 'messages', label: 'Messages & Chat', shortLabel: 'Chat', group: 'Content', icon: MessageSquare, overviewKey: 'chatMessages', tone: 'text-indigo-500 bg-indigo-500/10' },
  { id: 'moderation', label: 'Report Queue', shortLabel: 'Reports', group: 'Content', icon: ShieldAlert, overviewKey: 'moderation', tone: 'text-destructive bg-destructive/10' },
  { id: 'live', label: 'Live Streams', shortLabel: 'Live', group: 'Live & Rooms', icon: Radio, overviewKey: 'liveStreams', tone: 'text-red-500 bg-red-500/10' },
  { id: 'party', label: 'Party Rooms', shortLabel: 'Party', group: 'Live & Rooms', icon: Users, overviewKey: 'activePartyRooms', tone: 'text-orange-500 bg-orange-500/10' },
  { id: 'gifts', label: 'Live & Party Gifts', shortLabel: 'Gifts', group: 'Live & Rooms', icon: Gift, overviewKey: 'giftMessages', tone: 'text-amber-500 bg-amber-500/10' },
  { id: 'karaoke', label: 'Karaoke & Games', shortLabel: 'Karaoke', group: 'Live & Rooms', icon: Mic2, tone: 'text-fuchsia-500 bg-fuchsia-500/10' },
  { id: 'dating', label: 'Dating', shortLabel: 'Dating', group: 'Social', icon: Heart, overviewKey: 'dating', tone: 'text-rose-500 bg-rose-500/10' },
  { id: 'wallet', label: 'Wallet & Transactions', shortLabel: 'Wallet', group: 'Commerce', icon: Wallet, overviewKey: 'wallets', tone: 'text-yellow-500 bg-yellow-500/10' },
  { id: 'platform', label: 'Brand & Splash Ads', shortLabel: 'Brand', group: 'Platform', icon: Palette, tone: 'text-teal-500 bg-teal-500/10' },
  { id: 'studio', label: 'Creation Studio', shortLabel: 'Studio', group: 'Platform', icon: Sparkles, tone: 'text-purple-500 bg-purple-500/10' },
  { id: 'integrations', label: 'Integrations', shortLabel: 'Integrations', group: 'Platform', icon: Plug, tone: 'text-slate-500 bg-slate-500/10' },
];

const LIVE_REFRESH_MS = 30_000;

function isRoomWatchSection(section: AdminSection): boolean {
  return section === 'live' || section === 'party' || section === 'karaoke';
}

type AdminPrivacyFilter = 'all' | 'public' | 'private';

function resolveAdminRowPrivacy(raw: Record<string, unknown>): 'Public' | 'Private' {
  const privacy = String(raw.privacy ?? '').trim().toLowerCase();
  if (privacy === 'private') return 'Private';
  return 'Public';
}

function rowMatchesPrivacyFilter(
  raw: Record<string, unknown>,
  filter: AdminPrivacyFilter,
): boolean {
  if (filter === 'all') return true;
  const privacy = resolveAdminRowPrivacy(raw);
  return filter === 'private' ? privacy === 'Private' : privacy === 'Public';
}

function SectionShell({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 sm:p-5 border-b border-border bg-secondary/10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
            {Icon ? (
              <span className="p-2 rounded-xl bg-background border border-border shrink-0">
                <Icon className="w-4 h-4" />
              </span>
            ) : null}
            <span className="truncate">{title}</span>
          </h2>
          {description ? <p className="text-xs text-muted-foreground mt-1">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function EmptyState({ text, icon: Icon = Activity }: { text: string; icon?: LucideIcon }) {
  return (
    <div className="text-sm text-muted-foreground text-center py-10 flex flex-col items-center gap-2">
      <Icon className="w-8 h-8 opacity-40" />
      <p>{text}</p>
    </div>
  );
}

function LiveBadge({ live }: { live: boolean }) {
  if (!live) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      Live
    </span>
  );
}

function formatWhen(value?: string | number | null) {
  if (!value) return '';
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleString();
}

export function useModerationFlagCount(): number {
  const db = useDB();
  useDbRevision();
  return useMemo(
    () => (db.posts ?? []).filter((post) => post.isReported && !post.isArchived).length,
    [db.posts],
  );
}

type DetailRecord = {
  section: AdminSection;
  raw: Record<string, unknown>;
  preview: AdminPreviewModel;
  userInsights?: AdminUserInsights;
};

export function AdminControlCenter() {
  const db = useDB();
  useDbRevision();
  const { openAdmin } = useGreedySession();
  const [section, setSection] = useState<AdminSection>(() =>
    peekWorkspaceGreedyAdminHint() ? 'greedy' : 'overview',
  );
  const [serverAdmin, setServerAdmin] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState<AdminPrivacyFilter>('all');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [rows, setRows] = useState<unknown[]>([]);
  const [creditUserId, setCreditUserId] = useState('');
  const [creditAmount, setCreditAmount] = useState('100');
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [detail, setDetail] = useState<DetailRecord | null>(null);
  const [navPage, setNavPage] = useState(0);

  const users = db.users ?? [];
  const posts = db.posts ?? [];
  const reels = db.reels ?? [];
  const moderationCount = useModerationFlagCount();
  const activeSection = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  const [splashAdUrl, setSplashAdUrl] = useState<string>((db.settings.splashAdUrl as string) || '');
  const [splashAdDuration, setSplashAdDuration] = useState<number>((db.settings.splashAdDuration as number) || 2);
  const [splashAdEnabled, setSplashAdEnabled] = useState<boolean>((db.settings.splashAdEnabled as boolean) || false);

  // Land on Greedy section when hinted; fullscreen opens only via the explicit button.
  useEffect(() => {
    const openGreedySection = () => {
      if (consumeWorkspaceGreedyAdminHint()) {
        setSection('greedy');
      }
    };
    openGreedySection();
    window.addEventListener(WORKSPACE_GREEDY_ADMIN_EVENT, openGreedySection);
    return () => window.removeEventListener(WORKSPACE_GREEDY_ADMIN_EVENT, openGreedySection);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const meId = db.currentUser?.id;
        if (meId) await hydratePlatformSession(meId);
        const me = await fetchMe();
        if (cancelled) return;
        setServerAdmin(me.role === 'admin' || db.currentUser?.role === 'admin');
      } catch {
        if (!cancelled) setServerAdmin(db.currentUser?.role === 'admin');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db.currentUser?.id, db.currentUser?.role]);

  const loadOverview = useCallback(async () => {
    try {
      if (serverAdmin) {
        try {
          setOverview(await adminFetchOverview());
          return;
        } catch {
          /* fall through to cloud lane */
        }
      }
      const cloud = await cloudAdminFetchOverview();
      if (cloud) setOverview(cloud);
    } catch {
      /* keep previous */
    }
  }, [serverAdmin]);

  const loadSection = useCallback(async (opts?: { silent?: boolean; manual?: boolean }) => {
    const silent = opts?.silent ?? true;
    setError(null);
    if (opts?.manual) setManualRefresh(true);

    if (section === 'overview') {
      try {
        await loadOverview();
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : 'Failed to load overview');
      } finally {
        if (opts?.manual) setManualRefresh(false);
        setLastRefresh(Date.now());
      }
      return;
    }

    const cloudSections = new Set([
      'posts',
      'reels',
      'comments',
      'messages',
      'live',
      'party',
      'gifts',
      'karaoke',
      'wallet',
    ]);
    if (!cloudSections.has(section)) {
      setLastRefresh(Date.now());
      if (opts?.manual) setManualRefresh(false);
      return;
    }

    try {
      switch (section) {
        case 'posts': {
          if (serverAdmin) {
            try {
              const { items } = await adminListPosts(query);
              setRows(items);
              break;
            } catch {
              /* cloud fallback */
            }
          }
          setRows(await cloudAdminListPosts(query));
          break;
        }
        case 'reels': {
          if (serverAdmin) {
            try {
              const { items } = await adminListReels(query);
              setRows(items);
              break;
            } catch {
              /* cloud fallback */
            }
          }
          setRows(await cloudAdminListReels(query));
          break;
        }
        case 'comments': {
          if (serverAdmin) {
            try {
              const { items } = await adminListComments(query);
              setRows(items);
              break;
            } catch {
              /* cloud fallback */
            }
          }
          setRows(await cloudAdminListComments(query));
          break;
        }
        case 'messages': {
          if (serverAdmin) {
            try {
              const { items } = await adminListChatMessages(query);
              setRows(items);
              break;
            } catch {
              /* cloud fallback */
            }
          }
          setRows(await cloudAdminListChatMessages(query));
          break;
        }
        case 'live': {
          if (serverAdmin) {
            try {
              const { items } = await adminListStreams();
              setRows(items);
              break;
            } catch {
              /* cloud fallback */
            }
          }
          setRows(await cloudAdminListStreams());
          break;
        }
        case 'party': {
          if (serverAdmin) {
            try {
              const { items } = await adminListPartyRooms(query);
              setRows(items);
              break;
            } catch {
              /* cloud fallback */
            }
          }
          setRows(await cloudAdminListPartyRooms(query));
          break;
        }
        case 'gifts': {
          if (serverAdmin) {
            try {
              const { items } = await adminListGifts();
              setRows(items);
              break;
            } catch {
              /* cloud fallback */
            }
          }
          setRows(await cloudAdminListGifts());
          break;
        }
        case 'karaoke': {
          const rooms = serverAdmin
            ? await adminListPartyRooms(query || 'Karaoke')
                .then((r) => r.items)
                .catch(() => cloudAdminListPartyRooms(query || 'Karaoke'))
            : await cloudAdminListPartyRooms(query || 'Karaoke');
          setRows(rooms.filter((row) => /karaoke|game|party/i.test(row.room_mode)));
          break;
        }
        case 'wallet': {
          if (serverAdmin) {
            try {
              const [{ items: wallets }, { items: txs }] = await Promise.all([
                adminListWallets(query),
                adminListTransactions(),
              ]);
              setRows([
                ...wallets.map((w) => ({ ...w, _kind: 'wallet' })),
                ...txs.map((t) => ({ ...t, _kind: 'tx' })),
              ]);
              break;
            } catch {
              /* cloud fallback */
            }
          }
          const wallets = await cloudAdminListWallets(query);
          setRows(wallets.map((w) => ({ ...w, _kind: 'wallet' })));
          break;
        }
        default:
          break;
      }
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      if (opts?.manual) setManualRefresh(false);
      setLastRefresh(Date.now());
    }
  }, [loadOverview, query, section, serverAdmin]);

  useEffect(() => {
    if (!isRoomWatchSection(section)) {
      setPrivacyFilter('all');
    }
  }, [section]);

  const refreshAll = useCallback(() => {
    void loadSection({ silent: false, manual: true });
  }, [loadSection]);

  useEffect(() => {
    void loadSection({ silent: true });
  }, [loadSection]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadSection({ silent: true });
    }, LIVE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadSection]);

  useEffect(() => {
    return subscribeAdminCloudRealtime(() => {
      void loadSection({ silent: true });
    });
  }, [loadSection]);

  const moderationFlags = useMemo(() => {
    return posts
      .filter((post) => post.isReported && !post.isArchived)
      .map((post) => {
        const author = resolveUser(users, post.user);
        return { id: post.id, caption: post.caption, author, post };
      });
  }, [posts, users]);

  const datingReports = useMemo(() => {
    const reports = db.datingState?.reports ?? [];
    return reports.map((row) => ({
      userId: row.userId,
      reason: row.reason,
      user: users.find((u) => u.id === row.userId),
    }));
  }, [db.datingState, users]);

  const localMessages = useMemo(() => {
    const store = db.messages ?? {};
    const flat: Array<{
      id: string;
      chatId: string;
      text: string;
      senderId?: string;
      createdAt?: number;
    }> = [];
    for (const [chatId, list] of Object.entries(store)) {
      for (const msg of list ?? []) {
        flat.push({
          id: String(msg.id),
          chatId,
          text: String(msg.text ?? msg.content ?? ''),
          senderId:
            typeof msg.senderId === 'string'
              ? msg.senderId
              : typeof msg.from === 'string'
                ? msg.from
                : undefined,
          createdAt: typeof msg.timestamp === 'number' ? msg.timestamp : undefined,
        });
      }
    }
    return flat
      .filter((m) => !query.trim() || m.text.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50);
  }, [db.messages, query]);

  const localComments = useMemo(() => {
    const items: Array<{ id: string; targetId: string; targetKind: 'post' | 'reel'; text: string }> = [];
    for (const [postId, list] of Object.entries(db.postComments ?? {})) {
      for (const comment of list ?? []) {
        if (!comment) continue;
        items.push({
          id: String(comment.id ?? `${postId}-${items.length}`),
          targetId: postId,
          targetKind: 'post',
          text: String((comment as { text?: string; body?: string }).text ?? (comment as { body?: string }).body ?? ''),
        });
      }
    }
    for (const [reelId, list] of Object.entries(db.reelComments ?? {})) {
      for (const comment of list ?? []) {
        if (!comment) continue;
        items.push({
          id: String(comment.id ?? `${reelId}-${items.length}`),
          targetId: reelId,
          targetKind: 'reel',
          text: String((comment as { text?: string; body?: string }).text ?? (comment as { body?: string }).body ?? ''),
        });
      }
    }
    return items
      .filter((c) => !query.trim() || c.text.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50);
  }, [db.postComments, db.reelComments, query]);

  const localStats = useMemo(
    () => ({
      users: users.length,
      posts: posts.length,
      reels: reels.length,
      comments: Object.values(db.postComments ?? {}).reduce((n, list) => n + (list?.length ?? 0), 0)
        + Object.values(db.reelComments ?? {}).reduce((n, list) => n + (list?.length ?? 0), 0),
      chatMessages: localMessages.length,
      liveStreams: users.filter((u) => u.status === 'live').length,
      activePartyRooms: 0,
      giftMessages: 0,
      wallets: users.length,
    }),
    [db.postComments, db.reelComments, localMessages.length, posts.length, reels.length, users],
  );

  const saveSplash = () => {
    db.updateSettings({ splashAdUrl, splashAdDuration, splashAdEnabled });
    window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Splash ad settings saved!' }));
  };

  const groupedSections = useMemo(() => {
    const groups = new Map<string, SectionMeta[]>();
    for (const item of SECTIONS) {
      const list = groups.get(item.group) ?? [];
      list.push(item);
      groups.set(item.group, list);
    }
    return [...groups.entries()];
  }, []);

  const overviewCards = useMemo(() => {
    const stats = overview ?? localStats;
    return [
      { key: 'users', label: 'Users', value: stats.users, section: 'users' as AdminSection, icon: Users, live: true },
      { key: 'posts', label: 'Posts', value: stats.posts, section: 'posts' as AdminSection, icon: FileText, live: false },
      { key: 'reels', label: 'Reels', value: stats.reels, section: 'reels' as AdminSection, icon: PlaySquare, live: false },
      { key: 'comments', label: 'Comments', value: stats.comments, section: 'comments' as AdminSection, icon: MessageCircle, live: false },
      { key: 'chatMessages', label: 'Chat', value: stats.chatMessages, section: 'messages' as AdminSection, icon: MessageSquare, live: true },
      { key: 'liveStreams', label: 'Live', value: stats.liveStreams, section: 'live' as AdminSection, icon: Radio, live: stats.liveStreams > 0 },
      { key: 'activePartyRooms', label: 'Party', value: stats.activePartyRooms, section: 'party' as AdminSection, icon: Users, live: stats.activePartyRooms > 0 },
      { key: 'giftMessages', label: 'Gifts', value: stats.giftMessages, section: 'gifts' as AdminSection, icon: Gift, live: false },
      { key: 'wallets', label: 'Wallets', value: stats.wallets, section: 'wallet' as AdminSection, icon: Wallet, live: false },
      { key: 'moderation', label: 'Reports', value: moderationCount, section: 'moderation' as AdminSection, icon: ShieldAlert, live: moderationCount > 0 },
      { key: 'dating', label: 'Dating', value: datingReports.length, section: 'dating' as AdminSection, icon: Heart, live: false },
    ];
  }, [datingReports.length, localStats, moderationCount, overview]);

  const resolveUserInsights = useCallback(
    (raw: Record<string, unknown>, previewSection: AdminSection = section): AdminUserInsights | undefined => {
      const userId = String(
        previewSection === 'auth' || previewSection === 'users'
          ? raw.id ?? ''
          : raw.author_id ?? raw.user_id ?? raw.owner_id ?? raw.sender_id ?? raw.userId ?? raw.from ?? '',
      ).trim();
      if (!userId) return undefined;
      return buildAdminUserInsights(db, userId);
    },
    [db, section],
  );

  const enrichUserMeta = useCallback(
    (userId: string) => {
      const id = String(userId || '').trim();
      if (!id) return [];
      const progress = db.getCreatorProgress(id);
      const user = users.find((row) => row.id === id);
      const rank = lookupAdminUserRank(db, id, 'xp');
      const country = resolveLiveCountry(id, user?.country);
      return [
        { label: 'Level', value: `Lv ${progress.level} · ${progress.tierLabel}` },
        { label: 'XP', value: progress.xp.toLocaleString() },
        ...(rank.globalRank != null ? [{ label: 'Global rank', value: `#${rank.globalRank}` }] : []),
        ...(rank.countryRank != null ? [{ label: `${country} rank`, value: `#${rank.countryRank}` }] : []),
      ];
    },
    [db, users],
  );

  const filteredRows = useMemo(() => {
    if (!isRoomWatchSection(section)) return rows;
    return rows.filter((raw) =>
      rowMatchesPrivacyFilter(raw as Record<string, unknown>, privacyFilter),
    );
  }, [privacyFilter, rows, section]);

  const privacyFilterCounts = useMemo(() => {
    if (!isRoomWatchSection(section)) {
      return { all: 0, public: 0, private: 0 };
    }
    let publicCount = 0;
    let privateCount = 0;
    for (const raw of rows) {
      const privacy = resolveAdminRowPrivacy(raw as Record<string, unknown>);
      if (privacy === 'Private') privateCount += 1;
      else publicCount += 1;
    }
    return { all: rows.length, public: publicCount, private: privateCount };
  }, [rows, section]);

  const makePreview = useCallback(
    (raw: Record<string, unknown>, previewSection: AdminSection | 'user' = section) =>
      buildAdminPreview({
        raw,
        section:
          previewSection === 'studio' ||
          previewSection === 'leaderboard' ||
          previewSection === 'greedy'
            ? 'overview'
            : previewSection,
        posts,
        reels,
        users,
        getFollowerCount: (userId) => db.getFollowListMembers(userId, 'followers').length,
        getFollowingCount: (userId) => db.getFollowListMembers(userId, 'following').length,
        enrichUserMeta,
      }),
    [db, enrichUserMeta, posts, reels, section, users],
  );

  const openDetail = (record: DetailRecord) => setDetail(record);

  const openDetailWithInsights = (record: Omit<DetailRecord, 'userInsights'>) => {
    openDetail({
      ...record,
      userInsights: resolveUserInsights(record.raw, record.section),
    });
  };

  const openFromRow = (item: Record<string, unknown>, itemSection: AdminSection) => {
    openDetailWithInsights({
      section: itemSection,
      raw: item,
      preview: makePreview(item, itemSection),
    });
  };

  const renderRefreshAction = () => (
    <button
      type="button"
      onClick={refreshAll}
      disabled={manualRefresh}
      className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border border-border bg-background hover:bg-secondary/60 disabled:opacity-60"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${manualRefresh ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">Refresh</span>
    </button>
  );

  const renderOverview = () => (
    <SectionShell
      title="System overview"
      icon={LayoutDashboard}
      description={
        serverAdmin
          ? 'Live cloud counts · Realtime + refresh every 8s · full moderation unlocked'
          : 'Live cloud counts · Realtime + refresh every 8s · sign in as platform admin for moderation actions'
      }
      action={renderRefreshAction()}
    >
      <div className="flex items-center justify-between gap-2 mb-4 text-[11px] font-bold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live data
        </span>
        <span>Updated {formatWhen(lastRefresh)}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
        {overviewCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setSection(card.section)}
              className="rounded-2xl border border-border bg-secondary/15 hover:bg-secondary/30 active:scale-[0.98] transition-all p-3 sm:p-4 text-left min-h-[88px]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="p-2 rounded-xl bg-background border border-border">
                  <Icon className="w-4 h-4" />
                </span>
                <LiveBadge live={card.live} />
              </div>
              <div className="text-xl sm:text-2xl font-black mt-2">{card.value}</div>
              <div className="text-[11px] sm:text-xs font-bold text-muted-foreground mt-0.5">{card.label}</div>
            </button>
          );
        })}
      </div>
    </SectionShell>
  );

  const renderRowActions = (item: Record<string, unknown>, id: string) => {
    const partyRoomId =
      typeof item.party_room_id === 'string' && item.party_room_id
        ? item.party_room_id
        : section === 'party' || section === 'karaoke'
          ? id
          : '';
    const hostUserId = String(
      item.owner_id ?? item.user_id ?? item.hostUserId ?? '',
    ).trim();
    const hostOpts = hostUserId ? { hostUserId } : undefined;

    const runModeration = async (action: () => Promise<unknown>) => {
      try {
        await action();
        await loadSection({ silent: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Moderation action failed');
      }
    };

    return (
    <div className="flex flex-wrap gap-2 shrink-0">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border border-border bg-background"
        onClick={() => openFromRow(item, section)}
      >
        <Eye className="w-3.5 h-3.5" />
        View
      </button>
      {(section === 'posts' || section === 'reels') && serverAdmin ? (
        <>
          <button type="button" className="text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border border-border" onClick={() => void adminArchivePost(id, true).then(() => loadSection({ silent: true }))}>Archive</button>
          <button type="button" className="text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border border-border" onClick={() => void adminArchivePost(id, false).then(() => loadSection({ silent: true }))}>Restore</button>
        </>
      ) : null}
      {section === 'comments' && serverAdmin ? (
        <button type="button" className="text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border border-destructive/40 text-destructive" onClick={() => void adminDeleteComment(id).then(() => loadSection({ silent: true }))}>Delete</button>
      ) : null}
      {section === 'messages' && serverAdmin ? (
        <button type="button" className="text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border border-destructive/40 text-destructive" onClick={() => void adminDeleteChatMessage(id).then(() => loadSection({ silent: true }))}>Delete</button>
      ) : null}
      {section === 'live' && serverAdmin ? (
        <>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-black px-3.5 py-2.5 min-h-[44px] rounded-xl border border-red-500/45 bg-red-500/10 text-red-500"
            onClick={() =>
              void runModeration(async () => {
                if (partyRoomId) {
                  await adminEndPartyRoom(partyRoomId, hostOpts);
                }
                await adminStopStream(id, {
                  partyRoomId: partyRoomId || undefined,
                  hostUserId: hostUserId || undefined,
                }).catch(() => undefined);
              })
            }
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop Live
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-black px-3.5 py-2.5 min-h-[44px] rounded-xl bg-destructive text-destructive-foreground"
            onClick={() => {
              if (
                !window.confirm(
                  'Stop this live stream and ban the host? They cannot go live until unbanned.',
                )
              ) {
                return;
              }
              void runModeration(async () => {
                if (partyRoomId) {
                  await adminBanPartyRoom(
                    partyRoomId,
                    'Live room banned by platform admin',
                    hostOpts,
                  );
                } else {
                  await adminBanStream(id, 'Live stream banned by platform admin', hostOpts);
                }
              });
            }}
          >
            <Ban className="w-3.5 h-3.5" />
            Ban Host
          </button>
          {partyRoomId ? (
            <button
              type="button"
              className="text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border border-border"
              onClick={() => void runModeration(() => adminEndPartyRoom(partyRoomId, hostOpts))}
            >
              End room
            </button>
          ) : null}
        </>
      ) : null}
      {(section === 'party' || section === 'karaoke') && serverAdmin ? (
        <>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-black px-3.5 py-2.5 min-h-[44px] rounded-xl border border-red-500/45 bg-red-500/10 text-red-500"
            onClick={() => void runModeration(() => adminEndPartyRoom(id, hostOpts))}
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop Live
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-black px-3.5 py-2.5 min-h-[44px] rounded-xl bg-destructive text-destructive-foreground"
            onClick={() => {
              if (
                !window.confirm(
                  'End this room and ban the owner? They cannot host until unbanned.',
                )
              ) {
                return;
              }
              void runModeration(() =>
                adminBanPartyRoom(id, 'Live room banned by platform admin', hostOpts),
              );
            }}
          >
            <Ban className="w-3.5 h-3.5" />
            Ban Host
          </button>
        </>
      ) : null}
    </div>
  );
  };

  const renderContentList = () => {
    if (filteredRows.length > 0) {
      return (
        <div className="space-y-3">
          {filteredRows.map((raw) => {
            const item = raw as Record<string, unknown>;
            const id = String(item.id ?? item.user_id ?? '');
            const preview = makePreview(item, section);
            const roomWatch = isRoomWatchSection(section);

            return (
              <div key={id} className="space-y-2">
                <AdminPreviewCard
                  preview={preview}
                  compact={!roomWatch}
                  fullViewport={roomWatch}
                  onModerationComplete={() => void loadSection({ silent: true })}
                />
                <div className="px-1">{renderRowActions(item, id)}</div>
              </div>
            );
          })}
        </div>
      );
    }

    if (rows.length > 0 && isRoomWatchSection(section) && privacyFilter !== 'all') {
      return (
        <EmptyState
          text={
            privacyFilter === 'private'
              ? 'No private live rooms in this list.'
              : 'No published (public) live rooms in this list.'
          }
        />
      );
    }

    const localItems =
      section === 'posts'
        ? posts.slice(0, 50)
        : section === 'reels'
          ? reels.slice(0, 50)
          : section === 'comments'
            ? localComments
            : section === 'messages'
              ? localMessages
              : section === 'live'
                ? users.filter((u) => u.status === 'live')
                : [];

    if (localItems.length === 0) {
      return (
        <EmptyState
          text={
            serverAdmin
              ? 'No cloud records yet for this section.'
              : 'No cloud records yet. Live updates appear here as users post, go live, or chat.'
          }
        />
      );
    }

    return (
      <div className="space-y-3">
        {localItems.map((item: any) => {
          const raw: Record<string, unknown> =
            section === 'comments'
              ? {
                  id: item.id,
                  target_id: item.targetId,
                  target_kind: item.targetKind,
                  body: item.text,
                  author_id: item.authorId,
                }
              : section === 'messages'
                ? {
                    id: item.id,
                    chatId: item.chatId,
                    text: item.text,
                    body: item.text,
                    sender_id: item.senderId,
                    senderId: item.senderId,
                    from: item.from,
                    media: item.media,
                    createdAt: item.createdAt,
                  }
                : section === 'live'
                  ? {
                      id: item.id,
                      user_id: item.id,
                      title: `${item.displayName ?? item.username} live`,
                      status: 'live',
                      privacy: 'Public',
                    }
                  : (item as Record<string, unknown>);

          if (isRoomWatchSection(section) && !rowMatchesPrivacyFilter(raw, privacyFilter)) {
            return null;
          }

          const preview = makePreview(raw, section);
          const roomWatch = isRoomWatchSection(section);

          return (
            <div key={String(raw.id ?? item.id)} className="space-y-2">
              <AdminPreviewCard
                preview={preview}
                compact={!roomWatch}
                fullViewport={roomWatch}
                onModerationComplete={() => void loadSection({ silent: true })}
              />
              <div className="px-1">{renderRowActions(raw, String(raw.id ?? item.id))}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const mobileNavChunks = useMemo(() => {
    const chunkSize = 4;
    const chunks: SectionMeta[][] = [];
    for (let i = 0; i < SECTIONS.length; i += chunkSize) {
      chunks.push(SECTIONS.slice(i, i + chunkSize));
    }
    return chunks;
  }, []);

  const renderMobileNav = () => {
    const pageItems = mobileNavChunks[navPage] ?? [];
    return (
      <div className="lg:hidden border border-border bg-card rounded-2xl p-3 space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {pageItems.map((item) => {
            const Icon = item.icon;
            const badge = item.id === 'moderation' ? moderationCount : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-3 min-h-[76px] text-[10px] font-black transition-all ${
                  section === item.id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-secondary/30 text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate w-full text-center px-0.5">{item.shortLabel}</span>
                {badge > 0 ? (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-black flex items-center justify-center">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {mobileNavChunks.length > 1 ? (
          <div className="flex items-center justify-between">
            <button type="button" disabled={navPage <= 0} onClick={() => setNavPage((p) => Math.max(0, p - 1))} className="p-2 rounded-xl border border-border disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-bold text-muted-foreground">{navPage + 1} / {mobileNavChunks.length}</span>
            <button type="button" disabled={navPage >= mobileNavChunks.length - 1} onClick={() => setNavPage((p) => Math.min(mobileNavChunks.length - 1, p + 1))} className="p-2 rounded-xl border border-border disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderDesktopNav = () => (
    <nav className="hidden lg:block border border-border bg-card rounded-2xl p-3 space-y-4 sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto no-scrollbar">
      {groupedSections.map(([group, items]) => (
        <div key={group}>
          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-2 mb-2">{group}</div>
          <div className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2.5 min-h-[44px] ${
                    section === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/60 text-muted-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.id === 'moderation' && moderationCount > 0 ? (
                    <span className="text-[10px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">{moderationCount}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const renderDetailSheet = () => {
    if (!detail) return null;
    const DetailIcon = SECTIONS.find((s) => s.id === detail.section)?.icon ?? Eye;
    return (
      <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4" data-app-overlay-root>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetail(null)} />
        <div className="relative z-10 w-full sm:max-w-lg bg-card border border-border rounded-t-[28px] sm:rounded-[28px] shadow-2xl max-h-[88dvh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-200">
          <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-2 rounded-xl bg-secondary/40 border border-border">
                  <DetailIcon className="w-4 h-4" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{detail.section}</span>
              </div>
              <h3 className="text-base sm:text-lg font-black line-clamp-3">{detail.preview.title}</h3>
              {detail.preview.subtitle ? <p className="text-xs text-muted-foreground mt-1">{detail.preview.subtitle}</p> : null}
            </div>
            <button type="button" onClick={() => setDetail(null)} className="p-2 rounded-xl hover:bg-secondary shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <AdminPreviewPanel
              preview={detail.preview}
              raw={detail.raw}
              userInsights={detail.userInsights}
              onModerationComplete={() => void loadSection({ silent: true })}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4 pb-[max(1rem,var(--app-safe-bottom))]">
      <div className="border border-border bg-card rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
                <span className="p-2 rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                Users Control
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Live admin for posts, reels, chat, wallet, live, party rooms, dating & more.
              </p>
            </div>
            {renderRefreshAction()}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            {serverAdmin ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Server admin · live API
              </span>
            ) : (
              <span className="text-muted-foreground bg-secondary/40 px-2.5 py-1 rounded-full">Local control mode</span>
            )}
            <span className="text-muted-foreground">Updated {formatWhen(lastRefresh)}</span>
          </div>
        </div>
      </div>

      {renderMobileNav()}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-3 sm:gap-4 items-start">
        {renderDesktopNav()}

        <div className="space-y-3 sm:space-y-4 min-w-0">
          <div className="lg:hidden flex items-center gap-2 px-1">
            <span className={`p-2 rounded-xl ${activeSection.tone}`}>
              <activeSection.icon className="w-4 h-4" />
            </span>
            <div>
              <div className="text-sm font-black">{activeSection.label}</div>
              <div className="text-[11px] text-muted-foreground">Tap refresh for latest data</div>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive px-1">{error}</p> : null}

          {section === 'overview' ? renderOverview() : null}
          {section === 'users' ? <AdminPanel /> : null}

          {section === 'greedy' ? (
            <SectionShell
              title="Greedy Tap Admin"
              icon={Joystick}
              description="Opens the original fullscreen game admin. Return to Workspace comes back here — picture-in-picture is only for the in-app Greedy game, not this admin panel."
            >
              <button
                type="button"
                onClick={() => openAdmin()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold px-5 py-3 shadow-sm hover:opacity-95 active:scale-[0.99] transition"
              >
                <Joystick className="w-4 h-4" />
                Open fullscreen Greedy Admin
              </button>
            </SectionShell>
          ) : null}

          {section === 'auth' ? (
            <SectionShell title="Roles & sessions" icon={KeyRound} description="Platform auth roles synced from profiles" action={renderRefreshAction()}>
              <div className="space-y-3">
                {users.map((user) => {
                  const raw = user as unknown as Record<string, unknown>;
                  const preview = makePreview(raw, 'auth');
                  return (
                    <div key={user.id} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => openDetailWithInsights({ section: 'auth', raw, preview })}
                        className="w-full text-left"
                      >
                        <AdminPreviewCard preview={preview} compact />
                      </button>
                      <AdminUserProgressCard insights={buildAdminUserInsights(db, user.id)} compact />
                    </div>
                  );
                })}
              </div>
            </SectionShell>
          ) : null}

          {['posts', 'reels', 'comments', 'messages', 'live', 'party', 'gifts', 'karaoke'].includes(section) ? (
            <SectionShell
              title={activeSection.label}
              icon={activeSection.icon}
              description={
                isRoomWatchSection(section)
                  ? 'Full-screen in-app room watch · real-time stream · tap Fullscreen for 100% viewport'
                  : serverAdmin
                    ? 'Live cloud records · auto-refresh 20s'
                    : 'Local cache on this device'
              }
              action={renderRefreshAction()}
            >
              {section !== 'gifts' ? (
                <form
                  className="mb-4 flex flex-col sm:flex-row gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void loadSection({ silent: true });
                  }}
                >
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="flex-1 text-sm border border-border rounded-xl px-3 py-3 min-h-[44px] bg-background"
                  />
                  <button type="submit" className="text-sm font-bold px-4 py-3 min-h-[44px] rounded-xl bg-primary text-primary-foreground">Search</button>
                </form>
              ) : null}
              {isRoomWatchSection(section) ? (
                <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Privacy filter">
                  {(
                    [
                      { id: 'all' as const, label: 'All', count: privacyFilterCounts.all, icon: null },
                      { id: 'public' as const, label: 'Publish', count: privacyFilterCounts.public, icon: Globe2 },
                      { id: 'private' as const, label: 'Private', count: privacyFilterCounts.private, icon: Lock },
                    ] as const
                  ).map((chip) => {
                    const Icon = chip.icon;
                    const active = privacyFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setPrivacyFilter(chip.id)}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border text-muted-foreground hover:bg-secondary/60'
                        }`}
                      >
                        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
                        {chip.label}
                        <span
                          className={`tabular-nums text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                            active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {chip.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {renderContentList()}
            </SectionShell>
          ) : null}

          {section === 'wallet' ? (
            <SectionShell title="Wallet & transactions" icon={Wallet} description="Credit coins and review ledger" action={renderRefreshAction()}>
              {serverAdmin ? (
                <form
                  className="mb-4 flex flex-col sm:flex-row gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void adminCreditWallet(creditUserId.trim(), Number(creditAmount)).then(() => loadSection({ silent: true }));
                  }}
                >
                  <input value={creditUserId} onChange={(e) => setCreditUserId(e.target.value)} placeholder="User UUID" className="flex-1 text-sm border border-border rounded-xl px-3 py-3 min-h-[44px] bg-background" />
                  <input value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} type="number" min={1} className="w-full sm:w-28 text-sm border border-border rounded-xl px-3 py-3 min-h-[44px] bg-background" />
                  <button type="submit" className="inline-flex items-center justify-center gap-1 text-sm font-bold px-4 py-3 min-h-[44px] rounded-xl bg-primary text-primary-foreground">
                    <Coins className="w-4 h-4" /> Credit
                  </button>
                </form>
              ) : null}
              {renderContentList()}
            </SectionShell>
          ) : null}

          {section === 'dating' ? (
            <SectionShell title="Dating reports" icon={Heart} description="Review reported dating profiles" action={renderRefreshAction()}>
              {datingReports.length === 0 ? (
                <EmptyState text="No dating reports on this device." icon={Heart} />
              ) : (
                <div className="space-y-3">
                  {datingReports.map((row) => {
                    const raw = row as unknown as Record<string, unknown>;
                    const preview = makePreview(raw, 'dating');
                    return (
                      <div key={row.userId} className="space-y-2">
                        <AdminPreviewCard preview={preview} compact />
                        <div className="flex gap-2 px-1">
                          <button
                            type="button"
                            className="text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border border-border"
                            onClick={() => openDetailWithInsights({ section: 'dating', raw, preview })}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border border-destructive/40 text-destructive shrink-0"
                            onClick={() => {
                              db.updateUser(row.userId, (u) => ({ ...u, bannedAt: Date.now(), banReason: `Dating report: ${row.reason}` }));
                              db.addAuditLog({ id: Date.now(), text: `Banned dating profile ${row.userId}`, time: 'Just now' });
                            }}
                          >
                            Ban
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionShell>
          ) : null}

          {section === 'moderation' ? (
            <SectionShell title="Report queue" icon={ShieldAlert} description="Flagged posts awaiting review" action={renderRefreshAction()}>
              {moderationFlags.length === 0 ? (
                <EmptyState text="All clear — no reported posts pending review." icon={ShieldCheck} />
              ) : (
                <div className="space-y-3">
                  {moderationFlags.map((flag) => {
                    const raw = { ...flag.post, post: flag.post } as unknown as Record<string, unknown>;
                    const preview = makePreview(raw, 'moderation');
                    return (
                      <div key={flag.id} className="space-y-2">
                        <AdminPreviewCard preview={preview} />
                        <div className="flex flex-wrap gap-2 px-1">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border border-border bg-background"
                            onClick={() =>
                              openDetailWithInsights({
                                section: flag.post.videoUrl ? 'reels' : 'posts',
                                raw: flag.post as unknown as Record<string, unknown>,
                                preview: makePreview(
                                  flag.post as unknown as Record<string, unknown>,
                                  flag.post.videoUrl ? 'reels' : 'posts',
                                ),
                              })
                            }
                          >
                            <Eye className="w-3.5 h-3.5" /> Full view
                          </button>
                          <button type="button" className="text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border border-border" onClick={() => db.updatePost(flag.id, (p) => ({ ...p, isReported: false, isArchived: true }))}>Reject</button>
                          <button type="button" className="text-xs font-bold px-3 py-2 min-h-[40px] rounded-xl border border-border" onClick={() => db.updatePost(flag.id, (p) => ({ ...p, isReported: false }))}>Approve</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionShell>
          ) : null}

          {section === 'platform' ? (
            <div className="space-y-4">
              <AppBrandPortalCard />
              <SectionShell title="Splash screen ads" icon={Palette} description="Configure launch ads">
                <div className="space-y-4">
                  <label className="flex items-center gap-2 font-bold text-sm min-h-[44px]">
                    <input type="checkbox" checked={splashAdEnabled} onChange={(e) => setSplashAdEnabled(e.target.checked)} />
                    Enable splash screen ad
                  </label>
                  {splashAdEnabled ? (
                    <>
                      <SplashAdMediaPicker
                        value={splashAdUrl}
                        onChange={setSplashAdUrl}
                        label="Splash / ad screen media"
                        description="Upload image or video shown on the launch splash ad screen (or paste a URL)."
                      />
                      <label className="block space-y-1.5">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                          Display duration (seconds)
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={splashAdDuration}
                          onChange={(e) => setSplashAdDuration(Number(e.target.value))}
                          className="w-full text-sm border border-border rounded-xl px-3 py-3 min-h-[44px] bg-background"
                        />
                      </label>
                      {splashAdUrl && isSplashAdVideoUrl(splashAdUrl) ? (
                        <p className="text-[11px] text-muted-foreground">
                          Video ads play muted on launch. Duration still controls when the splash can dismiss.
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  <button type="button" onClick={saveSplash} className="w-full sm:w-auto px-4 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-xl font-bold text-sm">Save ad settings</button>
                </div>
              </SectionShell>
            </div>
          ) : null}

          {section === 'integrations' ? (
            <div className="space-y-4">
              <AutomationControlToggles />
              <SectionShell title="Platform integrations" icon={Plug} description="Auto-config .env · SDK · API · packages · runtime overrides">
                <IntegrationStatusPanel />
              </SectionShell>
            </div>
          ) : null}

          {section === 'leaderboard' ? (
            <SectionShell title="Levels, leaderboard & ranks" icon={Trophy} description="Creator XP, level, followers, likes · filter by country" action={renderRefreshAction()}>
              <AdminLeaderboardPanel />
            </SectionShell>
          ) : null}

          {section === 'studio' ? (
            <SectionShell title="Creation studio" icon={Sparkles} description="Publish gifts & beauty effects to live/party rooms">
              <AdminCreationStudio />
            </SectionShell>
          ) : null}
        </div>
      </div>

      {renderDetailSheet()}
    </div>
  );
}
