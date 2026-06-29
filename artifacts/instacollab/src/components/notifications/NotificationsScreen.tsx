import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDB, useDbRevision } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import {
  Heart,
  UserPlus,
  MessageCircle,
  AlertCircle,
  ShoppingBag,
  AtSign,
  Mail,
  Search,
  X,
  ListTodo,
  Activity,
  Radio,
} from 'lucide-react';
import { handleAvatarError, handleMediaError, openProfilePreview } from '../../lib/utils';
import { resolveUser, safeUserId } from '../../lib/safe';
import { motion, AnimatePresence } from 'motion/react';
import {
  formatNotificationTime,
  liveNotificationKindLabel,
  matchesNotificationFeedTab,
  NOTIFICATION_TYPE_FILTER_ORDER,
  notificationSearchHaystack,
  notificationTypeFilterLabel,
  type NotificationFeedTab,
  type NotificationTypeFilter,
} from '../../lib/notifications';
import type { AppNotification, AppNotificationType } from '../../types';
import { PostModal } from '../feed/PostModal';

const TYPE_FILTER_ICONS: Partial<
  Record<AppNotificationType, React.ComponentType<{ className?: string }>>
> = {
  follow: UserPlus,
  follow_request: UserPlus,
  like: Heart,
  comment: MessageCircle,
  mention: AtSign,
  message: Mail,
  order: ShoppingBag,
  system: AlertCircle,
  task: ListTodo,
  activity: Activity,
  live: Radio,
};

const FEED_TABS: { id: NotificationFeedTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'live', label: 'Live' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'activity', label: 'Activity' },
];

