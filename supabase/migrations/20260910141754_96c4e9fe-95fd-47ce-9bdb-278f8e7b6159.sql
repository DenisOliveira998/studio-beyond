REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_profile(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_application(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_work(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.donation_totals() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_totals() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_work_view(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_profile(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_application(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_work(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.donation_totals() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_totals() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_work_view(text) TO anon, authenticated;