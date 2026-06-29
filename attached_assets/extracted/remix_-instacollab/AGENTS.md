# Agent guide — InstaCollab (entire app, every task)

Single in-memory store: `src/lib/db.ts` (`db` singleton from `src/lib/db/localDb.ts`; type `LocalDB` from `src/lib/db/localDbType.ts`), with re-renders via `useDB()`.

**Every user action** (like, save, follow, comment, message, story view, create post, workspace task, settings change, etc.) must:

1. **Write** through the canonical `db` method (see task catalog below).  
2. **Read** through `useDB()` + `resolve*` / hooks so all screens show the same live data.  
3. **Not** mirror posts/users/reels/engagement in component `useState`.

Applies to **existing** bugfixes/refactors and **future** features on **any** screen.

**Task catalog (machine-readable):** `src/lib/appDataTasks.ts`

---

## Launch flow (before main Shell)

Route order (`readLaunchRoute` / `useLaunchRoute`): **splash → onboarding → auth → profile_setup → trending → main**.

### Cloud auth — Supabase primary (optional Firebase-only legacy)

When `VITE_SUPABASE_*` is set (see `.env.example`):

- **Stack:** `authService.ts` (sign-in/up/OAuth) → `sessionManager.ts` (session → `db.syncAuthUser` + profile realtime) → `cloudAppState.ts` (debounced push + Supabase Realtime on `user_app_state`).
- `CloudAuthProvider` restores Supabase session on load; OAuth return handled via `completeSupabaseOAuthReturnOnce`. **New accounts** complete `profile_setup` + `trending`; **returning** accounts skip when `profiles.profile_setup_complete`.
- UI: `cloudAuthApi.ts` (thin re-exports) + `cloudProfile.ts`; logout `useCloudAuth().signOut()`.
- **Google/Apple:** Supabase OAuth when Supabase is configured (add tunnel URL in Supabase + Google Cloud — `npm run oauth:setup`).
- **Migrations:** `profiles`, `user_app_state`, `profiles_realtime` under `supabase/migrations/`.
- Without Supabase but with `VITE_FIREBASE_*` only: legacy Firebase auth path in `CloudAuthContext`.
- Restart dev server after `.env` changes. Validate: `npm run auth:check`. Full guide: `docs/CLOUD_AUTH.md`.

| Step | Component | `db` methods |
|------|-----------|--------------|
| Splash | `SplashScreen` | `markSplashSeen` |
| Onboarding | `OnboardingScreen` | `completeOnboarding` |
| Auth | `AuthScreen` | Local: `signInWithCredentials`, … — Cloud: `cloudSignIn` / `cloudSignUp` / reset → `syncAuthUser` |
| Profile setup | `ProfileSetupScreen` | `updateUser`, `completeProfileSetup`, `pushCloudProfile` |
| Trending | `TrendingScreen` | `toggleFollow`, `markTrendingSeen` |
| Log out | Profile → settings | `useCloudAuth().signOut()` → `cloudSignOut` + `logoutSession` |

Demo logins: `demo@instacollab.app` / `demo123`, `sarah@instacollab.app` / `demo123`. Reset code (local): `123456`.

---

## App surface

| Tab | Component | Data domains |
|-----|-------------|--------------|
| `home` | Feed, Post, StoryRing, PostModal, ShareModal | posts, users, stories, comments, engagement |
| `search` | SearchScreen | posts, users, PostModal |
| `reels` | ReelsScreen | reels, users, comments, engagement |
| `messages` | MessagesScreen | users, messages, presence, shared links |
| `notifications` | NotificationsScreen | notifications, users, follow |
| `profile` | ProfileScreen | users, posts, settings, comments |
| `workspace` | WorkspaceScreen | tasks, files, audit logs |
| `dating` | DatingScreen | swipe deck, likes/passes/matches |
| `live` / games / wallet | — | extend with `useDB()` when adding social data |

**Overlays:** `UserProfilePreview` (`userId`), `StoryRing` fullscreen, `Shell` create (`addPost` / `addReel`).

---

## Full task catalog → `db` API

Use this for **any** task you implement or fix—not only follow/unfollow.

### Posts

