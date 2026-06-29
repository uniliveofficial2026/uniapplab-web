import React, { lazy, Suspense, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Coffee,
  Crown,
  Flame,
  HeartHandshake,
  LayoutDashboard,
  RotateCcw,
  Star,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import type { LocalDB } from '../../lib/db/localDbType';
import { useDB, useDbRevision } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import { handleAvatarError, openProfilePreview } from '../../lib/utils';
import { HorizontalScrollRail } from './HorizontalScrollRail';

const DATING_TIERS = [
  { id: 'free' as const, label: 'Free', Icon: User },
  { id: 'plus' as const, label: 'Plus', Icon: Star },
  { id: 'gold' as const, label: 'Gold', Icon: Crown },
];

const DATING_INTENTS = [
  { id: 'serious', label: 'Serious', Icon: HeartHandshake },
  { id: 'casual', label: 'Casual', Icon: Coffee },
  { id: 'friends', label: 'Friends', Icon: Users },
  { id: 'networking', label: 'Networking', Icon: Briefcase },
];

const DatingExperimentPanel = lazy(() =>
  import('./DatingExperimentPanel').then((m) => ({ default: m.DatingExperimentPanel }))
);

type DatingToolsSheetProps = {
  onClose: () => void;
  onDeckReset: () => void;
  onPreferencesChange: () => void;
};

export function DatingToolsSheet({ onClose, onDeckReset, onPreferencesChange }: DatingToolsSheetProps) {
  const db = useDB();
  const revision = useDbRevision();
  const { showToast } = useToast();
  const [boostActive, setBoostActive] = useState(false);
  const [showExperimentPanel, setShowExperimentPanel] = useState(false);
  const [promptOne, setPromptOne] = useState('');
  const [promptOneAnswer, setPromptOneAnswer] = useState('');
  const [promptTwo, setPromptTwo] = useState('');
  const [promptTwoAnswer, setPromptTwoAnswer] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');

  const topPicks = useMemo(() => {
    try {
      return db.getDatingTopPicks(6);
    } catch {
      return [];
    }
  }, [revision]);

  const nudges = useMemo(() => {
    try {
      return db.getDatingReengagementNudges(4);
    } catch {
      return [];
    }
  }, [revision]);

  const superLikeLimit =
    db.datingState.subscription.tier === 'gold' ? 10 : db.datingState.subscription.tier === 'plus' ? 7 : 5;
  const superLikesRemaining = Math.max(0, superLikeLimit - db.datingState.usage.superLikesUsed);

  const myDatingCompleteness = useMemo(() => {
    try {
      return db.getDatingProfileCompleteness();
    } catch {
      return 0;
    }
  }, [revision]);

  const openMatchChat = (userId: string, username: string) => {
    const meId = db.currentUserId;
    if (!meId || !userId) {
      showToast('Sign in to message matches');
      return;
    }
    try {
      const thread = Array.isArray(db.messages[userId]) ? db.messages[userId] : [];
      if (thread.length === 0) {
        const starter =
          db.getDatingConversationStarter(userId) ||
          `Hey @${username || 'there'}, glad we matched! ✨`;
        db.addMessage(userId, {
          text: starter,
          from: meId,
          isAuthor: true,
          timestamp: Date.now(),
        });
      }
      db.touchDatingMatchActivity(userId);
      window.dispatchEvent(
        new CustomEvent('navigate', {
          detail: { tab: 'messages', chatId: userId },
        })
      );
      onClose();
    } catch {
      showToast('Could not open chat');
    }
  };

  const bumpPreferences = () => {
    onPreferencesChange();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-background animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Dating settings and tools"
    >
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card hover:bg-secondary transition-colors"
          aria-label="Back to dating"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="flex-1 text-lg font-black tracking-tight">Dating tools</h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card hover:bg-secondary transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 md:px-6 max-w-3xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-3">
          <label className="text-xs font-semibold text-muted-foreground">
            Distance ({db.datingState.preferences.maxDistanceKm} km)
            <input
              type="range"
              min={5}
              max={150}
              value={db.datingState.preferences.maxDistanceKm}
              onChange={(e) => {
                db.setDatingPreferences({ maxDistanceKm: Number(e.target.value) });
                bumpPreferences();
              }}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Min Age ({db.datingState.preferences.minAge})
            <input
              type="range"
              min={18}
              max={45}
              value={db.datingState.preferences.minAge}
              onChange={(e) => {
                const next = Number(e.target.value);
                db.setDatingPreferences({
                  minAge: next <= db.datingState.preferences.maxAge ? next : db.datingState.preferences.maxAge,
                });
                bumpPreferences();
              }}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Max Age ({db.datingState.preferences.maxAge})
            <input
              type="range"
              min={18}
              max={55}
              value={db.datingState.preferences.maxAge}
              onChange={(e) => {
                const next = Number(e.target.value);
                db.setDatingPreferences({
                  maxAge: next >= db.datingState.preferences.minAge ? next : db.datingState.preferences.minAge,
                });
                bumpPreferences();
              }}
              className="mt-2 w-full"
            />
          </label>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subscription tier
            </p>
            <div className="flex flex-wrap gap-2">
              {DATING_TIERS.map(({ id, label, Icon }) => {
                const active = db.datingState.subscription.tier === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      db.setDatingSubscriptionTier(id);
                      showToast(`Switched to ${label} tier`);
                    }}
                    aria-label={`${label} tier`}
                    aria-pressed={active}
                    className={`inline-flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl border px-3 py-2 transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-secondary'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Looking for
            </p>
            <div className="flex flex-wrap gap-2">
              {DATING_INTENTS.map(({ id, label, Icon }) => {
                const active = db.datingState.preferences.intents.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      const currentIntents = db.datingState.preferences.intents;
                      db.setDatingPreferences({
                        intents: active
                          ? currentIntents.filter((item) => item !== id)
                          : [...currentIntents, id],
                      });
                      bumpPreferences();
                    }}
                    aria-label={label}
                    aria-pressed={active}
                    className={`inline-flex min-w-[4.75rem] flex-col items-center gap-1 rounded-xl border px-3 py-2 transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-secondary'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="text-[10px] font-bold">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-xs font-semibold text-muted-foreground">
              Super Likes: {superLikesRemaining}/{superLikeLimit}
            </span>
            <button
              type="button"
              onClick={() => {
                setBoostActive((v) => !v);
                showToast(!boostActive ? 'Profile boost active for 30 minutes' : 'Profile boost ended');
              }}
              aria-label={boostActive ? 'Boost on' : 'Boost profile'}
              aria-pressed={boostActive}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                boostActive
                  ? 'border-orange-400 bg-orange-500/15 text-orange-600'
                  : 'border-border bg-background hover:bg-secondary'
              }`}
            >
              <Flame className="h-4 w-4" aria-hidden />
              {boostActive ? 'Boost on' : 'Boost'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <button
            type="button"
            onClick={() => setShowExperimentPanel((open) => !open)}
            className="flex w-full items-center justify-between rounded-xl px-2 py-1 text-left text-sm font-bold hover:bg-secondary transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Experiment dashboard
            </span>
            <span className="text-xs text-muted-foreground">{showExperimentPanel ? 'Hide' : 'Show'}</span>
          </button>
          {showExperimentPanel ? (
            <Suspense fallback={<p className="mt-3 text-xs text-muted-foreground">Loading experiment tools…</p>}>
              <div className="mt-3">
                <DatingExperimentPanel db={db as LocalDB} showToast={showToast} />
              </div>
            </Suspense>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground">Profile completeness</span>
            <span className="font-bold">{myDatingCompleteness}%</span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${myDatingCompleteness}%` }}
            />
          </div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-black tracking-wide">Dating Profile Builder</h3>
            <button
              type="button"
              onClick={() => {
                db.updateDatingProfile({ verified: !db.datingState.profile.verified });
                showToast(
                  db.datingState.profile.verified
                    ? 'Verification badge removed'
                    : 'Verification badge enabled'
                );
              }}
              aria-label={db.datingState.profile.verified ? 'Verified' : 'Set Verified'}
              title={db.datingState.profile.verified ? 'Verified' : 'Set Verified'}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2 py-1 hover:bg-secondary"
            >
              <CheckCircle2
                className={`h-4 w-4 ${db.datingState.profile.verified ? 'text-primary' : 'text-muted-foreground'}`}
              />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              value={promptOne}
              onChange={(e) => setPromptOne(e.target.value)}
              placeholder="Prompt 1 question"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={promptOneAnswer}
              onChange={(e) => setPromptOneAnswer(e.target.value)}
              placeholder="Prompt 1 answer"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={promptTwo}
              onChange={(e) => setPromptTwo(e.target.value)}
              placeholder="Prompt 2 question"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={promptTwoAnswer}
              onChange={(e) => setPromptTwoAnswer(e.target.value)}
              placeholder="Prompt 2 answer"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Media URL"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm md:col-span-2"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const prompts = [
                  { question: promptOne.trim(), answer: promptOneAnswer.trim() },
                  { question: promptTwo.trim(), answer: promptTwoAnswer.trim() },
                ].filter((item) => item.question.length > 0 && item.answer.length > 0);
                const media =
                  mediaUrl.trim().length > 0
                    ? [...db.datingState.profile.mediaUrls, mediaUrl.trim()].slice(0, 6)
                    : db.datingState.profile.mediaUrls;
                db.updateDatingProfile({ prompts, mediaUrls: media });
                showToast('Dating profile updated');
              }}
              aria-label="Save profile"
              title="Save profile"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-primary-foreground"
            >
              <Upload className="h-4 w-4" />
            </button>
            <span className="self-center text-xs text-muted-foreground">
              Prompts: {db.datingState.profile.prompts.length}/3 · Media:{' '}
              {db.datingState.profile.mediaUrls.length}/6
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black tracking-wide">Top Picks</h3>
            <span className="text-xs text-muted-foreground">{topPicks.length}</span>
          </div>
          {topPicks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No top picks available right now.</p>
          ) : (
            <HorizontalScrollRail ariaLabel="Top picks" scrollStep={190}>
              {topPicks.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => openProfilePreview(user)}
                  className="flex min-w-[170px] shrink-0 items-center gap-3 rounded-xl border border-border bg-background p-3 text-left"
                >
                  <img
                    src={user.avatarUrl || undefined}
                    alt={user.username}
                    className="h-9 w-9 rounded-full object-cover"
                    onError={handleAvatarError}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{user.displayName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">@{user.username}</p>
                  </div>
                </button>
              ))}
            </HorizontalScrollRail>
          )}
        </div>

        {nudges.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-black tracking-wide">Re-engage Matches</h3>
              <span className="text-xs text-muted-foreground">{nudges.length}</span>
            </div>
            <div className="space-y-2">
              {nudges.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-2.5"
                >
                  <img
                    src={user.avatarUrl || undefined}
                    alt={user.username}
                    className="h-9 w-9 rounded-full object-cover"
                    onError={handleAvatarError}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{user.displayName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      It has been a while - send a ping.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openMatchChat(user.id, user.username)}
                    className="rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground"
                  >
                    Nudge
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            onDeckReset();
            showToast('Dating deck reset');
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold hover:bg-secondary transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Reset deck
        </button>
      </div>
    </div>
  );
}
