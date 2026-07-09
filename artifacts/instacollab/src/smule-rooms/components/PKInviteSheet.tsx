import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, Shuffle, Swords, UserPlus, Users, X } from 'lucide-react';
import { safeAvatarUrl } from '../../lib/safe';
import type { PkLiveHost } from '../hooks/usePkLiveHosts';
import { pickRandomPkLiveHost } from '../hooks/usePkLiveHosts';
import type { PKMode } from '../utils/liveRoomTypes';
import {
  filterPkLiveHostsByFollow,
  pkInviteFollowFilterLabel,
  searchPkLiveHosts,
  type PkInviteFollowFilter,
} from '../utils/pkInviteSearch';

export type PKMatchType = 'invite' | 'random';

export type PKConnectOptions = {
  mode: PKMode;
  matchType: PKMatchType;
  opponentUserId: string;
  opponentName: string;
  opponentAvatar?: string;
  opponentRoomId?: string;
};

export type PKInviteSheetProps = {
  open: boolean;
  onClose: () => void;
  liveHosts: PkLiveHost[];
  liveHostsLoading?: boolean;
  liveHostsError?: string | null;
  onRefreshHosts?: () => void;
  selfUserId: string;
  connecting?: boolean;
  connectedOpponentName?: string | null;
  onConnect: (options: PKConnectOptions) => void;
  onDisconnect?: () => void;
};

const FOLLOW_FILTERS: PkInviteFollowFilter[] = ['all', 'following', 'followers'];