| User task | `db` method | Live UI |
|-----------|-------------|---------|
| Like / unlike | `togglePostLike(postId)` | `resolvePost` / `usePostById` |
| Save / unsave | `togglePostSave(postId)` | `resolvePost` |
| Comment | `addPostComment` + `buildCommentPayload(author, text, extra?)` | `resolveCommentAuthor` |
| Reply | `addPostCommentReply` + `buildCommentPayload` | same |
| Like comment | `likePostComment(postId, commentId, userId)` | `resolveCommentAuthor` |
| Delete | `deletePost(postId)` | — |
| Report | `updatePost` → `isReported` | `resolvePost` |
| Create | `addPost` (Shell) | author resolved in `db` |
| Share link | `addMessage` + URL; preview via `resolvePost` | Messages, ShareModal |

### Reels

| User task | `db` method | Live UI |
|-----------|-------------|---------|
| Like / unlike | `toggleReelLike(reelId)` | `resolveReel` |
| Save / unsave | `toggleReelSave(reelId)` | `resolveReel` |
| Comment | `addReelComment` + `buildCommentPayload` | `resolveCommentAuthor` |
| Delete | `deleteReel(reelId)` | `resolveReel` |
| Create | `addReel` (Shell) | author resolved in `db` |

### Users & social graph

| User task | `db` method | Live UI |
|-----------|-------------|---------|
| Follow / unfollow | `toggleFollow(userId)` | `resolveUser` / `useUserById` |
| Edit profile | `updateUser` → syncs embedded refs app-wide | `findUserById`, `targetUser` |
| Profile preview | (read) | `useUserById(userId)`; `openProfilePreview` sends **id only** |

### Stories

| User task | `db` method | Live UI |
|-----------|-------------|---------|
| Mark viewed | `markStoryViewed(userId)` | `hasViewedStory`, StoryRing |
| Add segment | `addStorySegment(userId, segment)` | `getUserStorySegments` |

### Messages & chat

| User task | `db` method | Live UI |
|-----------|-------------|---------|
| Send | `addMessage(chatId, payload)` | `findUserById` for peer |
| Edit / delete | `updateMessage`, `deleteMessage` | `db.messages` |
| Reaction | `toggleMessageReaction` | `db.messages` |
| Read state / typing / online | `setChatReadAt`, `setChatPeerReadAt`, `setUserPresence`, … | presence maps |
| Wallpaper | `setChatWallpaper` | `db.chatWallpapers` |
| Open shared p/r/s link | (read) | `resolvePost`, `resolveReel`, `resolveUser` |

### Notifications

| User task | `db` method | Live UI |
|-----------|-------------|---------|
| New notification | `addNotification` | `resolveUser(notification.user)` |
| Follow from row | `toggleFollow` | `resolveUser` |

### Workspace

| User task | `db` method | Live UI |
|-----------|-------------|---------|
| Tasks | `addTask`, `updateTask`, `deleteTask` | `db.tasks` |
| Files | `addFile`, `deleteFile` | `db.files` |
| Audit | `addAuditLog` | `db.auditLogs` |

### Dating

