export type AuthResult =
  | { ok: true; redirecting?: boolean }
  | { ok: false; reason: string };

export type AuthBackend = 'supabase' | 'firebase';
