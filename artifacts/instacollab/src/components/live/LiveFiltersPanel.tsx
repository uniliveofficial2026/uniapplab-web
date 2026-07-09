import React, { useEffect, useMemo, useState } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { roomModeFromLiveKind } from '../../lib/liveRing';
import type { LiveKind } from '../../types';
import {
  ROOM_MODE_OPTIONS,
  formatRoomModeLabel,
  type RoomModePickerOption,
} from '../../smule-rooms/utils/managedRooms';
import {
  LIVE_COUNTRY_OPTIONS,
  WORLD_COUNTRIES,
  countryFlagEmoji,
  formatLiveCountryLabel,
} from './liveCountries';

export type LiveTypeFilter = 'all' | RoomModePickerOption;
export type LiveFollowFilter = 'all' | 'following' | 'followers';

export {
  LIVE_COUNTRY_ISO,
  LIVE_COUNTRY_OPTIONS,
  WORLD_COUNTRIES,
  countryFlagEmoji,
  formatLiveCountryLabel,
  normalizeLiveCountryName,
  resolveLiveCountry,
} from './liveCountries';

const TYPE_SEARCH_ALIASES: Record<string, LiveTypeFilter> = {
  solo: 'Solo-Live',
  'solo-live': 'Solo-Live',
  sololive: 'Solo-Live',
  chat: 'Chat',
  lounge: 'Chat',
  audio: 'Chat',
  party: 'Party',
  pk: 'Party',
  karaoke: 'Karaoke',
  sing: 'Karaoke',
  radio: 'Radio',
  watch: 'Radio',
  together: 'Radio',
  multi: 'Multi-Guest',
  'multi-guest': 'Multi-Guest',
  multiguest: 'Multi-Guest',
  guest: 'Multi-Guest',
};

export type LiveSearchableCard = {
  user: {
    id: string;
    username?: string;
    displayName?: string;
    publicUserId?: string;
  };
  title: string;
  country: string;
  liveKind: LiveKind;
  kindLabel: string;
  roomMode?: string;
  roomType: string;
  partyRoomId?: string;
  streamId?: string;
  isFollowing: boolean;
  isFollower: boolean;
};

/** Parse free-text search into text tokens + auto follow/type/country hints. */
export function parseLiveSearchQuery(raw: string): {
  text: string;
  followHint: LiveFollowFilter | null;
  typeHint: LiveTypeFilter | null;
  countryHint: string | null;
} {
  const tokens = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let followHint: LiveFollowFilter | null = null;
  let typeHint: LiveTypeFilter | null = null;
  const kept: string[] = [];

  for (const token of tokens) {
    if (token === 'following' || token === 'follow') {
      followHint = 'following';
      continue;
    }
    if (token === 'followers' || token === 'follower') {
      followHint = 'followers';
      continue;
    }
    if (token === 'live' || token === 'room' || token === 'rooms' || token === 'user') {
      // Broad keywords — keep in text haystack match, don't drop.
      kept.push(token);
      continue;
    }
    const type = TYPE_SEARCH_ALIASES[token];
    if (type) {
      typeHint = type;
      continue;
    }
    kept.push(token);
  }

  let countryHint: string | null = null;
  const joined = kept.join(' ');
  if (joined.length >= 2) {
    const exact = LIVE_COUNTRY_OPTIONS.find((c) => c.toLowerCase() === joined);
    if (exact) {
      countryHint = exact;
    } else {
      const partial = LIVE_COUNTRY_OPTIONS.find(
        (c) => c.toLowerCase().startsWith(joined) || c.toLowerCase().includes(joined),
      );
      if (partial && joined.length >= 3) countryHint = partial;
    }
  }

  return {
    text: kept.join(' '),
    followHint,
    typeHint,
    countryHint,
  };
}

