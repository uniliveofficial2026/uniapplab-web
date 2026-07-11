-- Harden wallet/gift SECURITY DEFINER RPCs: service_role (API) only.
-- Also pin search_path on common trigger helpers.

REVOKE ALL ON FUNCTION public.credit_coins(uuid, bigint, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_coins(uuid, bigint, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_coins(uuid, bigint, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.credit_recharge_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_recharge_order(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_recharge_order(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.credit_wallet_currency(uuid, bigint, text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_wallet_currency(uuid, bigint, text, text, jsonb, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet_currency(uuid, bigint, text, text, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.ensure_wallet(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_wallet(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.settle_gift_send(uuid, uuid, text, text, bigint, integer, integer, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_gift_send(uuid, uuid, text, text, bigint, integer, integer, text, text, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_gift_send(uuid, uuid, text, text, bigint, integer, integer, text, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user_wallet() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_wallet() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.sync_profile_role_to_auth() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profile_role_to_auth() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

ALTER FUNCTION public.set_profiles_updated_at() SET search_path = public;
ALTER FUNCTION public.set_user_app_state_updated_at() SET search_path = public;
ALTER FUNCTION public.profiles_guard_sensitive_columns() SET search_path = public;
ALTER FUNCTION public.set_posts_updated_at() SET search_path = public;
ALTER FUNCTION public.set_party_rooms_updated_at() SET search_path = public;
