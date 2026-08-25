# UniLive Route Map

**Base SHA:** `9e8c44a` · **Prod:** https://app.uniapplab.com  
**Shell parser:** `artifacts/instacollab/src/lib/appShellRoutes.ts`  
**Launch funnel:** `artifacts/instacollab/src/lib/launchRoute.ts`  
**uiUxChanged:** false

---

## Launch routes (pre-shell)

| Route | Auth | Back | Deep-link notes |
|-------|------|------|-----------------|
| `splash` | No | N/A (first run) | Session + device progress flags |
| `onboarding` | No | Within funnel | Skipped for returning users |
| `auth` | Required to proceed | Stay until signed in | Native: `com.uniapplab.unilive://auth/callback` |
| `profile_setup` | Yes | Funnel forward | Legal + profile |
| `trending` | Yes | → main | First-time only |
| `banned` | Yes (blocked) | No main shell | Ban gate |
| `main` | Yes (returning) | Tab history | Deep links apply |

---

## Main shell tabs (path → tab)

| Path | Tab | Auth | Back behavior | Deep-link |
|------|-----|------|---------------|-----------|
| `/`, `/home` | home | Prefer signed-in main | Tab switch / browser history | Yes |
| `/explore`, `/search`, `/discover` | search | Prefer main | Clears explore query on leave | `?q=` `?tab=` |
| `/reels` | reels | Prefer main | Tab | Yes |
| `/messages` | messages | Prefer main | List | Yes |
| `/messages/:chatId` | messages | Prefer main | Back → messages list | Thread deep-link |
| `/notifications` | notifications | Prefer main | Tab | Yes |
| `/workspace` | workspace | Prefer main | Tab | Studio query keys preserved |
| `/dating` | dating | Prefer main | Tab | Yes |
| `/profile` | profile | Prefer main | Tab | Yes |
| `/profile/:userId` | profile | Prefer main | Back → own profile/home | Profile deep-link |
| `/live` | live | Prefer main | Tab | Discovery / go-live |
| `/karaoke` | karaoke | Prefer main | Tab | Karaoke query keys |
| `/party` | rooms | Prefer main | Party home | Yes |
| `/room…` | rooms | Prefer main | Within rooms stack | Room deep-link (`roomsInitialPath`) |
| `/games`, `/games/hub` | game-hub | Prefer main | Tab | Yes |
| `/greedy-tap` | greedy-tap | Prefer main | Tab | Allowed on localhost without auth in App |
| `/games/local` | local-games | Prefer main | Tab | Localhost game URLs are **dev-only** risk |
| `/games/web` | third-party-games | Prefer main | Tab | Yes |
| `/wallet` | wallet | Prefer main | Tab | Yes |
| `/youtube` | youtube | Prefer main | Tab | Yes |

---

## Auth / deep-link schemes

| Scheme / URL | Purpose |
|--------------|---------|
| `https://app.uniapplab.com/...` | Production web + Capacitor live server |
| `com.uniapplab.unilive://auth/callback` | OAuth return (iOS/Android intent filters) |
| `com.uniapplab.unilive://…` | Generic native deep links |
| Capacitor `hostname` | `app.uniapplab.com` (`capacitor.config.ts`) |

**Production rule:** OAuth / redirect must never land on `localhost` (see `lib/auth/redirectUrl.ts`, `nativeOAuth.ts`).

---

## Legacy query keys (pruned on sync)

`appTab`, `profileUserId`, `chatId`, `searchQuery`, `searchTab`, `roomsPath` — stripped by `pruneAppShellSearchParams`.

Studio/bootstrap keys retained when needed: `pick`, `mirror`, `adminOrigin`, `adminPick`, `force_demo`, `launch`, `as`, `user`, `login`.
