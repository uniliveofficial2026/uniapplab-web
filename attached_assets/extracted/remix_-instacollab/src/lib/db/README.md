# Local database (`src/lib/db/`)

In-memory + IndexedDB store composed from `DbCore` and domain mixins. The app imports **`db`** and **`LocalDB`** from [`../db.ts`](../db.ts) only — not from this folder directly unless you are editing the store.

## Layout

| File | Responsibility |
|------|----------------|
| [`localDb.ts`](localDb.ts) | Mixin chain + `export const db` |
| [`localDbType.ts`](localDbType.ts) | `export type LocalDB = InstanceType<typeof DbCore> & ComposedDbLayers` |
| [`layers.ts`](layers.ts) | Public API shape per domain (`*Layer` interfaces) |
| [`dbCore.ts`](dbCore.ts) | IDB, `load` / `save`, retention, trim, storage stats, `clearCache` |
| [`mixin.ts`](mixin.ts) | `Constructor`, `MixinCtor`, `DbCoreBacked` |
| [`startupHost.ts`](startupHost.ts) | Methods `DbCore` calls in `initPromise` before full compose is on `this` |
| [`constants.ts`](constants.ts) | Shared storage keys / caps used across domains |
| [`domains/*.ts`](domains/) | One mixin per feature area (`WithAuthPosts`, …) |
| [`../db.monolith.ts`](../db.monolith.ts) | **Backup reference only** — do not import at runtime |

Helpers without `this`: [`../dbMessageUtils.ts`](../dbMessageUtils.ts), [`../dbRetention.ts`](../dbRetention.ts), [`../dbStorageStats.ts`](../dbStorageStats.ts).

## Mixin order (do not reorder casually)

Outermost mixin is applied last. Order in [`localDb.ts`](localDb.ts) must stay in sync with [`layers.ts`](layers.ts) `ComposedDbLayers` intersection:

```
DbCore
  → WithAuthPosts
  → WithFollowBlocked
  → WithProfile
  → WithWorkspaceTasks
  → WithReels
  → WithNotifications
  → WithWorkspaceFiles
  → WithMessages
  → WithStories
  → WithSettings
  → WithCloud
  → WithComments
  → WithUiFlags   ← outermost
```

If mixin **A** is applied before **B**, code in **A** cannot call `this.<method from B>()` — use **`this.asLocalDB().<method>()`** instead (typed as full `LocalDB`).

## Where to add code

| Change | Put it in |
|--------|-----------|
| New collection / `load`+`save` key, retention, IDB sync | [`dbCore.ts`](dbCore.ts) |
| Posts, users, login, post/reel like-save on feed entities | [`domains/authPosts.ts`](domains/authPosts.ts) |
| Follow graph, block list | [`domains/followBlocked.ts`](domains/followBlocked.ts) |
| Profile visits, premium, creator progress | [`domains/profile.ts`](domains/profile.ts) |
| Workspace tasks / audit | [`domains/workspaceTasks.ts`](domains/workspaceTasks.ts) |
| Workspace files | [`domains/workspaceFiles.ts`](domains/workspaceFiles.ts) |
| Reels CRUD | [`domains/reels.ts`](domains/reels.ts) |
| In-app notifications | [`domains/notifications.ts`](domains/notifications.ts) |
| Chats, presence, wallpapers | [`domains/messages.ts`](domains/messages.ts) |
| Stories, story views, demo strip | [`domains/stories.ts`](domains/stories.ts) |
| App settings | [`domains/settings.ts`](domains/settings.ts) |
| Cloud backup / sync | [`domains/cloud.ts`](domains/cloud.ts) |
| Post + reel comment threads | [`domains/comments.ts`](domains/comments.ts) |
| Global mute, fullscreen, unread badges | [`domains/uiFlags.ts`](domains/uiFlags.ts) |

After adding or changing public methods:

1. Extend the matching `*Layer` interface in [`layers.ts`](layers.ts) (and any cross-domain callers that use `asLocalDB()`).
2. Register the task in [`../appDataTasks.ts`](../appDataTasks.ts) and [AGENTS.md](../../AGENTS.md).
3. Run `npm run verify`.

## Mixin conventions

- Each domain exports `WithXxx<T extends Constructor<DbCoreBacked>>(Base: T): MixinCtor<T, XxxLayer>`.
- Mixin class constructors must use `constructor(...args: any[])` (TypeScript [TS2545](https://github.com/microsoft/TypeScript/issues/37143) mixin rule).
- **Same mixin file:** use `this.load`, `this.save`, `this.cappedList`, and private helpers on `this`.
- **Another domain or a later mixin:** use `this.asLocalDB().…` so types match `LocalDB`.
- **DbCore startup** (constructor `initPromise`): cast with `this as unknown as DbCoreStartupHost` or `asLocalDB()` — see [`startupHost.ts`](startupHost.ts).

Return the mixin class as `as unknown as MixinCtor<T, XxxLayer>`.

## Types for app code

```ts
import { db, type LocalDB } from '../db';
```

`LocalDB` is the full composed API. Do not type the app against `db.monolith.ts`.

## Scripts (read before running)

| Script | Safe? |
|--------|--------|
| `npm run verify` | Yes — always |
| `scripts/archive/split-db-domains.mjs` | **No** — overwrites `domains/*` from monolith |
| `scripts/fix-db-mixin-this.mjs` / `revert-db-mixin-local-this.mjs` | Only when re-applying mixin typing fixes |

See [scripts/README.md](../../scripts/README.md) and [docs/STABILITY.md](../../docs/STABILITY.md).

## Related docs

- [AGENTS.md](../../AGENTS.md) — data-sync rules and task catalog
- [docs/STABILITY.md](../../docs/STABILITY.md) — line limits and verify gate
