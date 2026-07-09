import React, { useMemo, useState } from 'react';
import { Crown, Globe, Medal, Radio, TrendingUp, Users } from 'lucide-react';
import {
  buildAdminLeaderboard,
  listAdminLeaderboardCountries,
  type AdminLeaderboardMetric,
  type AdminLeaderboardRow,
} from '../../lib/adminLeaderboard';
import { useDB, useDbRevision } from '../../lib/useDB';
import { safeAvatarUrl } from '../../lib/safe';
import { handleAvatarError } from '../../lib/utils';
import { countryFlagEmoji, formatLiveCountryLabel } from '../live/liveCountries';
import { AdminUserProgressCard } from './AdminUserProgressCard';
import { buildAdminUserInsights } from '../../lib/adminUserInsights';

const METRICS: Array<{ id: AdminLeaderboardMetric; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'rank', label: 'Overall rank', icon: Crown },
  { id: 'xp', label: 'Creator XP', icon: TrendingUp },
  { id: 'level', label: 'Level', icon: Crown },
  { id: 'followers', label: 'Followers', icon: Users },
  { id: 'likes', label: 'Likes', icon: Medal },
  { id: 'gifts', label: 'K-Star gifts', icon: Medal },
];

function rankTone(rank: number): string {
  if (rank === 1) return 'text-amber-500';
  if (rank === 2) return 'text-zinc-400';
  if (rank === 3) return 'text-orange-400';
  return 'text-muted-foreground';
}

export function AdminLeaderboardPanel() {
  const db = useDB();
  useDbRevision();
  const [metric, setMetric] = useState<AdminLeaderboardMetric>('rank');
  const [countryFilter, setCountryFilter] = useState('all');
  const [selected, setSelected] = useState<AdminLeaderboardRow | null>(null);

  const countries = useMemo(() => listAdminLeaderboardCountries(db), [db]);
  const rows = useMemo(
    () => buildAdminLeaderboard(db, { countryFilter, metric, limit: 50 }),
    [db, countryFilter, metric],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex flex-wrap gap-2 flex-1">
          {METRICS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMetric(item.id)}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl min-h-[40px] ${
                  metric === item.id ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {item.label}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-xs font-bold min-w-[220px]">
          <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="flex-1 border border-border rounded-xl px-3 py-2 bg-background min-h-[40px] text-sm"
          >
            <option value="all">All countries</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {formatLiveCountryLabel(country)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border bg-secondary/10 flex items-center justify-between gap-2">
          <div className="text-sm font-black">
            {countryFilter === 'all' ? 'Global rank' : `${formatLiveCountryLabel(countryFilter)} rank`} · {METRICS.find((m) => m.id === metric)?.label}
          </div>
          <div className="text-[11px] text-muted-foreground">{rows.length} users{countryFilter !== 'all' ? ` · ${formatLiveCountryLabel(countryFilter)}` : ''}</div>
        </div>

        <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No users for this country filter.</p>
          ) : (
            rows.map((row) => (
              <button
                key={row.userId}
                type="button"
                onClick={() => setSelected(row)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/20 min-h-[64px]"
              >
                <span className={`w-8 text-center font-black text-lg shrink-0 ${rankTone(row.rank)}`}>{row.rank}</span>
                <img
                  src={safeAvatarUrl(row.user.avatarUrl)}
                  alt=""
                  className="w-11 h-11 rounded-full object-cover border border-border shrink-0"
                  onError={handleAvatarError}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm truncate flex items-center gap-2">
                    {row.user.displayName}
                    {row.isLive ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                        <Radio className="w-3 h-3" /> Live
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{row.user.username} · Lv {row.level} {row.tierLabel} · {countryFlagEmoji(row.country)} {row.country}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-black">{formatMetricScore(row, metric)}</div>
                  <div className="text-[10px] text-muted-foreground">{row.followers} followers</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {selected ? (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-black">#{selected.rank} · {selected.user.displayName}</div>
              <div className="text-xs text-muted-foreground">@{selected.user.username} · {formatLiveCountryLabel(selected.country)}</div>
            </div>
            <button type="button" className="text-xs font-bold px-3 py-2 rounded-xl border border-border" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <AdminUserProgressCard insights={buildAdminUserInsights(db, selected.userId)} />
        </div>
      ) : null}
    </div>
  );
}

function formatMetricScore(row: AdminLeaderboardRow, metric: AdminLeaderboardMetric): string {
  if (metric === 'rank') return `#${row.rank}`;
  if (metric === 'followers') return row.followers.toLocaleString();
  if (metric === 'likes') return row.likesReceived.toLocaleString();
  if (metric === 'gifts') return row.kstarCoins.toLocaleString();
  if (metric === 'level') return `Lv ${row.level}`;
  return row.xp.toLocaleString();
}
