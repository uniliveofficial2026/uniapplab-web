-- Gift history stores gift_id + ledger amounts only.
-- Display name/image/price come from gift_catalog_items (join), not duplicated blobs.
-- gift_name is kept as a small text snapshot for historical receipts when catalog rows change.

comment on column public.gift_transactions.gift_id is
  'FK-like reference to gift_catalog_items.id — resolve icon/animation/price from catalog';

comment on column public.gift_transactions.gift_name is
  'Display snapshot at send time (catalog name). Do not store image URLs here.';

comment on column public.gift_catalog_items.effect_svga_url is
  'HTTPS URL on Cloudflare R2 (or CDN) — never store binary in Postgres';

comment on column public.gift_catalog_items.effect_video_url is
  'HTTPS URL on Cloudflare R2 (or CDN) — never store binary in Postgres';

comment on column public.gift_catalog_items.preview_url is
  'HTTPS URL on Cloudflare R2 (or CDN)';

comment on column public.gift_catalog_items.animation_url is
  'HTTPS URL on Cloudflare R2 (or CDN)';
