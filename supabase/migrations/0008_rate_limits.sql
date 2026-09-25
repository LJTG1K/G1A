-- Per-user rate limiting for actions that hit Google (reading sheets).
create table public.rate_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  at timestamptz not null default now()
);
create index rate_events_lookup on public.rate_events (user_id, kind, at desc);
alter table public.rate_events enable row level security;
-- No policies: only take_rate_token (security definer) touches this table.

/**
 * Records one event for the calling user and returns true if they're still within
 * p_max events per p_window. Old rows for that user/kind are pruned as it goes.
 */
create function public.take_rate_token(p_kind text, p_max integer, p_window interval)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  used integer;
begin
  if uid is null then
    return false;
  end if;
  delete from public.rate_events where user_id = uid and kind = p_kind and at < now() - p_window;
  select count(*) into used from public.rate_events where user_id = uid and kind = p_kind;
  if used >= p_max then
    return false;
  end if;
  insert into public.rate_events (user_id, kind) values (uid, p_kind);
  return true;
end;
$$;
revoke execute on function public.take_rate_token(text, integer, interval) from public, anon;
grant execute on function public.take_rate_token(text, integer, interval) to authenticated;
