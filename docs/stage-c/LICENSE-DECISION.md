# License Decision (Stage C)

**Status: PENDING — no license has been decided or assigned.**

## Policy

Stage C documentation and package inventory **must not invent or assume a license**. Until a decision is recorded here and reflected in each package's `package.json` `license` field:

- All `@unilives/*` packages remain `"private": true` in the workspace
- **No public npm publish** — classified as `RELEASE_READY_EXTERNAL_STEP` in `24-UNRESOLVED.md`
- **No SPDX strings** added to package.json without explicit approval
- **No LICENSE file** copied into packages without explicit approval

## What needs deciding

| Question | Options (examples — not chosen) | Status |
|---|---|---|
| Platform packages (`@unilives/*`) | MIT, Apache-2.0, proprietary, dual-license | **UNDECIDED** |
| Reference app (`artifacts/instacollab`) | Proprietary, separate repo, open core | **UNDECIDED** |
| `@workspace/unilives-asset-studio` | Same as platform or separate | **UNDECIDED** |
| Contributor terms | CLA, DCO, none | **UNDECIDED** |
| Patent / attribution | Standard OSS patent grant vs custom | **UNDECIDED** |

## Recommended publish order (after license decided)

1. `@unilives/rtc-contracts` — pure types, no provider deps
2. `@unilives/rtc-core`, `rtc-client`, `rtc-server`
3. `@unilives/rtc-livekit` — optional peer dep on `livekit-client`
4. `@unilives/platform-core`, `sdk`
5. Tooling: `mcp`, `cli`
6. Boundary adapters: `auth`, `database`, `storage`, `realtime`, `deploy`, `git`, `observe`

**Exclude from initial publish:** `@unilives/rtc-fake` (internal test double), `@unilives/ui` (registry only, no components).

## What stays proprietary (likely)

Per `19-OPEN-SOURCE-BOUNDARIES.md`:

- Reference app UI, assets, brand stickers/gifts
- Visual baseline snapshots
- Production deployment configs with secrets

Final decision required — above is architectural guidance, not a license assignment.

## Action required

A human decision must update this file with:

1. Chosen SPDX identifier(s)
2. Scope (which packages, which repos)
3. Date and approver
4. Follow-up: add LICENSE files + package.json `license` fields in a dedicated slice

Until then, Stage C productization proceeds with **documentation and code quality only** — not public release.

## Related

- `24-UNRESOLVED.md` — license blocks npm publish
- `25-FINAL-ACCEPTANCE.md` — license item unchecked
- `02-PACKAGE-MAP.md` — **PUBLIC_READY** classification pending license
