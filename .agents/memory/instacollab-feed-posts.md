---
name: InstaCollab feed post model
description: How posts (incl. text posts, reposts, thoughts) are created and rendered in the InstaCollab feed
---

# InstaCollab feed post model

- All feed content is one `Post` type added via `db.addPost(Partial<Post> & {user?})` (in `lib/db/domains/authPosts.ts`), which prepends to the in-memory list. There is no separate "repost" or "thought" entity.
- A post renders as a **text post** (gradient bg + styled text, via `PostMediaStage` `isTextPost`) purely when it has NO media: empty `imageUrl`/`videoUrl` and empty/absent `mediaList`. Text styling fields: `bg`, `font`, `color`, `alignment`, `size`.
- **Repost** = a normal post created by spreading the original, keeping `user` as the original author, setting `repostedBy` to the current user, and resetting engagement (`likes: 0`, `comments: 0`, `isLiked/isSaved/isArchived` false) + new `createdAt`. Post.tsx shows a "reposted" banner when `repostedBy` is set. Repost button (Repeat2) lives in `PostCardFooter`.
- **Share a thought** = feed-level composer in `Feed.tsx` that creates a text-only post (no media) so it routes through the same text-post render path.

**Why:** When reposting via object spread, you MUST reset `likes` and `comments` explicitly — otherwise the repost inherits the original's engagement counts (a real bug caught in review).

**How to apply:** Any new "share/duplicate post" feature should reuse `db.addPost` and reset engagement fields; do not invent new entities or DB methods.