function FilterPill({
  label,
  count,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-secondary/80 text-foreground/75 hover:bg-secondary hover:text-foreground'
      }`}
    >
      {Icon ? <Icon className="w-3 h-3 shrink-0" /> : null}
      {label}
      {count != null && count > 0 ? (
        <span className={active ? 'text-primary/80' : 'text-foreground/45'}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function NotificationsScreen({ embedded = false }: { embedded?: boolean }) {
  const db = useDB();
  const { showToast } = useToast();
  useDbRevision();
  const USERS = db.users;

  const [activeTab, setActiveTab] = useState<NotificationFeedTab>('all');
  const [query, setQuery] = useState('');
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  const [typeFilter, setTypeFilter] = useState<NotificationTypeFilter>('all');
  const [now, setNow] = useState(() => Date.now());
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const searchMenuRef = useRef<HTMLDivElement>(null);
  const typeFilterScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    db.markAllNotificationsRead();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setTypeFilter('all');
  }, [activeTab]);

  useEffect(() => {
    if (!showSearchMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (searchMenuRef.current && target && !searchMenuRef.current.contains(target)) {
        setShowSearchMenu(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showSearchMenu]);

  const toggleFollow = (user: { id?: string; isFollowing?: boolean }) => {
    const id = safeUserId(user?.id);
    if (!id) return;
    db.toggleFollow(id);
  };

  const notifications = db.notifications;

  const tabbed = useMemo(() => {
    return notifications.filter((n) => matchesNotificationFeedTab(n, activeTab));
  }, [notifications, activeTab]);

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<NotificationTypeFilter, number>> = {
      all: tabbed.length,
    };
    for (const n of tabbed) {
      counts[n.type] = (counts[n.type] ?? 0) + 1;
    }
    return counts;
  }, [tabbed]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tabbed.filter((notification) => {
      if (typeFilter !== 'all' && notification.type !== typeFilter) return false;
      if (!q) return true;
      const actor = notification.user
        ? resolveUser(USERS, notification.user)
        : notification.actorUserId
          ? resolveUser(USERS, { id: notification.actorUserId })
          : null;
      return notificationSearchHaystack(notification, actor).includes(q);
    });
  }, [tabbed, query, typeFilter, USERS]);

  const hasActiveFilters =
    typeFilter !== 'all' || query.trim().length > 0;

  const clearFilters = () => {
    setQuery('');
    setTypeFilter('all');
  };

  const scrollTypeFilters = (direction: 'left' | 'right') => {
    const el = typeFilterScrollRef.current;
    if (!el) return;
    const amount = Math.max(220, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  const summaryLabel =
    hasActiveFilters && visible.length !== tabbed.length
      ? `Showing ${visible.length.toLocaleString()} of ${tabbed.length.toLocaleString()}`
      : `${tabbed.length.toLocaleString()} ${
          tabbed.length === 1 ? 'notification' : 'notifications'
        }`;

  const handleRowClick = (notification: AppNotification) => {
    db.markNotificationRead(notification.id);
    if (notification.type === 'live' || notification.targetTab === 'live') {
      const hostId =
        safeUserId(notification.link?.replace(/^live:/, '')) ??
        safeUserId(notification.actorUserId);
      window.dispatchEvent(
        new CustomEvent('navigate', {
          detail: { tab: 'live', ...(hostId ? { userId: hostId } : {}) },
        })
      );
      return;
    }
    if (
      notification.type === 'task' ||
      notification.type === 'activity' ||
      notification.targetTab === 'workspace'
    ) {
      window.dispatchEvent(
        new CustomEvent('navigate', { detail: { tab: 'workspace' } })
      );
      return;
    }
    if (notification.type === 'message' || notification.targetTab === 'messages') {
      const chatId = safeUserId(notification.actorUserId);
      if (chatId) {
        window.dispatchEvent(
          new CustomEvent('navigate', { detail: { tab: 'messages', chatId } })
        );
      }
      return;
    }
    if (notification.postId) {
      setSelectedPostId(notification.postId);
      return;
    }
    const actor = notification.user
      ? resolveUser(USERS, notification.user)
      : notification.actorUserId
        ? resolveUser(USERS, { id: notification.actorUserId })
        : null;
    if (actor) openProfilePreview(actor);
  };

  const renderIconBadge = (type: AppNotification['type']) => {
    switch (type) {
      case 'like':
        return (
          <div className="absolute -bottom-1 -right-1 bg-accent rounded-full p-1 border-2 border-background shadow-xs">
            <Heart className="w-3 h-3 fill-white stroke-white" />
          </div>
        );
      case 'follow':
      case 'follow_request':
        return (
          <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1 border-2 border-background shadow-xs">
            <UserPlus className="w-3 h-3 fill-white stroke-white" />
          </div>
        );
      case 'comment':
      case 'mention':
        return (
          <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-background shadow-xs">
            {type === 'mention' ? (
              <AtSign className="w-3 h-3 text-white" />
            ) : (
              <MessageCircle className="w-3 h-3 fill-white stroke-white" />
            )}
          </div>
        );
      case 'message':
        return (
          <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1 border-2 border-background shadow-xs">
            <Mail className="w-3 h-3 text-white" />
          </div>
        );
      case 'task':
        return (
          <div className="absolute -bottom-1 -right-1 bg-violet-500 rounded-full p-1 border-2 border-background shadow-xs">
            <ListTodo className="w-3 h-3 text-white" />
          </div>
        );
      case 'activity':
        return (
          <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 border-2 border-background shadow-xs">
            <Activity className="w-3 h-3 text-white" />
          </div>
        );
      case 'live':
        return (
          <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1 border-2 border-background shadow-xs">
            <Radio className="w-3 h-3 text-white" />
          </div>
        );
      default:
        return null;
    }
  };

  const emptyCopy = (() => {
    if (hasActiveFilters && tabbed.length > 0) {
      return {
        title: 'No matches',
        hint: 'Try a different search or reset filters.',
      };
    }
    switch (activeTab) {
      case 'mentions':
        return {
          title: 'No mentions yet',
          hint: 'When someone @mentions you in a comment or message, it will show up here.',
        };
      case 'tasks':
        return {
          title: 'No task notifications',
          hint: 'Assignments, updates, and completions from Workspace will appear here.',
        };
      case 'activity':
        return {
          title: 'No activity yet',
          hint: 'Audit log entries, file uploads, reactions, and team updates land here.',
        };
      case 'live':
        return {
          title: 'No live updates',
          hint: 'When someone you follow goes live or joins your stream, it shows up here.',
        };
      default:
        return {
          title: 'You are all caught up',
          hint: 'Social, workspace, and commerce updates will appear when something happens.',
        };
    }
  })();

  const hasSearchQuery = query.trim().length > 0;

  return (
    <div
      data-embedded={embedded ? 'true' : 'false'}
      className={
        embedded
          ? 'w-full h-full flex flex-col overflow-y-auto overflow-x-hidden min-h-0 px-4 py-4'
          : 'w-full flex flex-col pt-6 md:pt-10 px-4 md:px-0 max-w-[600px] mx-auto pb-6 min-h-0'
      }
    >
      <div className="flex items-center justify-between gap-3 mb-4 px-2">
        {!embedded ? (
          <h1 className="text-3xl font-bold min-w-0 truncate">Notifications</h1>
        ) : (
          <div className="min-w-0" aria-hidden />
        )}
        <div className="relative shrink-0" ref={searchMenuRef}>
          <button
            type="button"
            onClick={() => setShowSearchMenu((prev) => !prev)}
            className={`relative p-2.5 rounded-full transition-colors ${
              showSearchMenu || hasSearchQuery
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-secondary text-foreground/80 hover:text-foreground'
            }`}
            aria-label="Search notifications"
            aria-expanded={showSearchMenu}
            aria-haspopup="dialog"
          >
            <Search className="w-5 h-5" />
            {hasSearchQuery ? (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
            ) : null}
          </button>
          <AnimatePresence>
            {showSearchMenu ? (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full z-30 mt-2 w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-border bg-background shadow-lg p-3"
                role="dialog"
                aria-label="Search notifications"
              >
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name or message"
                      autoFocus
                      className="w-full rounded-lg border border-border bg-secondary py-2 pl-9 pr-8 text-sm text-foreground outline-none placeholder:text-foreground/45 focus:border-ring transition-colors"
                    />
                    {hasSearchQuery ? (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        aria-label="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
                  Matches usernames, messages, order IDs, and notification types.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex gap-2 mb-4 px-2 overflow-x-auto no-scrollbar">
        {FEED_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full font-bold text-sm transition-colors ${activeTab === tab.id ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-2 mb-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground font-medium min-w-0">
            {summaryLabel}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground/70 hover:bg-secondary hover:text-foreground transition-colors"
            >
              Reset
            </button>
          ) : null}
        </div>

        {tabbed.length > 0 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollTypeFilters('left')}
              className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-foreground hover:bg-secondary transition-colors"
              aria-label="Scroll filters left"
              title="Scroll left"
            >
              ←
            </button>
            <div ref={typeFilterScrollRef} className="flex flex-1 gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <FilterPill
                label="All types"
                count={typeCounts.all}
                active={typeFilter === 'all'}
                onClick={() => setTypeFilter('all')}
              />
              {NOTIFICATION_TYPE_FILTER_ORDER.map((type) => {
                const count = typeCounts[type] ?? 0;
                if (count <= 0) return null;
                return (
                  <FilterPill
                    key={type}
                    label={notificationTypeFilterLabel(type)}
                    count={count}
                    active={typeFilter === type}
                    onClick={() =>
                      setTypeFilter((prev) => (prev === type ? 'all' : type))
                    }
                    icon={TYPE_FILTER_ICONS[type]}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => scrollTypeFilters('right')}
              className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-foreground hover:bg-secondary transition-colors"
              aria-label="Scroll filters right"
              title="Scroll right"
            >
              →
            </button>
          </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">{emptyCopy.title}</p>
          <p className="text-sm">{emptyCopy.hint}</p>
          {hasActiveFilters && tabbed.length > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-secondary transition-colors"
            >
              Reset filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {visible.map((notification, idx) => {
              const notificationUser = notification.user
                ? resolveUser(USERS, notification.user)
                : notification.actorUserId
                  ? resolveUser(USERS, { id: notification.actorUserId })
                  : null;
              const isSystemLike =
                notification.type === 'system' ||
                notification.type === 'order' ||
                ((notification.type === 'task' || notification.type === 'activity') &&
                  !notificationUser);
              const timeLabel = formatNotificationTime(
                notification.createdAt,
                now
              );
              const actionText = (() => {
                if (isSystemLike) {
                  return notification.text ?? notification.title ?? '';
                }
                switch (notification.type) {
                  case 'follow':
                    return notification.text?.trim()
                      ? notification.text.endsWith('.')
                        ? notification.text
                        : `${notification.text}.`
                      : 'started following you.';
                  case 'follow_request':
                    return 'requested to follow you.';
                  case 'like':
                    if (notification.text) {
                      const t = notification.text.trim();
                      return t.endsWith('.') ? t : `${t}.`;
                    }
                    return notification.reelId
                      ? 'liked your reel.'
                      : 'liked your post.';
                  case 'comment':
                    return notification.text?.startsWith('replied:')
                      ? notification.text
                      : `commented: ${notification.text ?? ''}`.trim();
                  case 'mention':
                    return notification.text ?? 'mentioned you.';
                  case 'message':
                    return notification.text?.startsWith('Shared')
                      ? notification.text
                      : `messaged you: ${notification.text ?? ''}`.trim();
                  case 'task':
                    return notification.text ?? 'updated a workspace task';
                  case 'activity':
                    return notification.text ?? 'workspace activity';
                  case 'live':
                    return (
                      notification.text ??
                      `${liveNotificationKindLabel(notification.liveKind)} live update`
                    );
                  default:
                    return notification.text ?? '';
                }
              })();

              return (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.2) }}
                  key={notification.id}
                  onClick={() => handleRowClick(notification)}
                  className={`flex items-center gap-4 p-3 rounded-2xl transition-colors cursor-pointer ${
                    notification.read
                      ? 'hover:bg-secondary/30'
                      : 'bg-secondary/40 hover:bg-secondary/50'
                  }`}
                >
                  {isSystemLike ? (
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                        notification.type === 'order'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : notification.type === 'task'
                            ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                            : notification.type === 'activity'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : notification.type === 'live'
                                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                : 'bg-primary/20 text-primary'
                      }`}
                    >
                      {notification.type === 'order' ? (
                        <ShoppingBag className="w-6 h-6" />
                      ) : notification.type === 'task' ? (
                        <ListTodo className="w-6 h-6" />
                      ) : notification.type === 'activity' ? (
                        <Activity className="w-6 h-6" />
                      ) : notification.type === 'live' ? (
                        <Radio className="w-6 h-6" />
                      ) : (
                        <AlertCircle className="w-6 h-6" />
                      )}
                    </div>
                  ) : (
                    <div
                      className="relative shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (notificationUser) openProfilePreview(notificationUser);
                      }}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-border">
                        <img
                          src={notificationUser?.avatarUrl || undefined}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={handleAvatarError}
                        />
                      </div>
                      {renderIconBadge(notification.type)}
                    </div>
                  )}

                  <div className="flex flex-col flex-1 min-w-0">
                    {isSystemLike ? (
                      <>
                        <span className="text-[14px] font-bold truncate">
                          {notification.title ?? 'Update'}
                        </span>
                        <span className="text-[14px] text-muted-foreground line-clamp-2">
                          {actionText}
                        </span>
                      </>
                    ) : (
                      <span className="text-[14px] leading-snug">
                        {notificationUser ? (
                          <strong
                            className="font-bold hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openProfilePreview(notificationUser);
                            }}
                          >
                            {notificationUser.username}
                          </strong>
                        ) : (
                          <strong className="font-bold">Someone</strong>
                        )}{' '}
                        <span>{actionText}</span>
                        <span className="text-muted-foreground ml-1 whitespace-nowrap">
                          {timeLabel}
                        </span>
                      </span>
                    )}
                    {isSystemLike && (
                      <span className="text-[12px] text-muted-foreground mt-0.5">
                        {timeLabel}
                      </span>
                    )}
                  </div>

                  {notification.postImage && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-border">
                      <img
                        src={notification.postImage}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={handleMediaError}
                      />
                    </div>
                  )}

                  {notification.type === 'follow_request' && notificationUser && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (db.approveFollowRequest(notificationUser.id)) {
                            showToast(`Approved ${notificationUser.username}`);
                          }
                        }}
                        className="px-3 py-1.5 font-bold text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (db.rejectFollowRequest(notificationUser.id)) {
                            showToast(`Declined ${notificationUser.username}`);
                          }
                        }}
                        className="px-3 py-1.5 font-bold text-xs rounded-lg border border-border bg-background hover:bg-secondary"
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  {notification.type === 'follow' && notificationUser && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFollow(notificationUser);
                      }}
                      className={`px-4 py-1.5 font-bold text-xs rounded-lg transition-colors shadow-sm active:scale-95 shrink-0 ${
                        notificationUser.isFollowing
                          ? 'bg-secondary text-foreground'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      {notificationUser.isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {selectedPostId && (
        <PostModal
          postId={selectedPostId}
          onClose={() => setSelectedPostId(null)}
        />
      )}
    </div>
  );
}
