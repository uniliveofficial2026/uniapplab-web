# Live dev testing

Use this while implementing features so you can **see every data change** in the running app.

## Start the app

```bash
npm run dev
```

Or open the browser automatically:

```bash
npm run dev:live
```

Add `?dev=1` to the URL to force the dev panel on first load, e.g. `http://localhost:3000/?dev=1`.

### Stable dev (Cursor agent editing)

If the **browser tab goes white** or **Cursor freezes** while the agent edits files (especially with **Dating** or **Messages** open), use stable dev — HMR and file watching are off so saves do not remount huge screens on every keystroke:

```bash
npm run dev:stable
```

Refresh the browser manually after the agent finishes a batch of edits. For normal day-to-day UI work, `npm run dev` is fine.

Other mitigations in DEV builds:

- `db` notifies subscribers once per animation frame (coalesces burst saves).
- Dating **experiment dashboard** is collapsed and lazy-loaded until you expand it.

## Dev panel (DEV builds only)

| Action | Result |
|--------|--------|
| **Ctrl+Shift+D** | Toggle panel |
| **Live** tab | Stream of `db.save` writes (posts, users, follow_graph, messages, …) |
| **Tasks** tab | Full catalog from `src/lib/appDataTasks.ts` — what to implement / test |
| **Shipped** tab | `src/lib/devChangelog.ts` — recent work + planned items + test hints |
| **State** tab | JSON snapshot: tab, counts, follower graph vs display counts |
| **Test follow toggle** | Quick smoke test for `toggleFollow` |
| **Seed demo stories** | Applies `DEMO_STORY_SEGMENTS` + LIVE statuses for feed/profile rings |
| Console `__devLog('note', 'message')` | Manual log line in Live tab |

The panel is stripped from production builds (`import.meta.env.DEV`).

## When you ship a feature

1. Add a row to **`DEV_CHANGELOG`** in `src/lib/devChangelog.ts` (title, test hints).
2. Add or update tasks in **`src/lib/appDataTasks.ts`**.
3. Summarize in **`AGENTS.md`** smoke list if agents should verify it.

## Data rules (all live tests)

- Writes: `db` methods only (`toggleFollow`, `togglePostLike`, …).
- Reads: `useDB()` + `resolve*` / `useUserById`.
- See **`.cursor/rules/data-sync.mdc`** and **`AGENTS.md`**.
