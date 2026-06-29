# Stability guide

How to keep InstaCollab reliable while adding features — for humans and coding agents.

## Before you finish any change

```bash
npm run verify
```

This runs TypeScript (`strict`), ESLint, production build, and health checks (including `db.ts` structure and file-size guardrails).

## Data layer (non-negotiable)

1. **Writes** go through `db.*` methods — see [AGENTS.md](../AGENTS.md) and [src/lib/appDataTasks.ts](../src/lib/appDataTasks.ts).
2. **Reads** use `useDB()` plus `resolve*` / hooks — never duplicate likes, saves, or user snapshots in component state.
3. **Do not** run `scripts/split-db.mjs` or `scripts/restore-db-monolith.mjs` unless you have a committed backup and a clear recovery plan ([scripts/README.md](../scripts/README.md)).
4. **DB entrypoint** — import `db` from `src/lib/db.ts` (re-exports the composed singleton). Implementation is split under `src/lib/db/` (see below). **Type** for `db` / `LocalDB` is `src/lib/db/localDbType.ts` (`DbCore` + `ComposedDbLayers` from `layers.ts`).
5. **Helpers without `this`** — `src/lib/dbMessageUtils.ts`, `dbRetention.ts`, `dbStorageStats.ts`.
6. **Do not re-run** `scripts/archive/split-db-domains.mjs` without restoring `db.monolith.ts` first — it overwrites generated modules.

## UI / file size (IDE and reviewability)

Large single files slow the editor and invite merge mistakes. Current policy (enforced by `npm run check:health`):

| Kind | Warn | Hard fail |
|------|------|-----------|
| New / typical `src/**/*.ts(x)` | 900 lines | 1500 lines |
| `MessagesScreen.tsx` | 3000 | 3500 |
| `PostModal.tsx` / `ProfileScreen.tsx` | 1800 | 2200 (grandfathered — split when touching) |
| `Shell.tsx` | 1400 | 2000 |
| `db.monolith.ts` (reference backup only) | 3700 | 5000 |
| `db/dbCore.ts` + `db/domains/*` | 900 | 1500 (per file) |

When a screen outgrows the warn threshold, split by **UI section** (as Messages did: sidebar, header, thread, compose) — not by copy-pasting state into new files without passing props from the parent.

## Split layouts (reference)

### Messages

```
src/components/messages/
  MessagesScreen.tsx      # state + handlers + modals
  MessagesSidebar.tsx
  MessagesChatHeader.tsx
  MessagesChatThread.tsx
  MessagesComposeBar.tsx
  messages/               # types, search, unread helpers
```

New chat features: add handlers in `MessagesScreen`, UI in the smallest child that fits.

### Database (`src/lib/db/`)

```
src/lib/db.ts                 # export { db }; type LocalDB
src/lib/db.monolith.ts        # full-class reference backup (do not import at runtime)
src/lib/db/localDbType.ts     # exported LocalDB type
src/lib/db/layers.ts          # per-domain API interfaces
src/lib/db/localDb.ts         # mixin composition + db singleton
src/lib/db/dbCore.ts          # IDB, load/save, retention, trim, storage stats
src/lib/db/constants.ts       # shared storage keys / caps
src/lib/db/domains/
  authPosts.ts                # users, posts, likes/saves, syncUserRefs
  followBlocked.ts
  profile.ts                  # visits, premium, creator progress
  workspaceTasks.ts / workspaceFiles.ts
  reels.ts
  notifications.ts
  messages.ts
  stories.ts
  settings.ts
  cloud.ts
  uiFlags.ts
  comments.ts                 # post + reel comment threads
```

Add domain methods in the matching `domains/*.ts` file; persistence helpers stay in `dbCore.ts`. See **`src/lib/db/README.md`** for mixin order, `asLocalDB()` rules, and file map.

### Profile

```
src/components/profile/
  ProfileScreen.tsx           # tabs, grid, header, modals orchestration
  ProfileEditSettingsModal.tsx
  ProfileCloudSystemsModal.tsx
  ProfileReelModal.tsx
  ProfileTabEmpty.tsx
```

### Shell (create flow)

```
src/components/layout/
  Shell.tsx
  ShellCreateModal.tsx
  ShellCreatePostEditor.tsx
  ShellCreateCaptionPanel.tsx
  ShellCreateCrossPostModal.tsx
```

### Feed / reels (when touching large files)

```
src/components/feed/PostModal.tsx + PostModalCommentItem.tsx
src/components/feed/Post.tsx + PostContentFullscreenPortal.tsx
src/components/feed/StoryRing.tsx + StoryRingPortals.tsx
src/components/reels/ReelsScreen.tsx + ReelsCommentsDrawer.tsx
```

## Manual QA (quick)

| Area | Check |
|------|--------|
| Feed | Like/save survives opening PostModal |
| Messages | Send, inline video, shared post/reel link |
| Profile | Edit name/avatar updates feed + comments |
| Reels | Like after scrolling away |

Optional: **Ctrl+Shift+D** Live dev panel — [LIVE_DEV.md](./LIVE_DEV.md).

## CI

Pushes and PRs to `main` / `master` run the same `npm run verify` via GitHub Actions (`.github/workflows/ci.yml`).

## When something breaks

1. Run `npm run verify` and fix the first error.
2. If `db.ts` fails integrity checks, restore from git — do not stack more transform scripts.
3. For playback regressions, see `src/lib/playbackScope.ts` and chat `ChatInlineVideo`.
