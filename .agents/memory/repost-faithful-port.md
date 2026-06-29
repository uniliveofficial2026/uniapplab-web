---
name: Repost feature & faithful-port directive
description: How InstaCollab's repost feature is modeled, and the user's strict "use my exact code" rule.
---

## Repost data model
A repost is a `Post` with `imageUrl: ''` plus:
- `repost?: Post` — the embedded original post (author, media, caption, text overlay).
- `reposts?: number` — repost count on the post being reposted.

Creation happens in `components/feed/RepostModal.tsx` (`db.addPost` new wrapper post + `db.updatePost` to bump the original's `reposts`). Rendering: a repost block replaces normal media in `Post.tsx` (feed card) and in `PostModal.tsx` (desktop + mobile media areas). The footer `Repeat` button (lucide) in `PostCardFooter.tsx` opens the modal and shows `reposts` count.

NOT the model: a flat `repostedBy?: User` snapshot — that was an earlier wrong invention and was reverted.

## "Share a thought" = the custom thought bubble (Notes)
"Share a thought" is the custom thought-bubble / Notes feature keyed on `User.note` — NOT a feed text composer. Do NOT build a separate feed composer for it.

The user's source-of-truth version lives in their ZIP `components/feed/StoryRing.tsx`: a glass thought bubble anchored to the story-ring avatar (`absolute bottom-[85%] left-[70%]`), shown for any user with a non-empty note, plus a dashed-circle "+ Add a thought…" empty-state affordance for the current user. Tapping opens a note-edit modal (current user) or a read-only preview modal (others), both portal-rendered glass bubbles with `db.updateUser(id, u => ({...u, note}))`.

The app's current `StoryRing.tsx` is a heavily refactored variant (uses `ringShell`, `StoryRingPortals`, `AvatarStatusBadge`, draws its own avatar `<img>`) that had DROPPED the thought bubble. `Avatar.tsx` still has a note bubble but only renders when a note already exists (`size !== 'sm'`) with no empty-state "+" affordance, and the story strip uses `StoryRing` (not `Avatar`), so the bubble was invisible there. Fix was to graft the user's verbatim bubble + modals into the current `StoryRing` (mapping `userFromDb = storyUser`), preserving the refactored story system.

## Faithful-port rule (strong user preference)
**Rule:** When the user says "use exactly my code/layout, do not change it," reproduce their source verbatim even if it has imperfections (e.g. feed repost block intentionally renders only image+overlay, not video; RepostModal uses `||` overlay-style fallbacks). Do NOT apply code-review "improvements" that deviate from their source.

**Why:** The user was repeatedly frustrated when their existing feature was re-created/altered instead of ported as-is. Their source ZIP is the source of truth.

**How to apply:** For repost/notes (and similar "port my code" requests), copy from the user's provided source. Architect review findings that suggest deviating from that source should be declined when they conflict with the verbatim-port directive.

## Thought bubble + modals are DUPLICATED — keep in sync
The thought bubble and BOTH modals — edit/compose (`showNoteModal`) and view/preview (`showPreviewModal`) — exist in TWO files: `components/feed/StoryRing.tsx` (feed story strip) and `components/common/Avatar.tsx` (avatars elsewhere). Any change to one must be mirrored in the other or behavior diverges. Pre-existing divergence (left as-is for faithful port): StoryRing's `showNoteModal` renders inline at `z-[200]`; Avatar's uses `createPortal` at `z-[9999]`.

Tap routing: current user's bubble → edit modal; other users' bubble → preview modal. So testing with your OWN note only ever opens the edit modal.

**Authorized deviation (scope matters):** user wanted ONLY the read/VIEW of a thought (tap a user's bubble -> `showPreviewModal`) to be a full-screen story-style viewer to read the full text. The thought CREATION/EDIT screen (`showNoteModal`) must STAY the original 320px card. Mistake made earlier: full-screening the edit modal too -> user frustrated. Only `showPreviewModal` is full-screen (`w-full h-full`, `overflow-hidden` root, body `flex-1 ... justify-center overflow-y-auto`).
