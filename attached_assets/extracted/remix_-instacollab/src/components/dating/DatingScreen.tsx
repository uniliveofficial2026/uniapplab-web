import React, { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Ban, Heart, Menu, ShieldAlert, Undo2, X } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useDatingCandidates, useDatingLikesYou, useDatingMatches } from '../../lib/useDatingDeck';
import { useToast } from '../../lib/ToastContext';
import { handleAvatarError, openProfilePreview } from '../../lib/utils';

const DatingToolsSheet = lazy(() =>
  import('./DatingToolsSheet').then((m) => ({ default: m.DatingToolsSheet }))
);

export function DatingScreen() {
  const db = useDB();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'discover' | 'likes-you' | 'matches'>('discover');
  const [lastAction, setLastAction] = useState<{ type: 'like' | 'pass'; userId: string; username: string } | null>(null);
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [reportReason, setReportReason] = useState('spam');
  const [toolsOpen, setToolsOpen] = useState(false);

  const candidates = useDatingCandidates(32);
  const matches = useDatingMatches();
  const likesYou = useDatingLikesYou(40);
  const safeIndex =
    candidates.length === 0 ? 0 : Math.min(Math.max(0, index), candidates.length - 1);
  const current = candidates[safeIndex] ?? null;
  const moveNext = () => {
    if (candidates.length === 0) return;
    setIndex((v) => Math.min(v + 1, candidates.length - 1));
  };

  useEffect(() => {
    if (index !== safeIndex) setIndex(safeIndex);
  }, [index, safeIndex]);

  useEffect(() => {
    if (!current?.id) return;
    const profileId = current.id;
    const timer = window.setTimeout(() => {
      db.markDatingExposure(profileId);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [current?.id, db]);

  const onPass = () => {
    if (!current) return;
    db.passDatingProfile(current.id);
    setLastAction({ type: 'pass', userId: current.id, username: current.username });
    showToast(`Passed ${current.username}`);
    moveNext();
  };

  const onLike = () => {
    if (!current) return;
    const result = db.likeDatingProfile(current.id);
    setLastAction({ type: 'like', userId: current.id, username: current.username });
    if (result.matched) showToast(`It's a match with ${current.username}!`);
    else showToast(`Liked ${current.username}`);
    moveNext();
  };

  const undoLast = () => {
    if (!lastAction) return;
    db.undoDatingAction(lastAction.userId);
    setIndex((v) => Math.max(0, v - 1));
    showToast(`Undid ${lastAction.type} for ${lastAction.username}`);
    setLastAction(null);
  };

  const onReset = () => {
    db.clearDatingState();
    setIndex(0);
    setLastAction(null);
  };

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
    } catch {
      showToast('Could not open chat');
    }
  };

  return (
    <div className="w-full max-w-5xl px-4 md:px-6 py-4 md:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Insta Dating</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
            {([
              ['discover', 'Discover'],
              ['likes-you', `Likes You${likesYou.length > 0 ? ` (${likesYou.length})` : ''}`],
              ['matches', `Matches${matches.length > 0 ? ` (${matches.length})` : ''}`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  mode === id ? 'bg-foreground text-background' : 'text-foreground/70 hover:bg-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setToolsOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-secondary transition-colors"
            aria-label="Dating settings and tools"
            title="Settings & tools"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {toolsOpen ? (
        <Suspense fallback={null}>
          <DatingToolsSheet
            onClose={() => setToolsOpen(false)}
            onDeckReset={onReset}
            onPreferencesChange={() => setIndex(0)}
          />
        </Suspense>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="rounded-3xl border border-border bg-card p-4 md:p-6">
          <div className="mx-auto max-w-md">
            {mode !== 'discover' ? (
              <div className="flex h-[560px] flex-col rounded-2xl border border-dashed border-border bg-background p-4">
                <h2 className="mb-3 text-lg font-black">
                  {mode === 'likes-you' ? 'People who liked you' : 'Your matches'}
                </h2>
                <div className="space-y-3 overflow-y-auto no-scrollbar">
                  {(mode === 'likes-you' ? likesYou : matches).length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                      {mode === 'likes-you' ? 'No new likes yet.' : 'No matches yet. Keep swiping.'}
                    </p>
                  ) : mode === 'likes-you' && !db.canRevealDatingLikesYou() ? (
                    <div className="rounded-xl border border-dashed border-border p-4">
                      <p className="text-sm font-semibold">Upgrade to Plus or Gold to reveal who liked you.</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        You currently have {likesYou.length} hidden likes.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {likesYou.slice(0, 6).map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center gap-2 rounded-lg border border-border bg-background p-2"
                          >
                            <div className="h-8 w-8 rounded-full bg-muted blur-[2px]" />
                            <div className="h-3 w-20 rounded bg-muted blur-[2px]" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    (mode === 'likes-you' ? likesYou : matches).map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                      >
                        <button
                          type="button"
                          onClick={() => openProfilePreview(user)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <img
                            src={user.avatarUrl || undefined}
                            alt={user.username}
                            className="h-11 w-11 rounded-full object-cover"
                            onError={handleAvatarError}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{user.displayName}</p>
                            <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                        </button>
                        {mode === 'likes-you' ? (
                          <button
                            type="button"
                            onClick={() => {
                              const result = db.likeDatingProfile(user.id);
                              if (result.matched) showToast(`Matched with ${user.username}!`);
                              else showToast(`Liked ${user.username}`);
                            }}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                          >
                            Like back
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openMatchChat(user.id, user.username)}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                          >
                            Message
                          </button>
                        )}
                        {mode === 'matches' ? (
                          <>
                            <div className="shrink-0 text-right text-[10px] text-muted-foreground">
                              {(() => {
                                const meta = db.getDatingMatchMeta(user.id);
                                const lastSeen = db.chatPresence[user.id]?.lastSeenAt ?? 0;
                                const peerRead = db.chatPeerReadState[user.id] ?? 0;
                                const expiresIn = meta
                                  ? Math.max(
                                      0,
                                      Math.floor((meta.expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
                                    )
                                  : null;
                                return (
                                  <>
                                    <p>
                                      {db.chatPresence[user.id]?.online
                                        ? 'Online'
                                        : lastSeen > 0
                                          ? `Seen ${Math.max(1, Math.floor((Date.now() - lastSeen) / (1000 * 60 * 60)))}h`
                                          : 'Offline'}
                                    </p>
                                    <p>{peerRead > 0 ? 'Read receipts on' : 'Unread chat'}</p>
                                    {expiresIn !== null ? <p>{expiresIn}d left</p> : null}
                                  </>
                                );
                              })()}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                db.unmatchDatingProfile(user.id);
                                showToast(`Unmatched ${user.username}`);
                              }}
                              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                            >
                              Unmatch
                            </button>
                          </>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : !current ? (
              <div className="flex h-[560px] items-center justify-center rounded-2xl border border-dashed border-border bg-background text-center">
                <div>
                  <p className="text-lg font-bold">No more profiles for now</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open settings to adjust filters or reset the deck.
                  </p>
                  <button
                    type="button"
                    onClick={() => setToolsOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary"
                  >
                    <Menu className="h-4 w-4" />
                    Dating tools
                  </button>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDrag={(e, info) => setDragX(info.offset.x)}
                  onDragEnd={(e, info) => {
                    setDragX(0);
                    if (info.offset.x <= -120) onPass();
                    if (info.offset.x >= 120) onLike();
                  }}
                  initial={{ opacity: 0, scale: 0.97, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: -12 }}
                  transition={{ duration: 0.18 }}
                  className="relative h-[560px] overflow-hidden rounded-2xl border border-border bg-background"
                  style={{ rotate: dragX * 0.02 }}
                >
                  <img
                    src={current.avatarUrl || undefined}
                    alt={current.username}
                    className="h-full w-full object-cover"
                    onError={handleAvatarError}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                    <button
                      type="button"
                      onClick={() => openProfilePreview(current)}
                      className="text-left"
                    >
                      <p className="text-2xl font-black leading-tight hover:underline">
                        {current.displayName}
                      </p>
                      <p className="text-sm text-white/90">@{current.username}</p>
                    </button>
                    <p className="mt-2 text-sm text-white/90">
                      {current.bio || 'Creator, collaborator, and open to meaningful connections.'}
                    </p>
                    {db.datingState.profile.prompts.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {db.datingState.profile.prompts.slice(0, 2).map((item, idx) => (
                          <p key={`${item.question}-${idx}`} className="text-xs text-white/80">
                            {item.question}: {item.answer}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div
                    className="absolute top-4 left-4 rounded-lg border-2 border-red-500 bg-black/40 px-3 py-1 text-red-400"
                    style={{ opacity: Math.max(0, -dragX / 110) }}
                  >
                    <X className="h-4 w-4" />
                  </div>
                  <div
                    className="absolute top-4 right-4 rounded-lg border-2 border-emerald-500 bg-black/40 px-3 py-1 text-emerald-300"
                    style={{ opacity: Math.max(0, dragX / 110) }}
                  >
                    <Heart className="h-4 w-4" />
                  </div>
                </motion.div>
              </AnimatePresence>
            )}

            {mode === 'discover' ? (
              <div className="mt-4 grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={undoLast}
                  disabled={!lastAction}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-2 py-3 font-bold hover:bg-secondary disabled:opacity-50"
                  title="Undo last action"
                >
                  <Undo2 className="h-5 w-5 text-amber-500" />
                </button>
                <button
                  type="button"
                  onClick={onPass}
                  disabled={!current}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-3 font-bold hover:bg-secondary disabled:opacity-50"
                  title="Pass"
                >
                  <X className="h-5 w-5 text-red-500" />
                </button>
                <button
                  type="button"
                  onClick={onLike}
                  disabled={!current}
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  title="Like"
                >
                  <Heart className="h-5 w-5" />
                </button>
              </div>
            ) : null}
            {mode === 'discover' && current ? (
              <div className="mt-3 rounded-xl border border-border bg-background p-3">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  <p className="text-xs font-bold">Safety</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
                  >
                    <option value="spam">Spam</option>
                    <option value="fake">Fake profile</option>
                    <option value="abuse">Abusive behavior</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const result = db.reportDatingProfile(current.id, reportReason);
                      if (result.ok) {
                        showToast(`Reported ${current.username}`);
                        moveNext();
                      }
                    }}
                    aria-label="Report profile"
                    title="Report"
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-2 text-xs font-bold hover:bg-secondary"
                  >
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      db.blockUser(current.id);
                      showToast(`Blocked ${current.username}`);
                      moveNext();
                    }}
                    aria-label="Block user"
                    title="Block"
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-2 text-xs font-bold hover:bg-secondary"
                  >
                    <Ban className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Matches</h2>
            <span className="text-xs font-semibold text-muted-foreground">{matches.length}</span>
          </div>
          <div className="max-h-[580px] space-y-3 overflow-y-auto no-scrollbar">
            {matches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No matches yet. Keep swiping.
              </p>
            ) : (
              matches.map((user) => (
                <div
                  key={user.id}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-3 text-left"
                >
                  <button
                    type="button"
                    onClick={() => openProfilePreview(user)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-80"
                  >
                    <img
                      src={user.avatarUrl || undefined}
                      alt={user.username}
                      className="h-11 w-11 rounded-full object-cover"
                      onError={handleAvatarError}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{user.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openMatchChat(user.id, user.username)}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
                    aria-label="Message"
                    title="Message"
                  >
                    Message
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
