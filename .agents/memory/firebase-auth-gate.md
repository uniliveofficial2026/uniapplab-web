---
name: InstaCollab Firebase auth gate in App.tsx
description: Firebase-backed auth screens slot in as conditional renders in App(); demo mode is fully unaffected.
---

App.tsx calls `useAuth()` from `src/lib/AuthContext.tsx`. The auth gate fires only when Firebase is configured:
- `firebaseLoading=true` → SplashScreen (isLoading)
- `firebaseUser && !firebaseProfile` → ProfileSetup
- Otherwise (demo mode or authenticated) → existing launch flow

**Why:** The existing launch flow (LaunchFlowHost / useLaunchRoute) handles demo mode onboarding. The new Firebase screens should NOT replace it — they supplement it when credentials are present.

**How to apply:** Firebase env vars: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, etc. Without them, getFirebaseAuth() returns null, AuthProvider sets loading=false immediately, and all auth gate branches are skipped.
