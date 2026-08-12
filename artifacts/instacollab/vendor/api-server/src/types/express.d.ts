import type { AuthUser, ProfileRecord } from "../lib/supabase";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      profile?: ProfileRecord | null;
    }
  }
}

export {};
