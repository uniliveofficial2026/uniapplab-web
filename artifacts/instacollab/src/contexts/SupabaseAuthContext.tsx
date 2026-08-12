/** @deprecated Prefer cloudAuthStore for hooks; CloudAuthContext for provider. */
export { useCloudAuth as useSupabaseAuth } from './cloudAuthStore';
export { CloudAuthProvider as SupabaseAuthProvider } from './CloudAuthContext';
