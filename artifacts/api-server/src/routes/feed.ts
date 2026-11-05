import { Router, type IRouter } from "express";
import { getSupabaseAnon } from "../lib/supabase";
import { getCachedFeedPosts, setCachedFeedPosts } from "../lib/upstash";

const router: IRouter = Router();

type FeedPostRow = {
  author_id?: unknown;
};

function parseCachedPosts(cached: unknown): unknown[] {
  if (typeof cached === "string") return JSON.parse(cached) as unknown[];
  return Array.isArray(cached) ? cached : [];
}

function cachedAuthorIds(posts: unknown[]): string[] {
  const ids = posts
    .map((post) => (post as FeedPostRow | null)?.author_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return [...new Set(ids)];
}

async function filterPrivateAuthorPosts(
  supabase: ReturnType<typeof getSupabaseAnon>,
  posts: unknown[],
): Promise<unknown[] | null> {
  const authorIds = cachedAuthorIds(posts);
  if (authorIds.length === 0) return posts;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, is_private")
    .in("id", authorIds);

  if (error) return null;

  const privateAuthors = new Set(
    (data ?? [])
      .filter((profile) => profile.is_private === true)
      .map((profile) => profile.id as string),
  );

  return posts.filter((post) => {
    const authorId = (post as FeedPostRow | null)?.author_id;
    return typeof authorId !== "string" || !privateAuthors.has(authorId);
  });
}

router.get("/feed/posts", async (_req, res) => {
  try {
    const supabase = getSupabaseAnon();
    const cached = await getCachedFeedPosts();
    if (cached) {
      const posts = parseCachedPosts(cached);
      const visiblePosts = await filterPrivateAuthorPosts(supabase, posts);
      if (visiblePosts) {
        res.json({ posts: visiblePosts, cached: true });
        return;
      }
    }

    const { data, error } = await supabase
      .from("posts")
      .select("id, author_id, payload, is_archived, created_at")
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      if (/relation.*posts.*does not exist/i.test(error.message)) {
        res.status(503).json({ error: "posts_table_missing", posts: [] });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    const posts = data ?? [];
    await setCachedFeedPosts(posts, 60);
    res.json({ posts, cached: false });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "feed_fetch_failed",
    });
  }
});

export default router;