export function PKInviteSheet({
  open,
  onClose,
  liveHosts,
  liveHostsLoading = false,
  liveHostsError = null,
  onRefreshHosts,
  selfUserId,
  connecting = false,
  connectedOpponentName = null,
  onConnect,
  onDisconnect,
}: PKInviteSheetProps) {
  const [mode, setMode] = useState<PKMode>('single');
  const [matchType, setMatchType] = useState<PKMatchType>('invite');
  const [search, setSearch] = useState('');
  const [followFilter, setFollowFilter] = useState<PkInviteFollowFilter>('all');
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const randomConnectRequestedRef = useRef(false);

  const inviteCandidates = useMemo(
    () => liveHosts.filter((host) => host.userId !== selfUserId),
    [liveHosts, selfUserId],
  );

  const filteredHosts = useMemo(() => {
    const searched = searchPkLiveHosts(inviteCandidates, search);
    return filterPkLiveHostsByFollow(searched, followFilter);
  }, [followFilter, inviteCandidates, search]);

  useEffect(() => {
    if (!open) {
      randomConnectRequestedRef.current = false;
      setSearch('');
      setFollowFilter('all');
      setSelectedOpponentId(null);
      return;
    }
    onRefreshHosts?.();
  }, [onRefreshHosts, open]);

  useEffect(() => {
    if (!open || matchType !== 'random') {
      randomConnectRequestedRef.current = false;
    }
  }, [matchType, open]);

  useEffect(() => {
    if (!open || matchType !== 'random' || connecting || connectedOpponentName) return;
    if (liveHostsLoading || randomConnectRequestedRef.current) return;

    randomConnectRequestedRef.current = true;
    const pool = filterPkLiveHostsByFollow(inviteCandidates, followFilter);
    const randomHost = pickRandomPkLiveHost(pool.length > 0 ? pool : inviteCandidates, selfUserId);
    onConnect({
      mode,
      matchType: 'random',
      opponentUserId: randomHost?.userId ?? `pk-random-${Date.now()}`,
      opponentName: randomHost?.name ?? 'Practice rival',
      opponentAvatar: randomHost?.avatar,
      opponentRoomId: randomHost?.roomId,
    });
  }, [
    connectedOpponentName,
    connecting,
    followFilter,
    inviteCandidates,
    liveHostsLoading,
    matchType,
    mode,
    onConnect,
    open,
    selfUserId,
  ]);

  if (!open) return null;

  const selectedOpponent =
    inviteCandidates.find((host) => host.userId === selectedOpponentId) ?? null;

  const handleInviteConnect = () => {
    if (!selectedOpponent) return;
    onConnect({
      mode,
      matchType: 'invite',
      opponentUserId: selectedOpponent.userId,
      opponentName: selectedOpponent.name,
      opponentAvatar: selectedOpponent.avatar,
      opponentRoomId: selectedOpponent.roomId,
    });
  };

  const isConnected = Boolean(connectedOpponentName);

  return (
    <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/45 p-0 sm:p-3 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <button type="button" className="absolute inset-0" aria-label="Close PK panel" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-md max-h-[min(62dvh,32rem)] flex-col overflow-hidden rounded-t-2xl border border-blue-400/25 border-b-0 bg-gray-950/95 shadow-2xl backdrop-blur-md sm:rounded-2xl sm:border-b">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-white">PK battle</p>
            <p className="text-[11px] text-white/50">
              Connect on live, then start when you are ready
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] scrollbar-hide">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-blue-200/80">Mode</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'single' as const, label: '1v1', icon: Swords },
                { id: 'team' as const, label: 'Team', icon: Users },
              ]).map((option) => {
                const Icon = option.icon;
                const selected = mode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isConnected || connecting}
                    onClick={() => setMode(option.id)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-wide transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${
                      selected
                        ? 'border-blue-400/55 bg-blue-500/20 text-blue-100'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <Icon size={14} aria-hidden />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-blue-200/80">Match</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'invite' as const, label: 'Invite', icon: UserPlus },
                { id: 'random' as const, label: 'Random', icon: Shuffle },
              ]).map((option) => {
                const Icon = option.icon;
                const selected = matchType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isConnected || connecting}
                    onClick={() => setMatchType(option.id)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-wide transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${
                      selected
                        ? 'border-fuchsia-400/55 bg-fuchsia-500/20 text-fuchsia-100'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <Icon size={14} aria-hidden />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {isConnected ? (
            <div className="space-y-3 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-3">
              <p className="text-[11px] font-bold text-emerald-100">
                Connected to {connectedOpponentName}
              </p>
              <p className="text-[10px] text-emerald-100/70">
                PK is linked on your live stream. Use Start PK on the battle bar when ready, or disconnect to cancel.
              </p>
              {onDisconnect ? (
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="w-full rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/85 transition hover:bg-white/15 active:scale-[0.98]"
                >
                  Disconnect
                </button>
              ) : null}
            </div>
          ) : matchType === 'invite' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wide text-white/45">
                  Available live
                </p>
                <span className="text-[10px] font-bold text-white/35">
                  {liveHostsLoading ? '…' : `${filteredHosts.length}`}
                </span>
              </div>

              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search user id, name, room id…"
                  className="w-full rounded-xl border border-white/10 bg-black/35 py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-white/35 focus:border-fuchsia-400/45 focus:outline-none"
                />
              </div>

              <div className="flex gap-1.5">
                {FOLLOW_FILTERS.map((filter) => {
                  const selected = followFilter === filter;
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setFollowFilter(filter)}
                      className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide transition ${
                        selected
                          ? 'border-fuchsia-400/50 bg-fuchsia-500/20 text-fuchsia-100'
                          : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10'
                      }`}
                    >
                      {pkInviteFollowFilterLabel(filter)}
                    </button>
                  );
                })}
              </div>

              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2 scrollbar-hide">
                {liveHostsLoading && filteredHosts.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 px-2 py-8 text-[11px] text-white/50">
                    <Loader2 size={14} className="animate-spin" />
                    Loading available live users…
                  </div>
                ) : filteredHosts.length > 0 ? (
                  filteredHosts.map((host) => {
                    const selected = selectedOpponentId === host.userId;
                    return (
                      <button
                        key={`${host.userId}-${host.roomId}`}
                        type="button"
                        onClick={() => setSelectedOpponentId(host.userId)}
                        className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition active:scale-[0.99] ${
                          selected
                            ? 'border-fuchsia-400/50 bg-fuchsia-500/15'
                            : 'border-transparent bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <img
                          src={safeAvatarUrl(host.avatar)}
                          alt=""
                          className="h-8 w-8 rounded-full border border-white/15 object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-bold text-white/90">
                              {host.name}
                            </span>
                            {host.isFollowing ? (
                              <span className="shrink-0 rounded-full bg-fuchsia-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase text-fuchsia-200">
                                Following
                              </span>
                            ) : null}
                            {host.isFollower ? (
                              <span className="shrink-0 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase text-blue-200">
                                Follower
                              </span>
                            ) : null}
                          </span>
                          <span className="block truncate text-[10px] text-white/45">
                            @{host.username} · Room {host.roomId}
                          </span>
                          <span className="block truncate text-[10px] text-white/35">
                            {host.roomTitle} · ID {host.publicUserId}
                          </span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-2 py-6 text-center text-[11px] text-white/45">
                    {liveHostsError
                      ? liveHostsError
                      : search.trim() || followFilter !== 'all'
                        ? 'No live users match your search or filter.'
                        : 'No other live or shop streams right now. Try random match.'}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!selectedOpponent || connecting}
                onClick={handleInviteConnect}
                className="w-full rounded-full border border-fuchsia-400/45 bg-gradient-to-b from-fuchsia-600 to-fuchsia-800 px-4 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg transition hover:from-fuchsia-500 hover:to-fuchsia-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {connecting ? 'Connecting…' : 'Send invite'}
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3">
              {connecting ? (
                <div className="flex items-center justify-center gap-2 text-[11px] text-white/70">
                  <Loader2 size={14} className="animate-spin text-blue-300" />
                  Finding a random live rival…
                </div>
              ) : (
                <p className="text-[11px] text-white/55">
                  Random match connects you to another live host automatically. The battle will not start until you tap Start PK.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
