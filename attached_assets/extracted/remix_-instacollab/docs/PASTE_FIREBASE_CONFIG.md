# How to add your Firebase web config (without pasting secrets in chat)

Your Firebase web config looks like this in the console:

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // ...
};
```

**Do not paste that into Cursor chat.** Keep it on your machine only.

## Easiest way (3 steps)

### 1. Create a local file

In the project folder `remix_-instacollab`:

1. Duplicate `firebase.web.config.json.example`
2. Rename the copy to **`firebase.web.config.json`**
3. Open `firebase.web.config.json` in Cursor

This file is **gitignored** — it will not be committed to GitHub.

### 2. Paste your config

In Firebase Console:

**Project settings** (gear) → **Your apps** → select your **Web** app → copy the `firebaseConfig` object.

Paste into `firebase.web.config.json` as **JSON only** (remove `const firebaseConfig =` and trailing `;`):

```json
{
  "apiKey": "YOUR_FIREBASE_API_KEY",
  "authDomain": "your-project.firebaseapp.com",
  "databaseURL": "https://your-project-default-rtdb.firebaseio.com",
  "projectId": "your-project-id",
  "storageBucket": "your-project.firebasestorage.app",
  "messagingSenderId": "000000000000",
  "appId": "1:000000000000:web:0000000000000000000000",
  "measurementId": "G-XXXXXXXXXX"
}
```

Optional fields if your config has them: `databaseURL`, `measurementId`.

You can also paste the whole JavaScript block from the console — the sync script will try to read the `{ ... }` part.

### 3. Run the sync command

In the terminal (project folder):

```bash
npm run firebase:sync-env
```

That writes `VITE_FIREBASE_*` into `.env` for Vite.

Then restart:

```bash
npm run dev
```

## Alternative: edit `.env` by hand

Open **`.env`** in the project root and set these names (values from your `firebaseConfig`):

| In Firebase `firebaseConfig` | In `.env` |
|------------------------------|-----------|
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |
| `databaseURL` | `VITE_FIREBASE_DATABASE_URL` |
| `measurementId` | `VITE_FIREBASE_MEASUREMENT_ID` |

Example line:

```
VITE_FIREBASE_API_KEY=AIza...
```

(No quotes around values in `.env`.)

## Already done for you?

If you never created `firebase.web.config.json`, the project may already have Firebase values in `.env` from `npm run firebase:sync-env` (uchat web app). You only need the steps above if you want to use **your own** config from the console.

## Check it worked

After `npm run dev`, open the app and try **Continue with Google** or email login. In Live dev (**Ctrl+Shift+D**), see the changelog note for Firebase failover.

If login fails, confirm in Firebase Console:

- **Authentication** → sign-in methods enabled
- **Authentication** → **Authorized domains** includes `localhost`

## Where your pasted code goes (important)

Firebase Console gives you a **JavaScript snippet** (`import …`, `const firebaseConfig = { … }`, `initializeApp`). **Do not put that in this markdown file or in `main.tsx`.**

| What Firebase shows | Where it goes in this project |
|---------------------|--------------------------------|
| The `{ apiKey, authDomain, … }` object only | **`firebase.web.config.json`** (JSON format) |
| `initializeApp`, `getAnalytics`, imports | **Already handled** in `src/lib/firebase/app.ts` |

After you save `firebase.web.config.json`, run:

```bash
npm run firebase:sync-env
npm run dev
```