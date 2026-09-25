import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Facets, Product, StoreQuery } from "@/lib/store";
import { EMPTY_QUERY, PRICE_BUCKETS } from "@/lib/store";
import { fromColumns, getGrid, loadCategorizer, syncListings, SNAPSHOT_TTL_MS } from "./sheets/sync";
import type { Mapping } from "./sheets/types";

export type StoreSource = {
  id: string;
  sheetId: string;
  gid: string;
  signature: string;
  mapping: Mapping;
  label: string;
  sheetTitle: string;
  tab: string;
  featured: boolean;
  fetchedAt: string | null;
};

type SourceJoin = { id: string; sheet_id: string; gid: string; tab_name: string; sheet_title: string | null };
type MappingJoin = { signature: string; header_row: number; columns: Parameters<typeof fromColumns>[1] };

const label = (s: SourceJoin) => `${s.sheet_title ?? "Sheet"} · ${s.tab_name}`;

/**
 * The tabs feeding a visitor's store: their own tabs (newest first) with their
 * mappings, then the featured sheet with its admin-approved preset.
 */
export async function getStoreSources(db: SupabaseClient, userId: string | null): Promise<StoreSource[]> {
  const [mine, featured] = await Promise.all([
    userId
      ? db
          .from("user_sources")
          .select("sources(id, sheet_id, gid, tab_name, sheet_title), mappings(signature, header_row, columns)")
          .eq("user_id", userId)
          .order("added_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    db
      .from("sources")
      .select("id, sheet_id, gid, tab_name, sheet_title, mapping_presets(signature, header_row, columns, approved)")
      .eq("is_featured", true)
      .order("tab_name"),
  ]);

  const out: StoreSource[] = [];
  for (const row of mine.data ?? []) {
    const s = row.sources as unknown as SourceJoin | null;
    const m = row.mappings as unknown as MappingJoin | null;
    if (!s || !m) continue;
    out.push(toSource(s, m, false));
  }
  for (const s of featured.data ?? []) {
    const preset = (s.mapping_presets as (MappingJoin & { approved: boolean })[]).find((p) => p.approved);
    if (preset && !out.some((o) => o.id === s.id)) out.push(toSource(s as SourceJoin, preset, true));
  }

  if (out.length) {
    const { data: snaps } = await db
      .from("snapshots")
      .select("source_id, fetched_at")
      .in("source_id", out.map((s) => s.id));
    const at = new Map((snaps ?? []).map((s) => [s.source_id as string, s.fetched_at as string]));
    for (const s of out) s.fetchedAt = at.get(s.id) ?? null;
  }
  return out;
}

function toSource(s: SourceJoin, m: MappingJoin, featured: boolean): StoreSource {
  return {
    id: s.id,
    sheetId: s.sheet_id,
    gid: s.gid,
    signature: m.signature,
    mapping: fromColumns(m.header_row, m.columns),
    label: label(s),
    sheetTitle: s.sheet_title ?? "Google Sheet",
    tab: s.tab_name,
    featured,
    fetchedAt: null,
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

type Row = {
  item_key: string;
  name: string;
  image_url: string | null;
  min_price_cents: number | null;
  price_raw: string | null;
  category: string | null;
  listings: {
    source_id: string;
    row_index: number;
    name: string;
    price_cents: number | null;
    price_raw: string | null;
    currency: string;
    link: string;
    image_url: string | null;
    custom: { label: string; value: string }[];
  }[];
  total: number;
};

export async function queryProducts(
  db: SupabaseClient,
  sources: StoreSource[],
  q: StoreQuery,
  offset: number,
  limit: number,
  keys?: string[],
): Promise<{ products: Product[]; total: number }> {
  if (!sources.length) return { products: [], total: 0 };
  const bucket = PRICE_BUCKETS.find((b) => b.id === q.price);
  const bySource = new Map(sources.map((s) => [s.id, s]));

  const { data, error } = await db.rpc("store_products", {
    p_source_ids: sources.map((s) => s.id),
    p_signatures: sources.map((s) => s.signature),
    p_terms: q.q
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8)
      .map(escapeLike),
    p_category: q.category,
    p_sheet: sources.some((s) => s.id === q.sheet) ? q.sheet : null,
    p_min_cents: bucket?.min ?? null,
    p_max_cents: bucket?.max ?? null,
    p_sort: q.sort,
    p_offset: offset,
    p_limit: limit,
    p_keys: keys ?? null,
  });
  if (error) throw new Error(`Store query failed: ${error.message}`);

  const rows = (data ?? []) as Row[];
  return {
    total: rows[0]?.total ?? 0,
    products: rows.map((r) => ({
      key: r.item_key,
      name: r.name,
      image: r.image_url,
      priceCents: r.min_price_cents,
      priceRaw: r.price_raw ?? "",
      category: r.category,
      custom: r.listings[0]?.custom ?? [],
      listings: r.listings.map((l) => ({
        sourceId: l.source_id,
        sheet: bySource.get(l.source_id)?.label ?? "Sheet",
        tab: bySource.get(l.source_id)?.tab ?? "Sheet",
        name: l.name,
        priceCents: l.price_cents,
        priceRaw: l.price_raw ?? "",
        link: l.link,
        image: l.image_url,
        custom: l.custom,
      })),
    })),
  };
}

export async function queryFacets(db: SupabaseClient, sources: StoreSource[]): Promise<Facets> {
  if (!sources.length) return { total: 0, categories: [], sheets: [] };
  const { data, error } = await db.rpc("store_facets", {
    p_source_ids: sources.map((s) => s.id),
    p_signatures: sources.map((s) => s.signature),
  });
  if (error) throw new Error(`Facets failed: ${error.message}`);
  const f = data as {
    total: number;
    categories: { category: string | null; count: number }[];
    sheets: { source_id: string; count: number }[];
  };
  const counts = new Map(f.sheets.map((s) => [s.source_id, s.count]));
  return {
    total: f.total,
    categories: f.categories.map((c) => ({ category: c.category, count: c.count })),
    sheets: sources.map((s) => ({ id: s.id, label: s.label, tab: s.tab, count: counts.get(s.id) ?? 0, featured: s.featured })),
  };
}

/**
 * Re-reads tabs whose shared snapshot is older than the TTL and re-syncs their
 * listings when the sheet changed. Returns true if anything changed.
 */
export async function refreshStale(admin: SupabaseClient, sources: StoreSource[]): Promise<boolean> {
  const stale = sources.filter(
    (s) => !s.fetchedAt || Date.now() - new Date(s.fetchedAt).getTime() >= SNAPSHOT_TTL_MS,
  );
  if (!stale.length) return false;
  const categorize = await loadCategorizer(admin);

  let changed = false;
  // A few at a time so one slow sheet doesn't hold up the rest.
  for (let i = 0; i < stale.length; i += 4) {
    const results = await Promise.allSettled(
      stale.slice(i, i + 4).map(async (s) => {
        const { grid, changed: tabChanged } = await getGrid(admin, { id: s.id, sheet_id: s.sheetId, gid: s.gid });
        if (tabChanged) await syncListings(admin, s.id, s.mapping, grid, categorize);
        return tabChanged;
      }),
    );
    for (const r of results) {
      if (r.status === "fulfilled") changed ||= r.value;
      else console.error("Refreshing sheet failed:", r.reason);
    }
  }
  return changed;
}

/** Narrows the store to one spreadsheet when the query asks for it (unknown ids are ignored). */
export function scopeSources(sources: StoreSource[], spreadsheet: string | null): StoreSource[] {
  if (!spreadsheet) return sources;
  const scoped = sources.filter((s) => s.sheetId === spreadsheet);
  return scoped.length ? scoped : sources;
}

export type Shelf = {
  sheetId: string;
  title: string;
  featured: boolean;
  tabs: { id: string; name: string }[];
  total: number;
  products: Product[];
};

/** One shelf per spreadsheet: its tabs, product count and first products. */
export async function getShelves(db: SupabaseClient, sources: StoreSource[], perShelf: number): Promise<Shelf[]> {
  const groups = new Map<string, StoreSource[]>();
  for (const s of sources) groups.set(s.sheetId, [...(groups.get(s.sheetId) ?? []), s]);
  return Promise.all(
    [...groups].map(async ([sheetId, group]) => {
      const { products, total } = await queryProducts(db, group, EMPTY_QUERY, 0, perShelf);
      return {
        sheetId,
        title: group[0].sheetTitle,
        featured: group.every((s) => s.featured),
        tabs: group.map((s) => ({ id: s.id, name: s.tab })),
        total,
        products,
      };
    }),
  );
}
