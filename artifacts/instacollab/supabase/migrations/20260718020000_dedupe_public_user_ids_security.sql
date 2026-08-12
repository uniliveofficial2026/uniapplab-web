-- Security: one account → one public User ID.
-- Deduplicate collisions, fill blanks, and reject future cross-identity reuse.

-- 1) Fill empty public_user_id from username when free.
UPDATE public.profiles p
SET
  public_user_id = lower(p.username),
  public_user_id_changed_at = coalesce(p.public_user_id_changed_at, now())
WHERE (p.public_user_id IS NULL OR p.public_user_id = '')
  AND p.username IS NOT NULL
  AND length(trim(p.username)) >= 3
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles o
    WHERE o.id <> p.id
      AND o.public_user_id IS NOT NULL
      AND o.public_user_id <> ''
      AND lower(o.public_user_id) = lower(p.username)
  );

-- 2) Exact duplicate public_user_id: keep oldest row, reassign the rest.
WITH ranked AS (
  SELECT
    id,
    public_user_id,
    created_at,
    row_number() OVER (
      PARTITION BY lower(public_user_id)
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.profiles
  WHERE public_user_id IS NOT NULL AND public_user_id <> ''
)
UPDATE public.profiles p
SET
  public_user_id = lower(
    left(
      regexp_replace(coalesce(nullif(p.public_user_id, ''), p.username, 'user'), '[^a-z0-9_]', '_', 'g'),
      17
    ) || '_' || left(replace(p.id::text, '-', ''), 6)
  ),
  public_user_id_changed_at = now()
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- 3) Cross collision: profile A.public_user_id = profile B.username (different ids).
-- Keep the older claim; reassign the newer profile's public_user_id.
WITH cross_hits AS (
  SELECT
    a.id AS loser_id,
    a.public_user_id AS claimed,
    a.created_at AS a_created,
    b.created_at AS b_created
  FROM public.profiles a
  JOIN public.profiles b
    ON a.id <> b.id
   AND a.public_user_id IS NOT NULL
   AND a.public_user_id <> ''
   AND lower(a.public_user_id) = lower(b.username)
)
UPDATE public.profiles p
SET
  public_user_id = lower(
    left(
      regexp_replace(coalesce(nullif(p.public_user_id, ''), p.username, 'user'), '[^a-z0-9_]', '_', 'g'),
      17
    ) || '_' || left(replace(p.id::text, '-', ''), 6)
  ),
  public_user_id_changed_at = now()
FROM cross_hits c
WHERE p.id = c.loser_id
  AND coalesce(c.a_created, 'infinity'::timestamptz) >= coalesce(c.b_created, '-infinity'::timestamptz);

-- If A is older than B, B's username equals A's public id — rename B's public_user_id if it equals that username,
-- otherwise leave B username (unique) and force A's public to stay; already handled when A is loser.
-- When B is newer and username equals A's public: no change to A; B may also have public_user_id set to something else.
-- Additional pass: any remaining public_user_id that equals another username on a newer row was fixed above.
-- One more pass for when the username-holder is newer: reassign the public_user_id holder if they are newer (done).
-- When username-holder is older and public-holder is older too? covered by >= .

-- 4) Ensure unique indexes exist.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_user_id_key
  ON public.profiles (public_user_id)
  WHERE public_user_id IS NOT NULL AND public_user_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key
  ON public.profiles (username);

-- 5) Trigger: reject inserts/updates that steal another account's User ID or username identity.
CREATE OR REPLACE FUNCTION public.enforce_unique_public_user_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
BEGIN
  IF NEW.public_user_id IS NULL OR btrim(NEW.public_user_id) = '' THEN
    NEW.public_user_id := lower(regexp_replace(coalesce(NEW.username, ''), '[^a-z0-9_]', '_', 'g'));
  ELSE
    NEW.public_user_id := lower(NEW.public_user_id);
  END IF;

  normalized := NEW.public_user_id;

  IF normalized IS NULL OR length(normalized) < 3 THEN
    normalized := 'user_' || left(replace(NEW.id::text, '-', ''), 8);
    NEW.public_user_id := normalized;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles o
    WHERE o.id IS DISTINCT FROM NEW.id
      AND o.public_user_id IS NOT NULL
      AND o.public_user_id <> ''
      AND lower(o.public_user_id) = normalized
  ) THEN
    RAISE EXCEPTION 'public_user_id_taken:%', normalized
      USING ERRCODE = 'unique_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles o
    WHERE o.id IS DISTINCT FROM NEW.id
      AND lower(o.username) = normalized
  ) THEN
    RAISE EXCEPTION 'public_user_id_taken_as_username:%', normalized
      USING ERRCODE = 'unique_violation';
  END IF;

  IF NEW.username IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles o
    WHERE o.id IS DISTINCT FROM NEW.id
      AND o.public_user_id IS NOT NULL
      AND o.public_user_id <> ''
      AND lower(o.public_user_id) = lower(NEW.username)
  ) THEN
    RAISE EXCEPTION 'username_taken_as_public_user_id:%', NEW.username
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_unique_public_user_identity ON public.profiles;
CREATE TRIGGER trg_enforce_unique_public_user_identity
  BEFORE INSERT OR UPDATE OF public_user_id, username
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_unique_public_user_identity();

-- 6) One-shot report helper for operators.
CREATE OR REPLACE FUNCTION public.audit_duplicate_public_user_ids()
RETURNS TABLE(identity text, account_count integer, account_ids text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lower(public_user_id) AS identity,
    count(*)::integer AS account_count,
    array_agg(id::text ORDER BY created_at) AS account_ids
  FROM public.profiles
  WHERE public_user_id IS NOT NULL AND public_user_id <> ''
  GROUP BY lower(public_user_id)
  HAVING count(*) > 1;
$$;

REVOKE ALL ON FUNCTION public.audit_duplicate_public_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_duplicate_public_user_ids() TO service_role;
