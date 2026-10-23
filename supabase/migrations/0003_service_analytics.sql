-- Scheduled jobs (alert sweep, weekly summary) run as the service role, which has no user and therefore no "manager" role.
-- They must still see the views, and they always filter by organisation themselves.
create or replace function public.can_see_analytics() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(public.auth_role() = 'manager', false)
       or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
       or current_setting('role', true) = 'service_role' $$;
