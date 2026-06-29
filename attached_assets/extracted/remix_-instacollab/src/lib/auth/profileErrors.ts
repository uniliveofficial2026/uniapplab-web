/** Map Supabase/Postgres profile errors to actionable messages. */
export function mapProfileSaveError(err: unknown): Error {
  const raw =
    err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);
  const code =
    err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
      ? err.code
      : '';
  const details =
    err && typeof err === 'object' && 'details' in err && typeof err.details === 'string'
      ? err.details
      : '';
  const blob = `${raw} ${details}`.toLowerCase();

  if (code === '23505' || /duplicate key|unique constraint/i.test(blob)) {
    if (/public_user_id|profiles_public_user_id/i.test(blob)) {
      return new Error('User ID is already taken. Choose another.');
    }
    if (/username|profiles_username/i.test(blob)) {
      return new Error('Username is already taken. Choose another.');
    }
    return new Error('Username or User ID is already taken.');
  }

  if (
    /could not find the table.*profiles|table ['"]?public\.profiles['"]?.*schema cache|pgrst205/i.test(
      blob
    )
  ) {
    return new Error(
      'Cloud database is missing the profiles table. In your terminal run: npm run auth:bootstrap-db — then paste and Run the SQL in Supabase.'
    );
  }

  if (
    /public_user_id.*does not exist|column.*public_user_id/i.test(blob) &&
    /public_user_id/i.test(blob)
  ) {
    return new Error(
      'Cloud database is missing profile columns. Run: npm run auth:bootstrap-db'
    );
  }

  if (/schema cache/i.test(blob)) {
    return new Error(
      'Cloud database schema is out of date. Run: npm run auth:bootstrap-db — then hard-refresh the app.'
    );
  }

  if (code === '42501' || /permission denied|row-level security|rls/i.test(blob)) {
    return new Error('Not signed in to your cloud account. Log out, sign in again, then save.');
  }

  if (/jwt expired|invalid jwt|session.*expired/i.test(blob)) {
    return new Error('Session expired. Log out, sign in again, then save your profile.');
  }

  if (/payload too large|entity too large|request size/i.test(blob)) {
    return new Error(
      'Profile photo is too large to upload. Use a smaller image or paste an image URL instead.'
    );
  }

  if (/network|fetch failed|failed to fetch/i.test(blob)) {
    return new Error('Network error while saving. Check your connection and try again.');
  }

  return new Error(raw || 'Could not save profile');
}
