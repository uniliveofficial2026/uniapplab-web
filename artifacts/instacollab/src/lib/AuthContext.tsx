/**
 * Public auth hooks/context — Firebase-free.
 * Mount AuthProvider via AuthProvidersHost (async chunk), not from this barrel.
 */
export {
  AuthContext,
  AUTH_OFFLINE_STUB,
  useAuth,
  useAuthOptional,
  type AuthContextValue,
} from './auth/authContextStore';
