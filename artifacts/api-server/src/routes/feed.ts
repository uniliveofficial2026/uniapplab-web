import { Router, type IRouter } from "express";
import { getSupabaseAnon } from "../lib/supabase";
import { getCachedFeedPosts, setCachedFeedPosts } from "../lib/upstash";

const router: IRouter = Router();

router.get("/feed/posts", async (_req, res) => {
  try {
    const cached = await getCachedFeedPosts();
    if (cached) {
      const posts =
        typeof cached === "string"
          ? (JSON.parse(cached) as unknown[])
          : cached;
      res.json({ posts, cached: true });
      return;
    }

    const supabase = getSupabaseAnon();
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
