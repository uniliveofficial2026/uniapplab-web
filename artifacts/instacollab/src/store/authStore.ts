/**
 * Session / auth UI flags — non-visual Zustand store.
 * Does not replace CloudAuthContext; additive for future feature modules.
 */
import { create } from 'zustand';

type AuthUiState = {
  lastError: string | null;
  setLastError: (error: string | null) => void;
  clearError: () => void;
};

export const useAuthStore = create<AuthUiState>((set) => ({
  lastError: null,
  setLastError: (error) => set({ lastError: error }),
  clearError: () => set({ lastError: null }),
}));
