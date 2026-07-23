# Codebase audit task proposals

This audit proposes four narrowly scoped follow-up tasks found during a repository pass on 2026-07-23. The tasks are scoped as proposals only; implementation should happen in separate changes so each can be reviewed and tested independently.

## 1. Typo fix: withdrawal success animation class

**Task:** Correct the success-message animation class in `WithdrawTab` from `face-in` to `fade-in`.

**Evidence:** The withdrawal form uses Tailwind-style animation utilities, but the success message currently declares `animate-in face-in duration-300`, while nearby code and common usage indicate `fade-in` is the intended class.

**Suggested acceptance criteria:**

- The success message keeps its current visual timing.
- The class name is corrected to `fade-in`.
- The withdrawal UI still typechecks.

## 2. Bug fix: karaoke profile share fallback can encode an undefined user id

**Task:** Harden `buildProfileSharePayloadFromUser` so the karaoke-profile share URL cannot fall back to `/k/u/id/undefined` when both `user.id` and a usable handle are unavailable.

**Evidence:** In the karaoke branch, the `shareUrl` ternary falls back to `/k/u/id/${encodeURIComponent(user.id)}` even though that branch is only reached after the `user.id` condition is false. If a malformed caller passes an empty id and empty handle, the generated URL becomes invalid rather than failing clearly or choosing a safe username fallback.

**Suggested acceptance criteria:**

- Empty/blank `id` values are trimmed and rejected before building an id-based URL.
- A handle/username fallback is used when valid.
- If no stable profile identifier exists, the function fails explicitly or returns a safe non-profile fallback.

## 3. Comment/documentation discrepancy: withdrawal fee wording

**Task:** Align the withdrawal-fee comment and user-facing copy in `WithdrawTab`.

**Evidence:** The code comment calls the $1.50 charge a flat processing fee, the pricing breakdown labels it a flat transaction processing fee, and the success message calls it a regulatory handling fee. These labels describe the same deduction but imply different purposes.

**Suggested acceptance criteria:**

- The comment, pricing label, and success message use the same fee name.
- The chosen wording avoids implying regulatory status unless a real compliance requirement exists.
- The displayed net amount remains unchanged.

## 4. Test improvement: share-link parsing coverage

**Task:** Add unit coverage for `extractShareUrl` and `parseShareLink` in `shareLinks`.

**Evidence:** Share-link parsing has many branches for posts, reels, stories, profiles, live rooms, karaoke tracks, karaoke profiles, legacy hosts, query-string variants, and hash-based karaoke room links, but the repository currently has no dedicated test file for this module.

**Suggested acceptance criteria:**

- Add representative positive cases for `/p/`, `/r/`, `/s/?seg=`, `/k/t/?recording=`, `/k/u/id/`, `/k/u/`, and `#karaoke-room/` links.
- Add negative cases for unsupported hosts and malformed URLs.
- Include a regression case for the karaoke profile fallback behavior described above once fixed.

## Source files reviewed

- `artifacts/instacollab/src/components/wallet/WithdrawTab.tsx`
- `artifacts/instacollab/src/lib/shareLinks.ts`
- `package.json`
- `artifacts/instacollab/package.json`
