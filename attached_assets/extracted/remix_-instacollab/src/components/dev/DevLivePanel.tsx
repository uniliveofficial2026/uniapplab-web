import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  List,
  RefreshCw,
  TestTube2,
  X,
} from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { ALL_APP_DATA_TASKS, APP_DATA_TASKS, type TaskCategory } from '../../lib/appDataTasks';
import {
  clearDevActivity,
  getDevActivityEntries,
  getDevActivityRevision,
  logDevActivity,
  subscribeDevActivity,
} from '../../lib/devActivity';
import { DEV_CHANGELOG, DEV_PLANNED } from '../../lib/devChangelog';

const PANEL_STORAGE_KEY = 'instacollab_dev_panel_open';

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

type PanelTab = 'live' | 'tasks' | 'changelog' | 'state';

export function DevLivePanel({
  currentTab,
  profileUserId,
}: {
  currentTab: string;
  profileUserId: string | null;
}) {
  const db = useDB();
  const [activityRevision, setActivityRevision] = useState(0);
  const [panelTab, setPanelTab] = useState<PanelTab>('live');
  const [taskQuery, setTaskQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(
    () => subscribeDevActivity(() => setActivityRevision(getDevActivityRevision())),
    []
  );

  const entries = getDevActivityEntries();

  const snapshot = useMemo(() => {
    const me = db.currentUser;
    const meId = me?.id ?? '';
    return {
      tab: currentTab,
      profileUserId,
      activityRevision,
      posts: db.posts?.length ?? 0,
      reels: db.reels?.length ?? 0,
      users: db.users?.length ?? 0,
      storyUsersWithSegments: Object.entries(db.stories ?? {}).filter(
        ([, segs]) => Array.isArray(segs) && segs.length > 0
      ).length,
      me: me
        ? {
            id: me.id,
            username: me.username,
            followers: me.followers,
            following: me.following,
            graphFollowers: db.getFollowerIds(meId).length,
            graphFollowing: db.getFollowingIds(meId).length,
          }
        : null,
    };
  }, [db, currentTab, profileUserId, activityRevision]);

  const filteredTasks = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();
    if (!q) return ALL_APP_DATA_TASKS;
    return ALL_APP_DATA_TASKS.filter(
      (t) =>
        t.action.toLowerCase().includes(q) ||
        t.dbMethod.toLowerCase().includes(q) ||
        t.screens.some((s) => s.toLowerCase().includes(q))
    );
  }, [taskQuery]);

  const runSmokeFollow = () => {
    const others = db.users.filter((u) => u.id !== db.currentUserId);
    const target = others[0];
    if (!target) return;
    const next = db.toggleFollow(target.id);
    logDevActivity(
      'test',
      `toggleFollow(${target.username}) → ${next ? 'following' : 'unfollowed'}`,
      target.id
    );
  };

  const panel = (
    <div
      className={`fixed z-[500] font-sans text-foreground shadow-2xl border border-border bg-card/95 backdrop-blur-md flex flex-col transition-all duration-200 ${
        collapsed
          ? 'bottom-3 right-3 w-auto max-w-[calc(100vw-1.5rem)] rounded-full'
          : 'bottom-3 right-3 left-3 sm:left-auto sm:w-[min(420px,calc(100vw-1.5rem))] max-h-[min(70dvh,560px)] rounded-2xl'
      }`}
    >
      <div
        className={`flex items-center gap-2 shrink-0 border-b border-border ${
          collapsed ? 'px-3 py-2' : 'px-3 py-2.5'
        }`}
      >
        <Activity className="w-4 h-4 text-emerald-500 shrink-0" />
        <span className="font-bold text-sm truncate">Live dev</span>
        {!collapsed && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            DEV
          </span>
        )}
        <div className="flex-1" />
        {!collapsed && (
          <button
            type="button"
            onClick={() => {
              clearDevActivity();
              logDevActivity('note', 'Activity log cleared');
            }}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
            title="Clear log"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(PANEL_STORAGE_KEY, '0');
            window.dispatchEvent(new CustomEvent('dev-panel-close'));
          }}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
          aria-label="Hide panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="flex gap-1 px-2 pt-2 shrink-0 overflow-x-auto no-scrollbar">
            {(
              [
                ['live', 'Live', List],
                ['tasks', 'Tasks', ClipboardList],
                ['changelog', 'Shipped', BookOpen],
                ['state', 'State', TestTube2],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPanelTab(id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                  panelTab === id
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3 text-sm">
            {panelTab === 'live' && (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={runSmokeFollow}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary text-primary-foreground"
                  >
                    Test follow toggle
                  </button>
                  {db.users
                    .filter((u) => u.id !== db.currentUserId)
                    .slice(0, 4)
                    .map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          db.login(u.id);
                          logDevActivity('test', `Switched account → @${u.username}`, u.id);
                        }}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg bg-secondary border border-border"
                        title="Open a second browser tab and switch user there to test DMs / typing"
                      >
                        Switch as @{u.username}
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() =>
                      logDevActivity('test', 'Manual ping', `tab=${currentTab}`)
                    }
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-secondary border border-border"
                  >
                    Ping log
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void db.applyDemoStoryStrip({ resetViews: true }).then((result) => {
                        logDevActivity(
                          'test',
                          'Demo story strip applied',
                          `segments=${result.storyUsers} story=${result.storyOnlyUsers.join(',')} live=${result.liveUsers.join(',')} kinds=${(result.liveKinds ?? []).join(' ')}`
                        );
                      });
                    }}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-secondary border border-border"
                  >
                    Seed demo stories
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Every <code className="text-[11px]">db.save</code> appears here. Console:{' '}
                  <code className="text-[11px]">__devLog(&apos;note&apos;, &apos;msg&apos;)</code>
                </p>
                <ul className="space-y-1.5">
                  {entries.length === 0 ? (
                    <li className="text-muted-foreground text-xs py-6 text-center">
                      Interact with the app — likes, follows, messages — to see live writes.
                    </li>
                  ) : (
                    entries.map((e) => (
                      <li
                        key={e.id}
                        className="rounded-lg bg-secondary/60 px-2.5 py-2 border border-border/50"
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {formatTime(e.at)}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase shrink-0 ${
                              e.kind === 'data'
                                ? 'text-blue-500'
                                : e.kind === 'nav'
                                  ? 'text-violet-500'
                                  : e.kind === 'test'
                                    ? 'text-amber-500'
                                    : 'text-muted-foreground'
                            }`}
                          >
                            {e.kind}
                          </span>
                          <span className="font-medium text-xs leading-snug break-all">
                            {e.message}
                          </span>
                        </div>
                        {e.detail && (
                          <p className="text-[11px] text-muted-foreground mt-1 break-all">
                            {e.detail}
                          </p>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}

            {panelTab === 'tasks' && (
              <div className="space-y-3">
                <input
                  value={taskQuery}
                  onChange={(e) => setTaskQuery(e.target.value)}
                  placeholder="Filter tasks (like, follow, message…)"
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-xs outline-none"
                />
                <p className="text-xs text-muted-foreground">
                  Catalog from <code className="text-[11px]">appDataTasks.ts</code> — extend when
                  you add features.
                </p>
                {(Object.keys(APP_DATA_TASKS) as TaskCategory[]).map((cat) => {
                  const items = APP_DATA_TASKS[cat].filter((t) =>
                    filteredTasks.includes(t)
                  );
                  if (items.length === 0) return null;
                  return (
                    <div key={cat}>
                      <h3 className="text-[11px] font-bold uppercase text-muted-foreground mb-1">
                        {cat}
                      </h3>
                      <ul className="space-y-1">
                        {items.map((t) => (
                          <li
                            key={t.action + t.dbMethod}
                            className="rounded-lg border border-border/60 px-2 py-1.5 bg-secondary/40"
                          >
                            <div className="font-bold text-xs">{t.action}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {t.dbMethod}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {t.screens.join(' · ')}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            {panelTab === 'changelog' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">
                    Planned
                  </h3>
                  <ul className="space-y-2">
                    {DEV_PLANNED.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2"
                      >
                        <div className="font-bold text-xs">{p.title}</div>
                        {p.notes && (
                          <p className="text-[11px] text-muted-foreground mt-1">{p.notes}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">
                    Recently shipped
                  </h3>
                  <ul className="space-y-3">
                    {DEV_CHANGELOG.map((c) => (
                      <li
                        key={c.title + c.date}
                        className="rounded-lg border border-border px-2.5 py-2"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-bold text-xs">{c.title}</span>
                          <span className="text-[10px] text-muted-foreground">{c.date}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{c.summary}</p>
                        {c.testHints && c.testHints.length > 0 && (
                          <ul className="mt-2 space-y-0.5">
                            {c.testHints.map((h) => (
                              <li key={h} className="text-[11px] list-disc list-inside">
                                {h}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {panelTab === 'state' && (
              <pre className="text-[11px] font-mono bg-secondary/80 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(snapshot, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );

  return createPortal(panel, document.body);
}

export function useDevPanelEnabled(): boolean {
  const [open, setOpen] = useState(() => {
    if (!import.meta.env.DEV) return false;
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev') === '1') return true;
    return localStorage.getItem(PANEL_STORAGE_KEY) !== '0';
  });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    logDevActivity('note', 'Live dev panel ready', 'Ctrl+Shift+D to toggle');
    const onClose = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setOpen((v) => {
          const next = !v;
          localStorage.setItem(PANEL_STORAGE_KEY, next ? '1' : '0');
          return next;
        });
      }
    };
    window.addEventListener('dev-panel-close', onClose);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('dev-panel-close', onClose);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return open;
}

export function DevLivePanelHost({
  currentTab,
  profileUserId,
}: {
  currentTab: string;
  profileUserId: string | null;
}) {
  const enabled = useDevPanelEnabled();
  const prevTab = React.useRef(currentTab);

  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return;
    if (prevTab.current !== currentTab) {
      logDevActivity('nav', `tab → ${currentTab}`, profileUserId ? `profile=${profileUserId}` : undefined);
      prevTab.current = currentTab;
    }
  }, [currentTab, profileUserId, enabled]);

  if (!import.meta.env.DEV || !enabled) return null;

  return <DevLivePanel currentTab={currentTab} profileUserId={profileUserId} />;
}
