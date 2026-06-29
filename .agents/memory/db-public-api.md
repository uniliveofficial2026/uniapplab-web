---
name: InstaCollab db.load/save public API
description: DbCore.load and DbCore.save were changed from protected to public to support new screens from second ZIP port.
---

`protected load<T>` and `protected save` in `artifacts/instacollab/src/lib/db/dbCore.ts` were changed to `public` so new screens (wallet tabs, games, workspace) can call `db.load(key, default)` and `db.save(key, data)` directly on the instance returned by `useDB()`.

**Why:** New screens from the second ZIP port were designed to use these methods publicly, but the existing DbCore declared them protected (internal use only). Making them public is safe — all existing internal `this.load()/this.save()` calls are unchanged.

**How to apply:** Any new screen that needs to read/write arbitrary storage keys can call `db.load(key, defaultValue)` and `db.save(key, data)` directly.
