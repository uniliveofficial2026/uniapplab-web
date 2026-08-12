# Duplicate assets (recovery 2026-07-30)

## Canonical ID duplicates in seed

Checked during validation. Expected: **none** (registry rejects duplicates when `rejectDuplicateIds` is on).

## Reference duplicates (non-runtime)

Multiple Sun Baby Boy turnaround / view PNGs exist under:
- `unilives_master_source/references/character-master/approved/`
- `unilives_master_source/references/character-master/meshy-input*/`
- `unilives_master_source/references/SUN_BABY_BOY/`

These are **approved reference / input duplicates**, not duplicate runtime canonical IDs.

## Doc package duplicates

`docs/unilives-assets/` ↔ `exports/unilives-migration-phase12-chatgpt-agent-20260723-072913/docs/unilives-assets/`

## Active replacement mapping duplicates

Validation scripts flag duplicate `existingId` **within the same mapping type**.

Cross-type reuse of the same business token (e.g. gift `heart` vs sticker `heart`) is intentional and not treated as a duplicate active mapping.

