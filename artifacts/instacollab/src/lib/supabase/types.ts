export type PlatformRole = 'user' | 'streamer' | 'admin';

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  profile_setup_complete: boolean;
  /** User-chosen public ID (letters, numbers, underscores). */
  public_user_id?: string | null;
  public_user_id_changed_at?: string | null;
  role?: PlatformRole;
  banned_at?: string | null;
  ban_reason?: string | null;
  muted_until?: string | null;
  /** Avatar thought bubble text (empty string = no thought). */
  note?: string | null;
  note_updated_at?: string | null;
  created_at?: string;
  updated_at?: string;
};
