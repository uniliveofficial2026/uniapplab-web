/**
 * Feature module: Auth + Upload canonical lanes (logic only).
 * Re-exports hardened services — does not change auth/upload UI components.
 */
export { authService, getCanonicalAccessToken } from '../../services/AuthService';
export { uploadService } from '../../services/UploadService';
export { useAuthStore } from '../../store/authStore';
export { useUploadStore } from '../../store/uploadStore';

/** Canonical providers for this feature lane. */
export const AUTH_UPLOAD_LANE = {
  auth: 'supabase' as const,
  media: 'cloudflare_r2' as const,
  forbidden: ['supabase_storage', 'firebase_auth_primary'] as const,
};
