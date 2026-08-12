/**
 * AuthService — canonical lane is Supabase Auth.
 * Delegates to lib/auth/authService (Firebase remains backup only inside that module).
 * Do not expose service-role keys or secrets here.
 */
import * as authApi from '../lib/auth/authService';
import type { AuthResult } from '../lib/auth/types';
import { getSupabaseClient } from '../lib/supabase/client';
import { isSupabaseConfigured } from '../lib/supabase/config';
import { withTimeout, NET_AUTH_MS } from '../lib/networkPolicy';
import { useAuthStore } from '../store/authStore';
import type { ServiceResult } from '../types/platform';

export type { AuthResult };

export interface AuthService {
  isConfigured(): boolean;
  signInWithEmail(email: string, password: string): Promise<AuthResult>;
  signUp(payload: {
    email: string;
    password: string;
    username: string;
    displayName: string;
  }): Promise<AuthResult & { needsEmailConfirmation?: boolean }>;
  signOut(): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  signInWithApple(): Promise<AuthResult>;
  getAccessToken(): Promise<string | null>;
  getCanonicalProvider(): 'supabase' | 'none';
}

class AuthServiceImpl implements AuthService {
  isConfigured(): boolean {
    return isSupabaseConfigured();
  }

  getCanonicalProvider(): 'supabase' | 'none' {
    return isSupabaseConfigured() ? 'supabase' : 'none';
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    const result = await authApi.authSignInWithEmail(email, password);
    useAuthStore.getState().setLastError(result.ok ? null : result.reason);
    return result;
  }

  async signUp(payload: {
    email: string;
    password: string;
    username: string;
    displayName: string;
  }): Promise<AuthResult & { needsEmailConfirmation?: boolean }> {
    const result = await authApi.authSignUp(payload);
    useAuthStore.getState().setLastError(result.ok ? null : result.reason);
    return result;
  }

  async signOut(): Promise<AuthResult> {
    try {
      await authApi.authSignOut();
      useAuthStore.getState().clearError();
      return { ok: true };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      useAuthStore.getState().setLastError(reason);
      return { ok: false, reason };
    }
  }

  async signInWithGoogle(): Promise<AuthResult> {
    const result = await authApi.authSignInWithGoogle();
    useAuthStore.getState().setLastError(result.ok ? null : result.reason);
    return result;
  }

  async signInWithApple(): Promise<AuthResult> {
    const result = await authApi.authSignInWithApple();
    useAuthStore.getState().setLastError(result.ok ? null : result.reason);
    return result;
  }

  /**
   * Prefer Supabase JWT for Edge Functions. Firebase ID token is backup only.
   */
  async getAccessToken(): Promise<string | null> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          NET_AUTH_MS,
          'AuthService.getAccessToken',
        );
        const token = data.session?.access_token;
        if (token) return token;
      } catch {
        /* fall through to Firebase backup */
      }
    }
    try {
      const { getFirebaseAuth } = await import('../lib/firebase/app');
      const user = getFirebaseAuth()?.currentUser;
      if (user) {
        return await withTimeout(user.getIdToken(), NET_AUTH_MS, 'AuthService.firebaseToken');
      }
    } catch {
      /* none */
    }
    return null;
  }
}

export const authService: AuthService = new AuthServiceImpl();

export async function getCanonicalAccessToken(): Promise<ServiceResult<string>> {
  const token = await authService.getAccessToken();
  if (!token) return { ok: false, error: 'not_authenticated' };
  return { ok: true, data: token };
}
