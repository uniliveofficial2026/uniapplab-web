import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Video } from 'lucide-react';
import { useDB, useDbRevision } from '../../lib/useDB';
import {
  LIVE_KIND_LABELS,
  discoveryLiveKindFromTags,
  isLiveKind,
  liveKindFromRoomMode,
  roomModeFromLiveKind,
} from '../../lib/liveRing';
import type { LiveKind, User } from '../../types';
import { FALLBACK_MEDIA, resolveUser, safeMediaUrl } from '../../lib/safe';
import { useCloudLiveDiscovery } from '../../hooks/useCloudLiveDiscovery';
import { normalizeRoomPrivacy } from '../../smule-rooms/utils/roomPrivacy';
import { useLiveViewerPreviews } from '../../hooks/useLiveViewerPreviews';
import {
  openGoLiveCreateRoom,
  openLiveUserRoom,
  preloadLiveRoomEntry,
} from '../../lib/live/openLiveRoom';
import {
  isHostLiveEnded,
  isHostUserLiveEnded,
} from '../../lib/live/hostLiveEndedRegistry';
import { isPartyCloudAvailable } from '../../lib/party/partyCloud';
import { fetchLivePkSession, isPlatformApiAvailable, startStream } from '../../lib/platformApi';
import {
  parsePkLiveMediaRef,
  resolvePkMediaId,
  resolvePkMediaSurface,
} from '../../lib/live/pkLiveMediaRef';
import { getStoredOwnerPartyRoomId } from '../../smule-rooms/utils/ownerPartyRoomId';
import { LiveDiscoveryVideoPreview } from './LiveDiscoveryVideoPreview';
import { LiveDiscoveryCardChrome } from './LiveDiscoveryCardChrome';
import {
  LiveFiltersPanel,
  formatLiveCountryLabel,
  liveFollowFilterLabel,
  liveTypeFilterLabel,
  matchesLiveSearch,
  matchesLiveTypeFilter,
  parseLiveSearchQuery,
  resolveLiveCountry,
  resolveLiveRoomType,
  type LiveFollowFilter,
  type LiveTypeFilter,
} from './LiveFiltersPanel';
import { formatRoomModeLabel } from '../../smule-rooms/utils/managedRooms';
import {
  UniLivesDiscoveryEmptyState,
  UniLivesLiveRoomCard,
} from '../discovery/brand';
import type { OneVsOnePkSessionOpen } from './OneVsOnePkSessionContainer';
import { teamPkSessionFromSnapshot, type TeamPkSessionOpen } from '../../lib/live/teamPkSession';

const OneVsOnePkSessionContainer = lazy(() =>
  import('./OneVsOnePkSessionContainer').then((m) => ({ default: m.OneVsOnePkSessionContainer })),
);
const TeamPkSessionContainer = lazy(() =>
  import('./TeamPkSessionContainer').then((m) => ({ default: m.TeamPkSessionContainer })),
);

const LIVE_PREVIEW_FALLBACK = FALLBACK_MEDIA;

function pickCloudLiveItem<
  T extends {
    partyRoomId?: string;
    streamId?: string;
    viewerCount?: number;
    privacy?: string | null;
  },
>(a: T | undefined, b: T): T {
  if (!a) return b;
  const score = (item: T) =>
    (item.partyRoomId ? 4 : 0) +
    (item.streamId ? 2 : 0) +
    (item.privacy ? 1 : 0) +
    (item.viewerCount ?? 0);
  const winner = score(b) >= score(a) ? b : a;
  const other = winner === b ? a : b;
  // Keep privacy from either side so Public/Private badge stays accurate.
  if (!winner.privacy && other.privacy) {
    return { ...winner, privacy: other.privacy };
  }
  return winner;
}

function resolveCardLiveKind(
  user: User,
  cloud?: { tags?: string[]; partyRoomId?: string },
): LiveKind {
  const roomModeTag = cloud?.tags?.find(
    (t) => !isLiveKind(t) && t !== 'Live' && String(t).toLowerCase() !== 'pk',
  );
  if (cloud?.tags?.length) {
    return discoveryLiveKindFromTags(cloud.tags, roomModeTag);
  }
  // Without party/stream tags, never show PK from a stale profile live_kind alone.
  if (user.liveKind && isLiveKind(user.liveKind) && user.liveKind !== 'pk') {
    return user.liveKind;
  }
  return 'solo';
}

