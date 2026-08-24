import type { AuthUser, ProfileRecord } from "../lib/supabase";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      profile?: ProfileRecord | null;
      traceId?: string;
      perfStartNs?: bigint;
      perfSpans?: Record<string, { startNs: bigint; durMs?: number }>;
    }
  }
}

export {};
