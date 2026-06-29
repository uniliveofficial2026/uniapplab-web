import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import type { AuthResult } from '../auth/types';
import { getAuthRedirectUrl } from '../auth/redirectUrl';
import { getFirebaseAuth } from './app';
import { upsertFirebaseProfile } from './profile';
import type { ProfileRow } from '../supabase/types';
import { firebaseSignInWithApplePopup, firebaseSignInWithGooglePopup } from './oauth';

function mapFirebaseAuthError(code: string, message: string): string {
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Incorrect email or password.';
  }
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  return message;
}

function authOrReason(): { auth: NonNullable<ReturnType<typeof getFirebaseAuth>> } | AuthResult {
  const auth = getFirebaseAuth();
  if (!auth) return { ok: false, reason: 'Firebase is not configured.' };
  return { auth };
}

export async function firebaseSignIn(email: string, password: string): Promise<AuthResult> {
  const gate = authOrReason();
  if ('ok' in gate) return gate;
  try {
    await signInWithEmailAndPassword(gate.auth, email.trim(), password);
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    return { ok: false, reason: mapFirebaseAuthError(e.code || '', e.message || 'Sign-in failed.') };
  }
}

export async function firebaseSignUp(payload: {
  email: string;
  password: string;
  username: string;
  displayName: string;
}): Promise<AuthResult & { needsEmailConfirmation?: boolean }> {
  const gate = authOrReason();
  if ('ok' in gate) return gate;
  const username = payload.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  try {
    const cred = await createUserWithEmailAndPassword(
      gate.auth,
      payload.email.trim(),
      payload.password
    );
    await updateProfile(cred.user, {
      displayName: payload.displayName.trim() || username,
    });
    const now = new Date().toISOString();
    const row: ProfileRow = {
      id: cred.user.uid,
      username,
      display_name: payload.displayName.trim() || username,
      avatar_url: cred.user.photoURL,
      bio: '',
      profile_setup_complete: false,
      public_user_id: username,
      public_user_id_changed_at: now,
    };
    await upsertFirebaseProfile(row).catch((profileErr) => {
      console.warn('[auth] Firestore profile upsert after sign-up failed:', profileErr);
    });
    return { ok: true, needsEmailConfirmation: !cred.user.emailVerified };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    return { ok: false, reason: mapFirebaseAuthError(e.code || '', e.message || 'Sign-up failed.') };
  }
}

export async function firebaseRequestPasswordReset(email: string): Promise<AuthResult> {
  const gate = authOrReason();
  if ('ok' in gate) return gate;
  try {
    const url = getAuthRedirectUrl();
    await sendPasswordResetEmail(gate.auth, email.trim(), url ? { url } : undefined);
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, reason: e.message || 'Could not send reset email.' };
  }
}

export async function firebaseUpdatePassword(newPassword: string): Promise<AuthResult> {
  const gate = authOrReason();
  if ('ok' in gate) return gate;
  const user = gate.auth.currentUser;
  if (!user) return { ok: false, reason: 'No signed-in user.' };
  try {
    await updatePassword(user, newPassword);
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, reason: e.message || 'Could not update password.' };
  }
}

export async function firebaseSignInWithGoogle(): Promise<AuthResult> {
  const gate = authOrReason();
  if ('ok' in gate) return gate;
  return firebaseSignInWithGooglePopup(gate.auth);
}

export async function firebaseSignInWithApple(): Promise<AuthResult> {
  const gate = authOrReason();
  if ('ok' in gate) return gate;
  return firebaseSignInWithApplePopup(gate.auth);
}

export { completeFirebaseOAuthRedirect } from './oauth';

export async function firebaseSignOut(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}

export function getFirebaseCurrentUser(): User | null {
  return getFirebaseAuth()?.currentUser ?? null;
}