export function LiveScreen() {
  const db = useDB();
  const me = resolveUser(db.users, db.currentUser);
  const meId = me.id && me.id !== 'unknown' ? me.id : '';
  const cloudDiscoveryEnabled = isPartyCloudAvailable() || isPlatformApiAvailable();
  const cloudLive = useCloudLiveDiscovery(cloudDiscoveryEnabled, meId || null);
  const localLiveUsers = db.users.filter(
    (u: User) =>
      u?.status === 'live' &&
      Boolean(u.id) &&
      u.id !== meId &&
      !isHostUserLiveEnded(u.id),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<LiveTypeFilter>('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [followFilter, setFollowFilter] = useState<LiveFollowFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pkSession, setPkSession] = useState<OneVsOnePkSessionOpen | null>(null);
  const [teamPkSession, setTeamPkSession] = useState<TeamPkSessionOpen | null>(null);
  const dbRevision = useDbRevision();

  useEffect(() => {
    // Warm karaoke + rooms + LiveKit while browsing discovery so enter is instant.
    void preloadLiveRoomEntry();
    void import('../../lib/preloadAppSurfaces').then((m) => m.preloadHostMediaPath());
  }, []);

  const liveUsers = useMemo(() => {
    const byId = new Map<string, User>();
    const cloudUserIds = new Set(
      cloudLive.streams
        .filter((row) => row.userId && !isHostUserLiveEnded(row.userId))
        .filter((row) => !row.partyRoomId || !isHostLiveEnded(row.partyRoomId))
        .map((row) => row.userId),
    );

    // When cloud discovery is on, only show hosts with an active cloud row —
    // never keep sticky local/demo "live" status in LIVE NOW.
    if (!cloudDiscoveryEnabled) {
      for (const u of localLiveUsers) byId.set(u.id, u);
    } else {
      for (const u of localLiveUsers) {
        if (cloudUserIds.has(u.id)) byId.set(u.id, u);
      }
    }

    for (const row of cloudLive.streams) {
      if (!row.userId || row.userId === meId || byId.has(row.userId)) continue;
      if (isHostUserLiveEnded(row.userId)) continue;
      if (row.partyRoomId && isHostLiveEnded(row.partyRoomId)) continue;
      const roomModeHint = row.tags.find(
        (t) => !isLiveKind(t) && t !== 'Live' && String(t).toLowerCase() !== 'pk',
      );
      const liveKind = discoveryLiveKindFromTags(row.tags, roomModeHint);
      byId.set(row.userId, {
        id: row.userId,
        username: row.user,
        displayName: row.user,
        avatarUrl: row.img,
        bio: '',
        followers: 0,
        following: 0,
        status: 'live',
        liveKind,
      });
    }
    return [...byId.values()];
  }, [localLiveUsers, cloudLive.streams, meId, cloudDiscoveryEnabled]);

  const followingIds = useMemo(
    () => new Set(meId ? db.getFollowingIds(meId) : []),
    [db, meId, dbRevision],
  );
  const followerIds = useMemo(
    () => new Set(meId ? db.getFollowerIds(meId) : []),
    [db, meId, dbRevision],
  );

  const livePreviewCards = useMemo(() => {
    const cloudByUserId = new Map<string, (typeof cloudLive.streams)[number]>();
    for (const stream of cloudLive.streams) {
      if (!stream.userId) continue;
      cloudByUserId.set(
        stream.userId,
        pickCloudLiveItem(cloudByUserId.get(stream.userId), stream),
      );
    }
    return liveUsers.map((user) => {
      const cloud = cloudByUserId.get(user.id);
      const liveKind = resolveCardLiveKind(user, cloud);
      const partyRoomId =
        cloud?.partyRoomId || getStoredOwnerPartyRoomId(user.id) || undefined;
      const roomMode =
        cloud?.tags?.find((t) => !isLiveKind(t) && t !== 'Live') || undefined;
      const roomType = resolveLiveRoomType(liveKind, roomMode);
      const country = resolveLiveCountry(user.id, user.country);
      const resolved = resolveUser(db.users, user, me);
      return {
        user: resolved,
        img:
          safeMediaUrl(cloud?.img || resolved.avatarUrl || user.avatarUrl, {
            fallback: LIVE_PREVIEW_FALLBACK,
          }) || LIVE_PREVIEW_FALLBACK,
        viewerCount: cloud?.viewerCount ?? 0,
        streamId: cloud?.streamId,
        partyRoomId,
        liveKind,
        kindLabel: LIVE_KIND_LABELS[liveKind],
        title: cloud?.title || `${resolved.displayName || resolved.username}'s live`,
        roomMode,
        roomType,
        privacy: normalizeRoomPrivacy(cloud?.privacy),
        country,
        isFollowing: followingIds.has(user.id),
        isFollower: followerIds.has(user.id),
      };
    });
  }, [liveUsers, cloudLive.streams, db.users, me, followingIds, followerIds]);

  const availableCountries = useMemo(() => {
    const set = new Set(livePreviewCards.map((card) => card.country));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [livePreviewCards]);

  const parsedSearch = useMemo(
    () => parseLiveSearchQuery(searchQuery),
    [searchQuery],
  );

  const effectiveTypeFilter: LiveTypeFilter =
    typeFilter !== 'all' ? typeFilter : parsedSearch.typeHint ?? 'all';
  const effectiveCountryFilter =
    countryFilter !== 'all' ? countryFilter : parsedSearch.countryHint ?? 'all';
  const effectiveFollowFilter: LiveFollowFilter =
    followFilter !== 'all' ? followFilter : parsedSearch.followHint ?? 'all';

  const filteredLiveCards = useMemo(() => {
    return livePreviewCards.filter((card) => {
      if (!matchesLiveTypeFilter(effectiveTypeFilter, card.liveKind, card.roomMode)) {
        return false;
      }
      if (effectiveCountryFilter !== 'all' && card.country !== effectiveCountryFilter) {
        return false;
      }
      if (effectiveFollowFilter === 'following' && !card.isFollowing) {
        return false;
      }
      if (effectiveFollowFilter === 'followers' && !card.isFollower) {
        return false;
      }
      if (!matchesLiveSearch(card, parsedSearch.text)) {
        return false;
      }
      return true;
    });
  }, [
    livePreviewCards,
    effectiveTypeFilter,
    effectiveCountryFilter,
    effectiveFollowFilter,
    parsedSearch.text,
  ]);

  const viewerPreviewTargets = useMemo(
    () =>
      filteredLiveCards.map((card) => ({
        key: card.user.id,
        streamId: card.streamId,
        partyRoomId: card.partyRoomId,
        initialCount: card.viewerCount,
      })),
    [filteredLiveCards],
  );
  const liveViewerPreviews = useLiveViewerPreviews(viewerPreviewTargets, true);

  useEffect(() => {
    const discovered = cloudLive.streams
      .filter((s) => s.userId && s.userId !== meId)
      .map((s) => {
        const kindTag = s.tags[0];
        const liveKind = isLiveKind(kindTag)
          ? kindTag
          : liveKindFromRoomMode(kindTag);
        return {
          id: s.userId,
          username: s.user,
          displayName: s.user,
          avatarUrl: s.img,
          bio: '',
          followers: 0,
          following: 0,
          status: 'live' as const,
          liveKind,
        };
      });
    if (discovered.length) db.cacheDiscoveredUsers(discovered);
  }, [cloudLive.streams, db, meId]);

  const filterSummary = [
    searchQuery.trim() ? `“${searchQuery.trim()}”` : null,
    effectiveFollowFilter !== 'all'
      ? liveFollowFilterLabel(effectiveFollowFilter)
      : null,
    effectiveTypeFilter !== 'all' ? liveTypeFilterLabel(effectiveTypeFilter) : null,
    effectiveCountryFilter !== 'all'
      ? formatLiveCountryLabel(effectiveCountryFilter)
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col w-full min-h-0 flex-1 bg-[color:var(--color-unilives-discovery-background)]">
    <div className="app-screen-scroll flex flex-col w-full max-w-[600px] mx-auto px-4 py-6 md:py-10 gap-6">
      <div className="bg-gradient-to-br from-[color:var(--color-unilives-discovery-live)] to-rose-700 rounded-3xl p-8 text-white shadow-xl shadow-red-900/20 flex flex-col sm:flex-row items-center sm:justify-between text-center sm:text-left gap-6 relative overflow-hidden ring-1 ring-white/10">
        <div
          className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"
          aria-hidden
        />
        <div className="relative z-10">
          <h2 className="font-extrabold text-2xl mb-2 flex items-center justify-center sm:justify-start gap-2">
            <Video className="w-6 h-6" /> Host a Live Concert
          </h2>
          <p className="text-white/80 max-w-sm text-sm">
            Go live or watch creators streaming now. Followers get notified when you start.
          </p>
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            aria-label="go-live-entry"
            data-live-qa-state="go-live-entry"
            onClick={() => {
              openGoLiveCreateRoom({ mode: 'Solo-Live' });
            }}
            className="px-8 py-4 bg-white text-red-700 font-bold rounded-full transition-all hover:scale-105 motion-reduce:hover:scale-100 shadow-2xl whitespace-nowrap text-lg"
          >
            Go Live
          </button>
          <button
            type="button"
            data-ui-id="live.pk.1v1.discovery.start"
            onClick={() => {
              void startStream('1v1 PK')
                .then((stream) => {
                  setPkSession({
                    roomId: stream.id,
                    streamId: stream.id,
                    mediaSurface: 'stream',
                    isHost: true,
                    hostUserId: meId,
                    hostName: me.displayName || me.username || 'Host',
                    hostAvatarUrl: me.avatarUrl,
                  });
                })
                .catch(() => {
                  window.dispatchEvent(
                    new CustomEvent('app-toast', {
                      detail: 'Could not start 1v1 PK.',
                    }),
                  );
                });
            }}
            className="px-8 py-4 bg-white/15 text-white font-bold rounded-full transition-all hover:scale-105 motion-reduce:hover:scale-100 shadow-2xl whitespace-nowrap text-lg ring-1 ring-white/30"
          >
            1v1 PK
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <LiveFiltersPanel
          title={`Live now (${filteredLiveCards.length}${
            filteredLiveCards.length !== livePreviewCards.length
              ? ` / ${livePreviewCards.length}`
              : ''
          })`}
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          countryFilter={countryFilter}
          onCountryFilterChange={setCountryFilter}
          followFilter={followFilter}
          onFollowFilterChange={setFollowFilter}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          availableCountries={availableCountries}
        />

        {filterSummary ? (
          <p className="px-1 text-[11px] font-semibold text-[color:var(--color-unilives-discovery-muted)]">
            Showing: {filterSummary}
          </p>
        ) : null}

        {livePreviewCards.length === 0 ? (
          <UniLivesDiscoveryEmptyState
            title="No one is live right now"
            message="Tap Go Live to start a room."
          />
        ) : filteredLiveCards.length === 0 ? (
          <UniLivesDiscoveryEmptyState
            title="No live rooms match these filters."
            action={
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all');
                  setCountryFilter('all');
                  setFollowFilter('all');
                  setSearchQuery('');
                }}
                className="rounded-full border border-[color:var(--color-unilives-discovery-border)] bg-[color:var(--color-unilives-discovery-surface)] px-4 py-2 text-xs font-bold text-[color:var(--color-unilives-discovery-text)] hover:opacity-90 transition-colors"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredLiveCards.map(
              ({
                user,
                img,
                viewerCount,
                partyRoomId,
                streamId,
                liveKind,
                kindLabel,
                title,
                roomMode,
                roomType,
                privacy,
                country,
              }) => {
              const preview = liveViewerPreviews[user.id];
              const count = preview?.count ?? viewerCount;
              const avatars = preview?.avatars ?? [];
              const caption =
                preview?.caption ||
                formatRoomModeLabel(roomType || roomMode || (partyRoomId ? 'Room' : 'Live'));
              return (
              <UniLivesLiveRoomCard
                key={user.id}
                roomId={partyRoomId || streamId || user.id}
                liveKindLabel={kindLabel}
                onPointerDown={() => {
                  void preloadLiveRoomEntry();
                }}
                onClick={() => {
                  if (liveKind === 'pk') {
                    const discovery = parsePkLiveMediaRef(streamId || partyRoomId || user.id);
                    const lifecycleRoomId = partyRoomId || streamId || user.id;
                    void fetchLivePkSession(lifecycleRoomId)
                      .then((snap) => {
                        const pk = snap.pk;
                        if (pk?.pkType === 'pk_team') {
                          setPkSession(null);
                          setTeamPkSession(teamPkSessionFromSnapshot(pk));
                          return;
                        }
                        const hostMediaId = resolvePkMediaId(pk?.hostMediaId, pk?.roomId || streamId || partyRoomId);
                        const opponentMediaId = resolvePkMediaId(
                          pk?.opponentMediaId,
                          pk?.opponentRoomId || null,
                        );
                        setTeamPkSession(null);
                        setPkSession({
                          roomId: pk?.roomId || lifecycleRoomId,
                          streamId: hostMediaId || discovery.mediaId,
                          mediaSurface: resolvePkMediaSurface(
                            pk?.hostMediaSurface,
                            pk?.roomId || streamId || partyRoomId,
                          ),
                          opponentStreamId: opponentMediaId || null,
                          opponentMediaSurface: pk?.opponentRoomId
                            ? resolvePkMediaSurface(pk?.opponentMediaSurface, pk.opponentRoomId)
                            : null,
                          opponentRoomId: pk?.opponentRoomId || null,
                          isHost: false,
                          hostUserId: pk?.hostUserId || snap.hostUserId || user.id,
                          opponentUserId: pk?.opponentUserId,
                          hostName: user.displayName || user.username,
                          hostAvatarUrl: user.avatarUrl || img,
                        });
                      })
                      .catch(() => {
                        setTeamPkSession(null);
                        setPkSession({
                          roomId: lifecycleRoomId,
                          streamId: discovery.mediaId || streamId || partyRoomId || user.id,
                          mediaSurface: discovery.surface,
                          isHost: false,
                          hostUserId: user.id,
                          hostName: user.displayName || user.username,
                          hostAvatarUrl: user.avatarUrl || img,
                        });
                      });
                    return;
                  }
                  void openLiveUserRoom(user.id, {
                    partyRoomId,
                    streamId,
                    roomName: title,
                    roomMode: roomMode || roomModeFromLiveKind(liveKind),
                    hostName: user.displayName || user.username,
                    liveKind,
                  }).then((opened) => {
                    if (!opened) {
                      window.dispatchEvent(
                        new CustomEvent('app-toast', {
                          detail: 'This live room is no longer available.',
                        }),
                      );
                    }
                  });
                }}
              >
                <LiveDiscoveryVideoPreview
                  posterUrl={img}
                  hostUserId={user.id}
                  partyRoomId={partyRoomId}
                  streamId={streamId}
                />
                <LiveDiscoveryCardChrome
                  viewerCount={count}
                  viewerAvatars={avatars}
                  caption={caption}
                  privacy={privacy}
                  country={country}
                  hostName={user.displayName || user.username}
                  hostAvatarUrl={user.avatarUrl || img}
                  title={title}
                  subtitle={kindLabel}
                  pkLabel={liveKind === 'pk' ? 'PK' : undefined}
                />
              </UniLivesLiveRoomCard>
              );
            })}
          </div>
        )}
      </div>

      {teamPkSession ? (
        <Suspense fallback={null}>
          <TeamPkSessionContainer
            session={teamPkSession}
            onClose={() => setTeamPkSession(null)}
          />
        </Suspense>
      ) : null}

      {pkSession ? (
        <Suspense fallback={null}>
          <OneVsOnePkSessionContainer
            session={pkSession}
            onClose={() => setPkSession(null)}
          />
        </Suspense>
      ) : null}
    </div>
    </div>
  );
}
