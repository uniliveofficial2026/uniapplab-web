import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, ShieldCheck, UserCog } from 'lucide-react';
import {
  adminBanUser,
  adminListUsers,
  adminMuteUser,
  adminSetRole,
  adminUnbanUser,
  fetchMe,
  type AdminUserRow,
} from '../../lib/platformApi';
import { useDB, useDbRevision } from '../../lib/useDB';
import { handleAvatarError } from '../../lib/utils';
import { safeAvatarUrl } from '../../lib/safe';
import { buildAdminUserInsights } from '../../lib/adminUserInsights';
import { AdminUserProgressCard } from './AdminUserProgressCard';
import type { PlatformRole, User } from '../../types';

function localUserToAdminRow(user: User): AdminUserRow {
  return {
    id: user.id,
    username: user.username,
    display_name: user.displayName,
    role: user.role || 'user',
    banned_at: user.bannedAt ? new Date(user.bannedAt).toISOString() : null,
    ban_reason: user.banReason ?? null,
  } as AdminUserRow;
}

export function AdminPanel() {
  const db = useDB();
  useDbRevision();
  const [mode, setMode] = useState<'server' | 'local'>('local');
  const [serverUsers, setServerUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const localUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (db.users ?? [])
      .filter((user) => {
        if (!q) return true;
        return (
          user.username?.toLowerCase().includes(q) ||
          user.displayName?.toLowerCase().includes(q) ||
          user.id.toLowerCase().includes(q)
        );
      })
      .map(localUserToAdminRow);
  }, [db.users, query]);

  const users = mode === 'server' ? serverUsers : localUsers;

  const loadServerUsers = useCallback(async (q?: string) => {
    const { users: rows } = await adminListUsers(q);
    setServerUsers(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError(null);
      try {
        const me = await fetchMe();
        if (cancelled) return;
        if (me.role === 'admin') {
          setMode('server');
          await loadServerUsers();
        } else {
          setMode('local');
        }
      } catch {
        if (!cancelled) {
          setMode('local');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadServerUsers]);

  const runServerAction = async (userId: string, action: () => Promise<unknown>) => {
    setBusyId(userId);
    setError(null);
    try {
      await action();
      await loadServerUsers(query);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const runLocalAction = (
    userId: string,
    patch: Partial<User>,
    auditText: string,
  ) => {
    setBusyId(userId);
    setError(null);
    try {
      db.updateUser(userId, (user) => ({ ...user, ...patch }));
      db.addAuditLog({ id: Date.now(), text: auditText, time: 'Just now' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border bg-secondary/10 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary" /> User management
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {mode === 'server'
                ? 'Server-verified admin · ban, role, and mute via platform API'
                : 'Live local users · actions update app user data in real time'}
            </p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === 'server') void loadServerUsers(query);
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search username…"
              className="text-sm border border-border rounded-lg px-3 py-2 bg-background min-w-[180px]"
            />
            {mode === 'server' ? (
              <button type="submit" className="text-sm font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground">
                Search
              </button>
            ) : null}
          </form>
        </div>
        {error ? <p className="px-5 pt-4 text-sm text-destructive">{error}</p> : null}
        <div className="p-5 space-y-2 max-h-[420px] overflow-y-auto">
          {users.map((u) => {
            const live = db.users.find((user) => user.id === u.id);
            return (
            <div
              key={u.id}
              className="flex flex-col gap-3 p-3 border border-border rounded-xl"
            >
              <AdminUserProgressCard insights={buildAdminUserInsights(db, u.id)} compact />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={safeAvatarUrl(live?.avatarUrl)}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
                  onError={handleAvatarError}
                />
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">
                    {live?.displayName || u.display_name || u.username}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{live?.username || u.username} · {live?.role || u.role}
                    {live?.status === 'live' ? ' · LIVE' : ''}
                  </p>
                  {u.banned_at || live?.bannedAt ? (
                    <p className="text-xs text-destructive">
                      Banned · {u.ban_reason || live?.banReason || 'no reason'}
                    </p>
                  ) : null}
                  {live?.mutedUntil && live.mutedUntil > Date.now() ? (
                    <p className="text-xs text-amber-600">
                      Muted until {new Date(live.mutedUntil).toLocaleTimeString()}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <select
                  className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background"
                  value={live?.role || u.role || 'user'}
                  disabled={busyId === u.id}
                  onChange={(e) => {
                    const role = e.target.value as PlatformRole;
                    if (mode === 'server') {
                      void runServerAction(u.id, () => adminSetRole(u.id, role));
                      return;
                    }
                    runLocalAction(u.id, { role }, `Set @${live?.username || u.username} role to ${role}`);
                  }}
                >
                  <option value="user">user</option>
                  <option value="streamer">streamer</option>
                  <option value="admin">admin</option>
                </select>
                {u.banned_at || live?.bannedAt ? (
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => {
                      if (mode === 'server') {
                        void runServerAction(u.id, () => adminUnbanUser(u.id));
                        return;
                      }
                      runLocalAction(
                        u.id,
                        { bannedAt: undefined, banReason: undefined },
                        `Unbanned @${live?.username || u.username}`,
                      );
                    }}
                    className="text-xs font-bold px-2 py-1.5 rounded-lg border border-border"
                  >
                    Unban
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => {
                      if (mode === 'server') {
                        void runServerAction(u.id, () => adminBanUser(u.id, 'Admin action'));
                        return;
                      }
                      runLocalAction(
                        u.id,
                        { bannedAt: Date.now(), banReason: 'Admin action' },
                        `Banned @${live?.username || u.username}`,
                      );
                    }}
                    className="text-xs font-bold px-2 py-1.5 rounded-lg border border-destructive/40 text-destructive flex items-center gap-1"
                  >
                    <Ban className="w-3.5 h-3.5" /> Ban
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => {
                    if (mode === 'server') {
                      void runServerAction(u.id, () => adminMuteUser(u.id, 60));
                      return;
                    }
                    runLocalAction(
                      u.id,
                      { mutedUntil: Date.now() + 60 * 60 * 1000 },
                      `Muted @${live?.username || u.username} for 1h`,
                    );
                  }}
                  className="text-xs font-bold px-2 py-1.5 rounded-lg border border-border"
                >
                  Mute 1h
                </button>
              </div>
              </div>
            </div>
            );
          })}
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No users found.</p>
          ) : null}
        </div>
      </div>
      {mode === 'local' ? (
        <p className="text-[11px] text-muted-foreground px-1">
          Showing live app users. Server admin APIs are used automatically when your account has{' '}
          <code className="text-[10px]">role=admin</code>.
        </p>
      ) : (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 px-1 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Server-verified admin mode
        </p>
      )}
    </div>
  );
}
