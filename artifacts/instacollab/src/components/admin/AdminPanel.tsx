import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Loader2, ShieldCheck, UserCog } from 'lucide-react';
import {
  adminBanUser,
  adminListUsers,
  adminMuteUser,
  adminSetRole,
  adminUnbanUser,
  fetchMe,
  type AdminUserRow,
} from '../../lib/platformApi';

export function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadUsers = useCallback(async (q?: string) => {
    const { users: rows } = await adminListUsers(q);
    setUsers(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const me = await fetchMe();
        if (cancelled) return;
        if (me.role !== 'admin') {
          setAllowed(false);
          return;
        }
        setAllowed(true);
        await loadUsers();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load admin');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadUsers]);

  const runAction = async (userId: string, action: () => Promise<unknown>) => {
    setBusyId(userId);
    setError(null);
    try {
      await action();
      await loadUsers(query);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking admin access…
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
        Admin tools require server-verified <code className="text-xs">role=admin</code>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border bg-secondary/10 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary" /> User management
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Ban, unban, role changes, and mutes via api.uniapplab.com</p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void loadUsers(query);
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search username…"
              className="text-sm border border-border rounded-lg px-3 py-2 bg-background min-w-[180px]"
            />
            <button type="submit" className="text-sm font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground">
              Search
            </button>
          </form>
        </div>
        {error ? <p className="px-5 pt-4 text-sm text-destructive">{error}</p> : null}
        <div className="p-5 space-y-2 max-h-[420px] overflow-y-auto">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border border-border rounded-xl"
            >
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{u.display_name || u.username}</p>
                <p className="text-xs text-muted-foreground truncate">@{u.username} · {u.role}</p>
                {u.banned_at ? (
                  <p className="text-xs text-destructive">Banned · {u.ban_reason || 'no reason'}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <select
                  className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background"
                  value={u.role}
                  disabled={busyId === u.id}
                  onChange={(e) => void runAction(u.id, () => adminSetRole(u.id, e.target.value))}
                >
                  <option value="user">user</option>
                  <option value="streamer">streamer</option>
                  <option value="admin">admin</option>
                </select>
                {u.banned_at ? (
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => void runAction(u.id, () => adminUnbanUser(u.id))}
                    className="text-xs font-bold px-2 py-1.5 rounded-lg border border-border"
                  >
                    Unban
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => void runAction(u.id, () => adminBanUser(u.id, 'Admin action'))}
                    className="text-xs font-bold px-2 py-1.5 rounded-lg border border-destructive/40 text-destructive flex items-center gap-1"
                  >
                    <Ban className="w-3.5 h-3.5" /> Ban
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => void runAction(u.id, () => adminMuteUser(u.id, 60))}
                  className="text-xs font-bold px-2 py-1.5 rounded-lg border border-border"
                >
                  Mute 1h
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No users found.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
