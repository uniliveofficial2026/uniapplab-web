import React from 'react';
import {
  Coins,
  Heart,
  MessageCircle,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AdminUserInsights } from '../../lib/adminUserInsights';
import type { LaunchProgress } from '../../lib/dbTypes';

function StatChip({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: 'default' | 'live' | 'warn';
}) {
  const toneClass =
    tone === 'live'
      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
      : tone === 'warn'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
        : 'bg-background border-border text-foreground';

  return (
    <div className={`rounded-xl border px-3 py-2 min-w-0 ${toneClass}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3 h-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-base font-black mt-1 truncate">{value}</div>
    </div>
  );
}

function LaunchProgressRow({ progress }: { progress: LaunchProgress }) {
  const steps = [
    { key: 'Splash', done: progress.hasSeenSplash },
    { key: 'Onboarding', done: progress.hasCompletedOnboarding },
    { key: 'Profile setup', done: progress.profileSetupComplete },
    { key: 'Trending', done: progress.hasSeenTrending },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Launch progress</span>
        <span className="text-xs font-bold">{doneCount}/{steps.length}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {steps.map((step) => (
          <span
            key={step.key}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              step.done ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-secondary/40 text-muted-foreground border-border'
            }`}
          >
            {step.key}
          </span>
        ))}
      </div>
    </div>
  );
}

type AdminUserProgressCardProps = {
  insights: AdminUserInsights;
  compact?: boolean;
};

export function AdminUserProgressCard({ insights, compact = false }: AdminUserProgressCardProps) {
  const { creatorProgress, user, launchProgress } = insights;
  const tier = creatorProgress.tierLabel;
  const level = creatorProgress.level;

  return (
    <div className={`rounded-2xl border border-border overflow-hidden bg-secondary/10 ${compact ? '' : 'space-y-3'}`}>
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black">{user?.displayName ?? insights.userId}</div>
            <div className="text-xs text-muted-foreground">@{user?.username ?? 'user'}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="inline-flex items-center gap-1 text-xs font-black text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              Lv {level} · {tier}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{creatorProgress.xp.toLocaleString()} XP</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
            <span>Creator level</span>
            <span>{creatorProgress.progressPercent}% to Lv {level + 1}</span>
          </div>
          <div className="h-2.5 rounded-full bg-background border border-border overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-violet-500 transition-all"
              style={{ width: `${creatorProgress.progressPercent}%` }}
            />
          </div>
        </div>

        <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
          <StatChip icon={Users} label="Followers" value={insights.followerCount} />
          <StatChip icon={UserPlus} label="Following" value={insights.followingCount} />
          <StatChip icon={Heart} label="Likes received" value={insights.likesReceived} />
          <StatChip icon={UserCheck} label="Comment likes" value={insights.commentLikesGiven} />
          <StatChip icon={TrendingUp} label="Posts" value={insights.postCount} />
          <StatChip icon={TrendingUp} label="Reels" value={insights.reelCount} />
          <StatChip icon={MessageCircle} label="Comments" value={insights.commentsWritten} />
          <StatChip icon={Coins} label="K-Star coins" value={insights.kstarCoins} tone={insights.kstarVip ? 'live' : 'default'} />
        </div>

        {!compact ? <LaunchProgressRow progress={launchProgress} /> : null}

        {user?.status === 'live' ? (
          <div className="text-[10px] font-black uppercase tracking-wide text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            Currently live
          </div>
        ) : null}
        {user?.bannedAt ? (
          <div className="text-[10px] font-black uppercase tracking-wide text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
            Banned · {user.banReason ?? 'no reason'}
          </div>
        ) : null}
      </div>
    </div>
  );
}
