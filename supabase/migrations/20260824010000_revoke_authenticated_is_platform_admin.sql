-- Stage A security: is_platform_admin is service-role only (not PostgREST clients).
revoke execute on function public.is_platform_admin() from authenticated;
revoke execute on function public.is_platform_admin() from anon;
revoke execute on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to service_role;
