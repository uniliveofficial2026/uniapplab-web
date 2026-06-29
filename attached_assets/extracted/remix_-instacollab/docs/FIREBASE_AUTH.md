# Firebase SDK setup — project `uchat-app-c1b8e`

This app uses the **Firebase Web SDK** (`firebase` npm package) for auth failover when Supabase is unavailable.

## 1. Environment (required)

Your repo includes Android/iOS configs (`google-services.json`, `GoogleService-Info.plist`). The **Web** app uses separate keys — do not reuse only the Android API key.

**Never paste API keys in chat.** Use the local file flow: **[PASTE_FIREBASE_CONFIG.md](./PASTE_FIREBASE_CONFIG.md)**.

### Quick setup (paste your web config locally)

1. Copy `firebase.web.config.json.example` → `firebase.web.config.json`
2. Paste your Firebase Console `firebaseConfig` JSON into that file
3. Run:

```bash
npm run firebase:sync-env
```

### Or auto-sync (uchat web app defaults)

```bash
npm run firebase:sync-env
```

This writes `VITE_FIREBASE_*` into `.env` from the registered Web app **uchat app** (`1:932871409657:web:2b87313a5f6532da347728`).

### Manual `.env` block

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=uchat-app-c1b8e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=uchat-app-c1b8e
VITE_FIREBASE_STORAGE_BUCKET=uchat-app-c1b8e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=932871409657
VITE_FIREBASE_APP_ID=1:932871409657:web:2b87313a5f6532da347728
VITE_FIREBASE_DATABASE_URL=https://uchat-app-c1b8e-default-rtdb.firebaseio.com
VITE_FIREBASE_MEASUREMENT_ID=G-8RKZ3RLWE0
```

Refresh config from Firebase CLI anytime:

```bash
npx firebase-tools@latest apps:sdkconfig WEB 1:932871409657:web:2b87313a5f6532da347728 --project=uchat-app-c1b8e
```

Restart after changes:

```bash
npm run dev
```

## 2. Firebase Console checklist

| Step | Where |
|------|--------|
| Enable **Email/Password**, **Google**, **Apple** | Authentication → Sign-in method |
| Add **localhost** (+ tunnel domain if used) | Authentication → Settings → Authorized domains |
| Create **Firestore** database | Firestore Database |
| Deploy rules | `firestore.rules` in repo — run `npx firebase deploy --only firestore:rules` |

## 3. Code layout

| File | Role |
|------|------|
| `src/lib/firebase/config.ts` | Reads `VITE_FIREBASE_*` |
| `src/lib/firebase/firebaseConfig.ts` | Builds `initializeApp()` options |
| `src/lib/firebase/app.ts` | Singleton App, Auth, Firestore |
| `src/lib/firebase/authApi.ts` | Sign-in / OAuth / password |
| `src/lib/firebase/profile.ts` | Firestore `profiles/{uid}` |
| `src/lib/auth/cloudAuthApi.ts` | Supabase → Firebase failover |
| `src/contexts/CloudAuthContext.tsx` | Session restore |

## 4. Local emulators (optional)

```bash
npx firebase-tools@latest emulators:start --only auth,firestore
```

In `.env`:

```env
VITE_FIREBASE_USE_EMULATORS=true
```

Auth emulator: `http://127.0.0.1:9099` · Firestore: `8080` · UI: `http://127.0.0.1:4000`

## 5. Failover behavior

- **Primary:** Supabase (`VITE_SUPABASE_*`)
- **Fallback:** Firebase when Supabase health check fails or auth returns a network/service error
- Active backend stored in `localStorage` key `instacollab_auth_backend`

## 6. Google & Apple sign-in (Firebase — required for OAuth buttons)

The app uses **Firebase Auth** for **Continue with Google** and **Continue with Apple** when `VITE_FIREBASE_*` is set. It does **not** use Supabase OAuth for those buttons (that path often shows Google **Access blocked** unless you register Supabase’s callback URL in Google Cloud).

### Firebase Console

| Step | Where |
|------|--------|
| Enable **Google** and **Apple** | Authentication → Sign-in method |
| Add **Authorized domains** | Authentication → Settings → Authorized domains — `localhost` plus **each** tunnel hostname (e.g. `abc-xyz.trycloudflare.com`; wildcards are not supported) |

### Google Cloud Console (same project as Firebase)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials  
2. Open the **Web client** used by Firebase (auto-created, or link from Firebase → Google provider setup).  
3. **Authorized JavaScript origins** — add exactly how you open the app, e.g. `http://localhost:3000`, `https://your-tunnel.trycloudflare.com`  
   - Use **`http://localhost:3000`**, not `http://127.0.0.1:3000` — Google/Firebase often reject 127.0.0.1 with “The requested action is invalid”.  
4. **Authorized redirect URIs** — include `https://uchat-app-c1b8e.firebaseapp.com/__/auth/handler` (Firebase’s handler; not the Supabase callback).

### “The requested action is invalid”

Usually means the **origin does not match** Authorized domains / JavaScript origins:

| Check | Action |
|-------|--------|
| Wrong host | Open `http://localhost:3000` (not `127.0.0.1`) |
| Firebase | Authentication → Settings → **Authorized domains** → add `localhost` and tunnel host |
| Google Cloud | Web client → **Authorized JavaScript origins** → same URLs as above |
| Provider off | Authentication → Sign-in method → enable **Google** / **Apple** |
| Stale redirect | App now only completes Firebase redirect when you started sign-in in this tab |

Do **not** only configure `https://<project>.supabase.co/auth/v1/callback` unless you intentionally use Supabase OAuth (this app does not for Google/Apple when Firebase is configured).

### Apple

- Firebase Console → Apple → follow Apple Developer Services ID + key steps  
- Return URL uses Firebase’s handler domain, not Supabase

### Email / password

Still uses Supabase first with Firebase failover (`cloudSignIn` / `cloudSignUp`).

## 7. Verify configuration

In the browser console (dev):

```js
import.meta.env.VITE_FIREBASE_PROJECT_ID  // should be uchat-app-c1b8e
```

Or sign in with cloud auth — Live dev panel changelog entry **Firebase auth failover**.
