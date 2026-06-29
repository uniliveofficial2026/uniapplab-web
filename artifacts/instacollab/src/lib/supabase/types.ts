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
  created_at?: string;
  updated_at?: string;
};
