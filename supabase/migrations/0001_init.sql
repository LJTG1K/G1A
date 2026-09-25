-- G1A initial schema.
-- Shared tables (sources, snapshots, listings, presets) are written only by the server
-- using the secret key; users read them. Per-user tables are protected by RLS.

-- ─── Admins & profiles ────────────────────────────────────────────────
create table public.admin_emails (
  email text primary key
);
alter table public.admin_emails enable row level security;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (
    new.id,
    new.email,
    exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email))
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = (select auth.uid())), false);
$$;

-- ─── Sources (one row per sheet tab, shared) ──────────────────────────
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  sheet_id text not null,
  gid text not null,
  sheet_title text,
  tab_name text not null,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  unique (sheet_id, gid)
);
alter table public.sources enable row level security;
create policy "sources: read all" on public.sources
  for select to anon, authenticated using (true);

-- Raw cached CSV rows for a tab (shared cache, ~10 min TTL enforced in app).
create table public.snapshots (
  source_id uuid primary key references public.sources (id) on delete cascade,
  fetched_at timestamptz not null default now(),
  csv_hash text not null,
  row_count integer not null,
  rows jsonb not null
);
alter table public.snapshots enable row level security;
create policy "snapshots: read all" on public.snapshots
  for select to anon, authenticated using (true);

-- ─── Mappings ─────────────────────────────────────────────────────────
-- columns: {"name":int,"link":int,"price":int,"image":int,"custom":[{"col":int,"label":text}]}
create table public.mappings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  header_row integer not null,
  columns jsonb not null,
  signature text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.mappings (source_id, signature);
alter table public.mappings enable row level security;
create policy "mappings: read own" on public.mappings
  for select to authenticated using (created_by = (select auth.uid()));
create policy "mappings: insert own" on public.mappings
  for insert to authenticated with check (created_by = (select auth.uid()));

-- Shared preset: applies when votes >= 3 or approved by admin.
create table public.mapping_presets (
  source_id uuid not null references public.sources (id) on delete cascade,
  signature text not null,
  header_row integer not null,
  columns jsonb not null,
  votes integer not null default 0,
  approved boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (source_id, signature)
);
alter table public.mapping_presets enable row level security;
create policy "presets: read all" on public.mapping_presets
  for select to anon, authenticated using (true);
create policy "presets: admin write" on public.mapping_presets
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- A user's added tabs.
create table public.user_sources (
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid not null references public.sources (id) on delete cascade,
  mapping_id uuid references public.mappings (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (user_id, source_id)
);
create index on public.user_sources (source_id);
create index on public.user_sources (mapping_id);
alter table public.user_sources enable row level security;
create policy "user_sources: own" on public.user_sources
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ─── Normalised listings (per source + mapping signature, shared) ─────
create table public.listings (
  source_id uuid not null references public.sources (id) on delete cascade,
  signature text not null,
  row_index integer not null,
  item_key text not null,
  mergeable boolean not null default false,
  name text not null,
  price_cents integer,
  price_raw text,
  currency text not null default 'USD',
  image_url text,
  link text not null,
  custom jsonb not null default '[]'::jsonb,
  category text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (source_id, signature, row_index)
);
create index on public.listings (item_key);
alter table public.listings enable row level security;
create policy "listings: read all" on public.listings
  for select to anon, authenticated using (true);

-- ─── Categories ───────────────────────────────────────────────────────
create table public.category_keywords (
  id bigint generated always as identity primary key,
  category text not null,
  keyword text not null unique
);
alter table public.category_keywords enable row level security;
create policy "keywords: read all" on public.category_keywords
  for select to anon, authenticated using (true);
create policy "keywords: admin write" on public.category_keywords
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create table public.user_item_tags (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text not null,
  category text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_key)
);
alter table public.user_item_tags enable row level security;
create policy "user_item_tags: own" on public.user_item_tags
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Shared once votes >= 3 or approved by admin.
create table public.shared_item_tags (
  item_key text not null,
  category text not null,
  votes integer not null default 0,
  approved boolean not null default false,
  primary key (item_key, category)
);
alter table public.shared_item_tags enable row level security;
create policy "shared_tags: read all" on public.shared_item_tags
  for select to anon, authenticated using (true);
create policy "shared_tags: admin write" on public.shared_item_tags
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ─── Pin boards ───────────────────────────────────────────────────────
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index on public.boards (user_id);
alter table public.boards enable row level security;
create policy "boards: own" on public.boards
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- snapshot: {"name","image","min_price_cents","listings":[{source_id,row_index,price_cents}]}
create table public.pins (
  board_id uuid not null references public.boards (id) on delete cascade,
  item_key text not null,
  snapshot jsonb not null,
  pinned_at timestamptz not null default now(),
  primary key (board_id, item_key)
);
alter table public.pins enable row level security;
create policy "pins: own boards" on public.pins
  for all to authenticated
  using (exists (select 1 from public.boards b where b.id = board_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.boards b where b.id = board_id and b.user_id = (select auth.uid())));
