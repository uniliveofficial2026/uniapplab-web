/**
 * Database boundary — Postgres remains authoritative.
 * Does not expose Supabase project IDs as UniLive public API truth.
 */

export function createUniLiveDatabase(options = {}) {
  const client = options.client || null;
  return {
    provider: options.provider || 'supabase',
    /**
     * Escape hatch for SQL — callers own query safety.
     */
    async query(sql, params = []) {
      if (!client) {
        throw Object.assign(new Error('database_client_required'), { code: 'DATABASE_CLIENT_REQUIRED' });
      }
      if (typeof client.query === 'function') return client.query(sql, params);
      if (typeof client.rpc === 'function') return client.rpc(sql, params);
      throw Object.assign(new Error('unsupported_client'), { code: 'UNSUPPORTED_DB_CLIENT' });
    },
    async health() {
      return { ok: Boolean(client), provider: options.provider || 'supabase' };
    },
  };
}
