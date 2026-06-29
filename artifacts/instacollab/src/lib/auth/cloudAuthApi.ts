/**
 * Public auth API for UI — delegates to authService (Supabase-first when configured).
 */
import {
  authRequestPasswordReset,
  authSignInWithApple,
  authSignInWithEmail,
  authSignInWithGoogle,
  authSignOut,
  authSignUp,
  authUpdatePassword,
} from './authService';
import { syncCloudSessionNow } from './syncSession';

export type { AuthResult } from './types';

export const cloudSignIn = authSignInWithEmail;
export const cloudSignUp = authSignUp;
export const cloudRequestPasswordReset = authRequestPasswordReset;
export const cloudUpdatePassword = authUpdatePassword;
export const cloudSignInWithGoogle = authSignInWithGoogle;
export const cloudSignInWithApple = authSignInWithApple;
export const cloudSignOut = authSignOut;

export { getAuthRedirectUrl, getConfiguredAppOrigin, getSuggestedOAuthOrigins } from '../auth/redirectUrl';
export { syncCloudSessionNow };
