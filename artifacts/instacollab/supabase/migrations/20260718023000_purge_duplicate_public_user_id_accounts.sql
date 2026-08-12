-- Hard purge duplicate public User ID accounts (keep oldest per identity).

WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY lower(public_user_id)
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.profiles
  WHERE public_user_id IS NOT NULL AND public_user_id <> ''
),
losers AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.profiles p
USING losers l
WHERE p.id = l.id;

WITH cross_hits AS (
  SELECT a.id AS loser_id
  FROM public.profiles a
  JOIN public.profiles b
    ON a.id <> b.id
   AND a.public_user_id IS NOT NULL AND a.public_user_id <> ''
   AND lower(a.public_user_id) = lower(b.username)
   AND coalesce(a.created_at, 'infinity'::timestamptz) >= coalesce(b.created_at, '-infinity'::timestamptz)
)
DELETE FROM public.profiles p
USING cross_hits c
WHERE p.id = c.loser_id;

UPDATE public.profiles p
SET public_user_id = lower(p.username),
    public_user_id_changed_at = coalesce(p.public_user_id_changed_at, now())
WHERE (p.public_user_id IS NULL OR p.public_user_id = '')
  AND p.username IS NOT NULL AND length(trim(p.username)) >= 3
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles o
    WHERE o.id <> p.id
      AND o.public_user_id IS NOT NULL AND o.public_user_id <> ''
      AND lower(o.public_user_id) = lower(p.username)
  );

CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_user_id_key
  ON public.profiles (public_user_id)
  WHERE public_user_id IS NOT NULL AND public_user_id <> '';