export function matchesLiveSearch(card: LiveSearchableCard, textQuery: string): boolean {
  const q = textQuery.trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const roomLabel = formatRoomModeLabel(card.roomType);
  const haystack = [
    card.user.displayName,
    card.user.username,
    card.user.id,
    card.user.publicUserId,
    card.title,
    card.country,
    formatLiveCountryLabel(card.country),
    card.kindLabel,
    card.liveKind,
    card.roomMode,
    card.roomType,
    roomLabel,
    card.partyRoomId,
    card.streamId,
    card.partyRoomId ? 'room party' : 'live stream',
    'live',
    'room',
    'user',
    card.isFollowing ? 'following follow' : '',
    card.isFollower ? 'followers follower' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

export function liveFollowFilterLabel(filter: LiveFollowFilter): string {
  if (filter === 'following') return 'Following';
  if (filter === 'followers') return 'Followers';
  return 'All';
}

export function resolveLiveRoomType(
  liveKind: LiveKind,
  roomMode?: string | null,
): RoomModePickerOption {
  const mode = String(roomMode || '').trim();
  if ((ROOM_MODE_OPTIONS as readonly string[]).includes(mode)) {
    return mode as RoomModePickerOption;
  }
  const fromKind = roomModeFromLiveKind(liveKind);
  if ((ROOM_MODE_OPTIONS as readonly string[]).includes(fromKind)) {
    return fromKind as RoomModePickerOption;
  }
  return 'Solo-Live';
}

export function liveTypeFilterLabel(filter: LiveTypeFilter): string {
  if (filter === 'all') return 'All types';
  return formatRoomModeLabel(filter);
}

type LiveFiltersPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typeFilter: LiveTypeFilter;
  onTypeFilterChange: (value: LiveTypeFilter) => void;
  countryFilter: string;
  onCountryFilterChange: (value: string) => void;
  followFilter: LiveFollowFilter;
  onFollowFilterChange: (value: LiveFollowFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  availableCountries: string[];
  /** Left-side heading, e.g. "Live now (6)" */
  title: string;
};

export function LiveFiltersPanel({
  open,
  onOpenChange,
  typeFilter,
  onTypeFilterChange,
  countryFilter,
  onCountryFilterChange,
  followFilter,
  onFollowFilterChange,
  searchQuery,
  onSearchQueryChange,
  availableCountries,
  title,
}: LiveFiltersPanelProps) {
  const [countryQuery, setCountryQuery] = useState('');
  const activeCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (countryFilter !== 'all' ? 1 : 0) +
    (followFilter !== 'all' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  useEffect(() => {
    if (!open) setCountryQuery('');
  }, [open]);

  const liveNowSet = useMemo(
    () => new Set(availableCountries.map((c) => c.trim()).filter(Boolean)),
    [availableCountries],
  );

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    const list = WORLD_COUNTRIES.filter(({ name, iso }) => {
      if (!q) return true;
      return (
        name.toLowerCase().includes(q) ||
        iso.toLowerCase().includes(q) ||
        formatLiveCountryLabel(name).toLowerCase().includes(q)
      );
    });
    // Live-now countries first when not searching, then A–Z.
    return [...list].sort((a, b) => {
      if (!q) {
        const aLive = liveNowSet.has(a.name) ? 0 : 1;
        const bLive = liveNowSet.has(b.name) ? 0 : 1;
        if (aLive !== bLive) return aLive - bLive;
      }
      return a.name.localeCompare(b.name);
    });
  }, [countryQuery, liveNowSet]);

  const clearAll = () => {
    onTypeFilterChange('all');
    onCountryFilterChange('all');
    onFollowFilterChange('all');
    onSearchQueryChange('');
    setCountryQuery('');
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search live, room, user, name, id, country…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-10 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-ring shadow-sm"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => onSearchQueryChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <FilterChip
          active={followFilter === 'all'}
          label="All"
          onClick={() => onFollowFilterChange('all')}
        />
        <FilterChip
          active={followFilter === 'following'}
          label="Following"
          onClick={() => onFollowFilterChange('following')}
        />
        <FilterChip
          active={followFilter === 'followers'}
          label="Followers"
          onClick={() => onFollowFilterChange('followers')}
        />
      </div>

      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0 flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          {activeCount > 0 ? (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
              {activeCount} active
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onOpenChange(!open)}
            aria-expanded={open}
            aria-label="Filter live rooms by type and country"
            className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
              open || activeCount > 0
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground hover:bg-secondary'
            }`}
          >
            <Filter className="h-4 w-4" />
            {activeCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black text-primary-foreground">
                {activeCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {open ? (
        <div className="rounded-2xl border border-border bg-card/80 p-3 shadow-sm space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                People
              </p>
              {followFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => onFollowFilterChange('all')}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                  Reset
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={followFilter === 'all'}
                label="All"
                onClick={() => onFollowFilterChange('all')}
              />
              <FilterChip
                active={followFilter === 'following'}
                label="Following"
                onClick={() => onFollowFilterChange('following')}
              />
              <FilterChip
                active={followFilter === 'followers'}
                label="Followers"
                onClick={() => onFollowFilterChange('followers')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Live / room type
              </p>
              {typeFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => onTypeFilterChange('all')}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                  Reset
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={typeFilter === 'all'}
                label="All"
                onClick={() => onTypeFilterChange('all')}
              />
              {ROOM_MODE_OPTIONS.map((mode) => (
                <FilterChip
                  key={mode}
                  active={typeFilter === mode}
                  label={formatRoomModeLabel(mode)}
                  onClick={() => onTypeFilterChange(mode)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Country
              </p>
              {countryFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    onCountryFilterChange('all');
                    setCountryQuery('');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                  Reset
                </button>
              ) : null}
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={countryQuery}
                onChange={(e) => setCountryQuery(e.target.value)}
                placeholder="Search countries…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-9 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
              />
              {countryQuery ? (
                <button
                  type="button"
                  onClick={() => setCountryQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Clear country search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div
              role="listbox"
              aria-label="Countries"
              className="max-h-56 overflow-y-auto overscroll-contain rounded-xl border border-border bg-background"
            >
              <button
                type="button"
                role="option"
                aria-selected={countryFilter === 'all'}
                onClick={() => onCountryFilterChange('all')}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  countryFilter === 'all'
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-secondary'
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  🌍
                </span>
                <span className="min-w-0 flex-1 truncate">All countries</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {LIVE_COUNTRY_OPTIONS.length}
                </span>
              </button>

              {filteredCountries.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs font-semibold text-muted-foreground">
                  No countries match “{countryQuery.trim()}”
                </p>
              ) : (
                filteredCountries.map(({ name, iso }) => {
                  const selected = countryFilter === name;
                  const isLiveNow = liveNowSet.has(name);
                  return (
                    <button
                      key={iso}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => onCountryFilterChange(name)}
                      className={`flex w-full items-center gap-2.5 border-t border-border/60 px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                        selected
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-secondary'
                      }`}
                    >
                      <span className="text-base leading-none shrink-0" aria-hidden>
                        {countryFlagEmoji(iso)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      {isLiveNow ? (
                        <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-500">
                          Live
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>

            <p className="flex items-center gap-2 px-0.5 text-[12px] font-semibold text-muted-foreground">
              <span className="text-lg leading-none" aria-hidden>
                {countryFilter === 'all' ? '🌍' : countryFlagEmoji(countryFilter)}
              </span>
              <span className="min-w-0 truncate text-foreground font-bold">
                {countryFilter === 'all' ? 'All countries' : countryFilter}
              </span>
              <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wide">
                {filteredCountries.length} / {LIVE_COUNTRY_OPTIONS.length}
              </span>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[11px] font-bold border transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-foreground hover:bg-secondary'
      }`}
    >
      {label}
    </button>
  );
}

/** True when a discovery card matches the active type filter. */
export function matchesLiveTypeFilter(
  filter: LiveTypeFilter,
  liveKind: LiveKind,
  roomMode?: string | null,
): boolean {
  if (filter === 'all') return true;
  return resolveLiveRoomType(liveKind, roomMode) === filter;
}
