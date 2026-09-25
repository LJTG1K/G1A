-- The sign-up trigger function should never be callable over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- is_admin() is used by RLS policies for signed-in users; it only reveals the caller's own flag.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
-- admin_emails is intentionally unreadable over the API (no policies); the trigger reads it as definer.
