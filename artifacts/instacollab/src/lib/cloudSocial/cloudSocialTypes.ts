/** Cloud notification row shape — shared by Supabase + Firebase lanes (no SDK imports). */
export type CloudNotificationRow = {
  id: string;
  user_id: string;
  type: string;
  actor_id: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

/** Profile visit row shape — shared by Supabase + Firebase lanes (no SDK imports). */
export type CloudProfileVisitRow = {
  id: string;
  owner_id: string;
  visitor_id: string;
  surface: string;
  content_id: string | null;
  preview_url: string | null;
  live_kind: string | null;
  visit_count: number;
  visited_at: string;
};
