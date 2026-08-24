/**
 * Provider-neutral auth boundary. Initial adapter: Supabase.
 * PERSON / DEVICE / APP SESSION remain distinct.
 */

/**
 * @param {{ adapter?: 'supabase'|'memory', supabaseClient?: any }} [options]
 */
export function createUniLiveAuth(options = {}) {
  /** @type {any} */
  let session = null;
  const adapter = options.adapter || (options.supabaseClient ? 'supabase' : 'memory');

  if (adapter === 'supabase' && options.supabaseClient) {
    const sb = options.supabaseClient;
    return {
      provider: 'supabase',
      async signUp({ email, password }) {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        session = data.session;
        return {
          user: data.user ? { canonicalUserId: data.user.id, providerUserId: data.user.id } : null,
          session,
        };
      },
      async signIn({ email, password }) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        session = data.session;
        return {
          user: data.user ? { canonicalUserId: data.user.id, providerUserId: data.user.id } : null,
          session,
        };
      },
      async signOut() {
        await sb.auth.signOut();
        session = null;
        return { ok: true };
      },
      async getSession() {
        const { data } = await sb.auth.getSession();
        session = data.session;
        return session;
      },
      async refreshSession() {
        const { data, error } = await sb.auth.refreshSession();
        if (error) throw error;
        session = data.session;
        return session;
      },
      async getUser() {
        const { data } = await sb.auth.getUser();
        return data.user ? { canonicalUserId: data.user.id, providerUserId: data.user.id } : null;
      },
    };
  }

  /** Memory adapter for tests / local without Supabase. */
  return {
    provider: 'memory',
    async signUp({ email }) {
      session = { access_token: 'memory', user: { id: `person_${email}` } };
      return { user: { canonicalUserId: session.user.id, providerUserId: session.user.id }, session };
    },
    async signIn({ email }) {
      session = { access_token: 'memory', user: { id: `person_${email}` } };
      return { user: { canonicalUserId: session.user.id, providerUserId: session.user.id }, session };
    },
    async signOut() {
      session = null;
      return { ok: true };
    },
    async getSession() {
      return session;
    },
    async refreshSession() {
      return session;
    },
    async getUser() {
      return session?.user ? { canonicalUserId: session.user.id, providerUserId: session.user.id } : null;
    },
  };
}