| User task | `db` method | Live UI |
|-----------|-------------|---------|
| Like profile | `likeDatingProfile(userId)` | `db.datingState`, `getDatingMatches()` |
| Pass profile | `passDatingProfile(userId)` | `db.datingState`, `getDatingCandidates()` |
| Undo swipe action | `undoDatingAction(userId)` | `db.datingState`, `getDatingCandidates()` |
| Likes You queue | `getDatingLikesYou()` | Dating Likes You view |
| Top picks | `getDatingTopPicks()` | Dating Top Picks rail |
| Set preferences | `setDatingPreferences({ minAge, maxAge, maxDistanceKm, intents })` | `db.datingState.preferences` |
| Set subscription tier | `setDatingSubscriptionTier(free|plus|gold)` | `db.datingState.subscription` |
| Edit dating profile | `updateDatingProfile({ prompts, mediaUrls, verified })` | `db.datingState.profile` |
| Super Like quota | `consumeDatingSuperLike(limit)` | `db.datingState.usage.superLikesUsed` |
| Report profile | `reportDatingProfile(userId, reason)` | `db.datingState.reports`; candidate removed from deck |
| Likes You reveal gate | `canRevealDatingLikesYou()` | Tier-based reveal/blur behavior in Likes You view |
| Match conversation starter | `getDatingConversationStarter(userId)` | Seed first DM in new match chat |
| Match activity touch | `touchDatingMatchActivity(userId)` | `db.datingState.matchMeta.lastActivityAt` / expiry extension |
| Expired match pruning | `pruneExpiredDatingMatches()` | Removes expired entries from active matches |
| Re-engagement nudges | `getDatingReengagementNudges()` | Prompt stale matches to restart chat |
| Profile completeness | `getDatingProfileCompleteness(userId?)` | Completion score for UI + ranking impact |
| Adaptive learning | `likeDatingProfile` / `passDatingProfile` updates `learnedSignals` | Learns preferred age/distance from swipe behavior |
| Ranking knobs | `setDatingRankingTuning(weights)` | Tunes recommendation scoring contributions |
| Experiment mode | `setDatingExperimentMode(auto|A|B|C)` | Selects ranking variant bucket behavior |
| Exposure tracking | `markDatingExposure(userId)` | Increments per-bucket exposure counters |
| Experiment analytics | `getDatingExperimentSummary()` | Per-bucket exposure/like/pass/match metrics |
| Windowed experiment analytics | `getDatingExperimentSummaryForWindow(hours)` | Computes per-bucket metrics for selected lookback window |
| Winner recommendation | `getDatingExperimentWinner(hours)` | Returns best bucket from weighted engagement score + confidence metadata |
| Confidence guardrails | `getDatingExperimentWinner(hours)` | Enforces sample-size, confidence, and uplift thresholds before calling a winner |
| Sequential stability locks | `getDatingExperimentWinner(hours)` | Applies cooldown/hold windows to prevent rapid winner flips during live traffic |
| Operator guardrail tuning | `setDatingExperimentStability({...})` | Live-tunes sample/confidence/delta/cooldown/hold thresholds in Dating dashboard |
| Preset guardrail profiles | `applyDatingExperimentPreset(conservative|balanced|aggressive)` | Applies one-click operator policy bundles for experiment strictness |
| Preset audit metadata | `applyDatingExperimentPreset(...)` | Persists last preset, applied timestamp, and acting user id for operator traceability |
| Experiment export (JSON) | `getDatingExperimentExport(hours)` | Produces portable snapshot with settings, winner, and raw event stream |
| Experiment export (CSV) | `getDatingExperimentEventsCsv(hours)` | Produces analysis-friendly CSV rows for summary/winner/events |
| Experiment import/replay | `importDatingExperimentExport(payload, mode)` | Imports JSON snapshot and replays events (append or replace) |
| Experiment reset | `resetDatingExperimentMetrics()` | Clears counters/event log to start a fresh run |
| Unmatch | `unmatchDatingProfile(userId)` | `db.datingState`, `getDatingMatches()` |
| View matches | `getDatingMatches()` | Dating matches list |
| Reset deck | `clearDatingState()` | Dating swipe deck + matches |

### Settings & system UI

| User task | `db` method | Live UI |
|-----------|-------------|---------|
| Settings | `updateSettings` | `db.settings` |
| Cloud / tier / offline | `updateCloudConnection`, `setStorageTier`, `setOfflineSyncEnabled` | `db.settings` |
| Global mute | `setGlobalMuted` | `db.globalMuted` |
| Fullscreen | `setFullScreenActive` | `db.isFullScreenActive` |
| Nav badges | `setHasUnreadNotifications`, `setUnreadMessagesCount` | Shell |

---

## Display layer (all entities)

| Entity | Resolve | Hooks |
|--------|---------|-------|
| User | `resolveUser(db.users, embedded)` | `useUserById`, `useResolvedUser` |
| Post | `resolvePost(db.posts, embedded, db.users)` | `usePostById`, `useResolvedPost` |
| Reel | `resolveReel(db.reels, embedded, db.users)` | `useResolvedReel` |
| Comment author | `resolveCommentAuthor(db.users, comment)` | `useResolvedCommentAuthor` |

