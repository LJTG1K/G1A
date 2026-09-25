-- Category resolution: viewer tag > shared tag > keyword category.

create or replace function public.store_products(
  p_source_ids uuid[],
  p_signatures text[],
  p_terms text[] default '{}',
  p_category text default null,      -- null = all, '__other__' = uncategorised
  p_sheet uuid default null,         -- only products listed in this source
  p_min_cents integer default null,
  p_max_cents integer default null,
  p_sort text default 'sheet',       -- sheet | price_asc | price_desc | newest | name
  p_offset integer default 0,
  p_limit integer default 60,
  p_keys text[] default null         -- only these product keys (pin boards)
)
returns table (
  item_key text,
  name text,
  image_url text,
  min_price_cents integer,
  price_raw text,
  category text,
  listings jsonb,
  total bigint
)
language sql stable security invoker set search_path = '' as $$
  with src as (
    select s.source_id, s.signature, s.ord
    from unnest(p_source_ids, p_signatures) with ordinality as s(source_id, signature, ord)
  ),
  -- A sheet can reuse one marketplace link for several products (a shop listing with
  -- many designs). Each row stays its own product: the Nth use of a link in one sheet
  -- merges only with the Nth use in other sheets.
  l as (
    select l.*, case when l.n = 1 then l.item_key else l.item_key || '#' || l.n end as product_key
    from (
      select l.*, src.ord,
        row_number() over (partition by l.source_id, l.signature, l.item_key order by l.row_index) as n
      from public.listings l
      join src on l.source_id = src.source_id and l.signature = src.signature
    ) l
  ),
  g as (
    select
      l.product_key as item_key,
      (array_agg(l.name order by l.price_cents asc nulls last, l.ord, l.row_index))[1] as name,
      (array_agg(l.image_url order by (l.image_url is null), l.price_cents asc nulls last, l.ord, l.row_index))[1] as image_url,
      min(l.price_cents) as min_price_cents,
      (array_agg(l.price_raw order by l.price_cents asc nulls last, l.ord, l.row_index))[1] as price_raw,
      (array_agg(l.category order by l.price_cents asc nulls last, l.ord, l.row_index)
        filter (where l.category is not null))[1] as category,
      jsonb_agg(
        jsonb_build_object(
          'source_id', l.source_id, 'row_index', l.row_index, 'name', l.name,
          'price_cents', l.price_cents, 'price_raw', l.price_raw, 'currency', l.currency,
          'link', l.link, 'image_url', l.image_url, 'custom', l.custom
        )
        order by l.price_cents asc nulls last, l.ord, l.row_index
      ) as listings,
      array_agg(distinct l.source_id) as source_ids,
      min(l.ord * 100000 + l.row_index) as sheet_order,
      min(l.first_seen) as first_seen
    from l
    group by l.product_key
  ),
  -- Category: the viewer's own tag, else a shared tag (3+ votes or admin-approved),
  -- else the keyword category. '__other__' as a tag means "no category".
  c as (
    select g.item_key, g.name, g.image_url, g.min_price_cents, g.price_raw, g.listings,
      g.source_ids, g.sheet_order, g.first_seen,
      nullif(coalesce(ut.category, st.category, g.category), '__other__') as category
    from g
    left join public.user_item_tags ut on ut.item_key = g.item_key and ut.user_id = (select auth.uid())
    left join lateral (
      select s.category from public.shared_item_tags s
      where s.item_key = g.item_key and (s.approved or s.votes >= 3)
      order by s.approved desc, s.votes desc
      limit 1
    ) st on true
  ),
  f as (
    select g.*
    from c as g
    where not exists (
        select 1 from unnest(p_terms) t
        where g.name not ilike '%' || t || '%' and coalesce(g.category, '') not ilike t
      )
      and (p_category is null
        or (p_category = '__other__' and g.category is null)
        or g.category = p_category)
      and (p_sheet is null or p_sheet = any (g.source_ids))
      and (p_min_cents is null or g.min_price_cents >= p_min_cents)
      and (p_max_cents is null or g.min_price_cents <= p_max_cents)
      and (p_keys is null or g.item_key = any (p_keys))
  )
  select f.item_key, f.name, f.image_url, f.min_price_cents, f.price_raw, f.category, f.listings,
         count(*) over () as total
  from f
  order by
    case when p_sort = 'price_asc' then f.min_price_cents end asc nulls last,
    case when p_sort = 'price_desc' then f.min_price_cents end desc nulls last,
    case when p_sort = 'newest' then f.first_seen end desc,
    case when p_sort = 'name' then lower(f.name) end asc,
    f.sheet_order
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 120);
$$;

create or replace function public.store_facets(p_source_ids uuid[], p_signatures text[])
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with src as (
    select s.source_id, s.signature
    from unnest(p_source_ids, p_signatures) as s(source_id, signature)
  ),
  l as (
    select l.source_id, l.price_cents, l.category,
      case when l.n = 1 then l.item_key else l.item_key || '#' || l.n end as item_key
    from (
      select l.*, row_number() over (partition by l.source_id, l.signature, l.item_key order by l.row_index) as n
      from public.listings l
      join src on l.source_id = src.source_id and l.signature = src.signature
    ) l
  ),
  g0 as (
    select item_key,
      min(price_cents) as price,
      (array_agg(category order by price_cents asc nulls last) filter (where category is not null))[1] as category
    from l group by item_key
  ),
  g as (
    select g0.item_key, g0.price,
      nullif(coalesce(ut.category, st.category, g0.category), '__other__') as category
    from g0
    left join public.user_item_tags ut on ut.item_key = g0.item_key and ut.user_id = (select auth.uid())
    left join lateral (
      select s.category from public.shared_item_tags s
      where s.item_key = g0.item_key and (s.approved or s.votes >= 3)
      order by s.approved desc, s.votes desc
      limit 1
    ) st on true
  )
  select jsonb_build_object(
    'total', (select count(*) from g),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'count', n) order by n desc)
      from (select category, count(*) n from g group by category) c
    ), '[]'::jsonb),
    'sheets', coalesce((
      select jsonb_agg(jsonb_build_object('source_id', source_id, 'count', n))
      from (select source_id, count(distinct item_key) n from l group by source_id) s
    ), '[]'::jsonb),
    'max_price_cents', (select max(price) from g)
  );
$$;

-- Bulk category update after the admin edits keywords. Server (secret key) only.
create or replace function public.set_listing_categories(p_rows jsonb)
returns integer
language sql security definer set search_path = '' as $$
  with r as (
    select * from jsonb_to_recordset(p_rows) as r(source_id uuid, signature text, row_index integer, category text)
  ),
  u as (
    update public.listings l set category = r.category
    from r
    where l.source_id = r.source_id and l.signature = r.signature and l.row_index = r.row_index
      and l.category is distinct from r.category
    returning 1
  )
  select count(*)::integer from u;
$$;
revoke execute on function public.set_listing_categories(jsonb) from public, anon, authenticated;

create index if not exists user_item_tags_item_key_idx on public.user_item_tags (item_key);