Files: `src/lib/entityResolve.ts`, `src/lib/safe.ts`, `src/lib/useDB.ts`.

### Do not

- Set `isLiked` / `isSaved` / `isFollowing` / counts only in `useState`.  
- Keep a snapshot `user` or `post` in parent state for modals—use **ids**.  
- Hand-build comments without `buildCommentPayload` (DB still enriches, but author fields should be explicit).  
- Double-count comments (`post.comments` is synced in `db`; do not add local comment array length).

### Do

- Call the `db` method from the table for that user task.  
- Use `useDB()` in any component that shows store data.  
- After `updateUser`, rely on `syncUserRefsInContent` (extend in `db.ts` if new tables embed users).  
- After post media change, `syncPostMediaInNotifications` runs in `updatePost`.

---

## Workflows

### Existing work (any screen, any task)

1. Identify the **user task** (from list above or `appDataTasks.ts`).  
2. Confirm the screen uses the listed **`db` method** (not a one-off `updatePost` for likes/saves).  
3. Confirm UI reads via **`resolve*` / hooks** and `useDB()`.  
4. Run `npm run lint`.  
5. Cross-screen smoke for that task (see below).  
6. In dev, use the **Live dev** panel (**Ctrl+Shift+D**) to confirm `db.save` events while testing — see `docs/LIVE_DEV.md`. Update `src/lib/devChangelog.ts` when shipping.

### New feature (any screen)

1. Add persistence + **`db` method** in the right `src/lib/db/domains/*.ts` module (or `dbCore.ts` for load/save/trim only), with sync if embedding users/posts.  
2. Add row to `src/lib/appDataTasks.ts` and this file’s tables.  
3. UI: `useDB()` + resolvers; ids into modals.  
4. Lint + cross-screen smoke.  
5. Append **Shipped** notes + test hints to `src/lib/devChangelog.ts`; log behavior in the Live dev panel during manual QA.

---

## Per-file checklist

- [ ] User task mapped to `db` method in catalog  
- [ ] `useDB()` if displaying store data  
- [ ] `resolvePost` / `resolveReel` / `resolveUser` / `resolveCommentAuthor` for entities  
- [ ] Comments: `buildCommentPayload`  
- [ ] Modals: `postId` / `userId`, resolve inside  
- [ ] No duplicate engagement state in React state  

---

## Key files

| Purpose | Path |
|--------|------|
| Store + sync | `src/lib/db.ts`, `src/lib/db/README.md`, `src/lib/db/localDb.ts`, `src/lib/db/dbCore.ts`, `src/lib/db/domains/`, `src/lib/db/layers.ts` |
| Task catalog | `src/lib/appDataTasks.ts` |
| Resolvers | `src/lib/entityResolve.ts` |
| Hooks | `src/lib/useDB.ts` |
| Cursor rule | `.cursor/rules/data-sync.mdc` |

---

## Stability (every task)

Before merging or saying a task is done:

```bash
npm run verify
```

Runs typecheck, ESLint, production build, and `check:health` (line limits + `db.ts` integrity). See **`docs/STABILITY.md`**.

- **Do not** run `scripts/split-db.mjs` / `restore-db-monolith.mjs` without a git checkpoint — see **`scripts/README.md`**.
- **Split large screens** by UI section (handlers stay in parent); avoid new 1500+ line files.
- **CI:** `.github/workflows/ci.yml` runs `verify` on push/PR to `main` / `master`.

## Verify

```bash
npm run verify
```

(Or `npm run lint` for a faster typecheck + ESLint only.)

**Cross-screen smoke (by task type):**

| Task | Check |
|------|--------|
| Follow | Profile → feed header / preview / notifications row |
| Post like/save | Feed ↔ PostModal ↔ profile grid hover |
| Post comment | Card count ↔ modal ↔ `post_comments` thread |
| Comment like | PostModal heart ↔ count |
| Reel like/save | Reels sidebar after scroll away |
| Story view | Ring state after watching |
| Message send | Thread + unread badge |
| Share post/reel link | Messages fullscreen author/thumbnail |
| Create post | Appears on feed with live author |
| Profile edit | Avatar/name on posts, comments, notifications |
| Workspace task | Toggle persists on tab switch |
