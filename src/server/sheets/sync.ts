import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCategorizer, type Categorizer, type KeywordRule } from "./categorize";
import { fetchGrid } from "./fetch-sheet";
import { normalize } from "./normalize";
import { mappingSignature } from "./signature";
import type { Cell, Grid, Mapping, Offset } from "./types";

/** How long a fetched tab is reused before Google is asked again (shared by all users). */
export const SNAPSHOT_TTL_MS = 10 * 60 * 1000;

export type SourceRow = { id: string; sheet_id: string; gid: string };

// Snapshots store cells compactly: text, or [text, href?, img?].
type StoredCell = string | [string, string | null, string | null];
const pack = (grid: Grid): StoredCell[][] =>
  grid.map((row) => row.map((c) => (c.href || c.img ? [c.text, c.href ?? null, c.img ?? null] : c.text)));
const unpack = (rows: StoredCell[][]): Grid =>
  rows.map((row) =>
    row.map((c): Cell => {
      if (typeof c === "string") return { text: c };
      const cell: Cell = { text: c[0] };
      if (c[1]) cell.href = c[1];
      if (c[2]) cell.img = c[2];
      return cell;
    }),
  );

/** Returns the tab's grid from the shared cache, fetching from Google when stale or forced. */
export async function getGrid(
  db: SupabaseClient,
  source: SourceRow,
  opts: { force?: boolean } = {},
): Promise<{ grid: Grid; changed: boolean }> {
  const { data: snap } = await db
    .from("snapshots")
    .select("fetched_at, csv_hash, rows")
    .eq("source_id", source.id)
    .maybeSingle();

  if (snap && !opts.force && Date.now() - new Date(snap.fetched_at).getTime() < SNAPSHOT_TTL_MS) {
    return { grid: unpack(snap.rows), changed: false };
  }

  const grid = await fetchGrid(source.sheet_id, source.gid);
  const packed = pack(grid);
  const hash = createHash("sha1").update(JSON.stringify(packed)).digest("hex");
  const changed = snap?.csv_hash !== hash;

  const { error } = await db.from("snapshots").upsert({
    source_id: source.id,
    fetched_at: new Date().toISOString(),
    csv_hash: hash,
    row_count: grid.length,
    // Unchanged content: only bump fetched_at, don't rewrite the rows.
    ...(changed || !snap ? { rows: packed } : { rows: snap.rows }),
  });
  if (error) throw new Error(`Saving snapshot failed: ${error.message}`);
  return { grid, changed };
}

export async function loadCategorizer(db: SupabaseClient): Promise<Categorizer> {
  const { data, error } = await db.from("category_keywords").select("category, keyword");
  if (error) throw new Error(`Loading keywords failed: ${error.message}`);
  return buildCategorizer((data ?? []) as KeywordRule[]);
}

/**
 * Re-computes listings for one tab + mapping and writes them. Rows present keep
 * their first_seen; rows gone from the sheet are deleted (pins keep their own
 * snapshot and show "no longer listed").
 */
export async function syncListings(
  db: SupabaseClient,
  sourceId: string,
  mapping: Mapping,
  grid: Grid,
  categorize: Categorizer,
): Promise<{ signature: string; count: number }> {
  const signature = mappingSignature(mapping);
  const startedAt = new Date().toISOString();
  const listings = normalize(grid, mapping, { categorize });

  for (let i = 0; i < listings.length; i += 500) {
    const batch = listings.slice(i, i + 500).map((l) => ({
      source_id: sourceId,
      signature,
      row_index: l.rowIndex,
      item_key: l.itemKey,
      mergeable: l.mergeable,
      name: l.name,
      price_cents: l.priceCents,
      price_raw: l.priceRaw,
      currency: l.currency,
      image_url: l.imageUrl,
      link: l.link,
      custom: l.custom,
      category: l.category,
      last_seen: startedAt,
    }));
    const { error } = await db.from("listings").upsert(batch, { onConflict: "source_id,signature,row_index" });
    if (error) throw new Error(`Saving listings failed: ${error.message}`);
  }

  const { error } = await db
    .from("listings")
    .delete()
    .eq("source_id", sourceId)
    .eq("signature", signature)
    .lt("last_seen", startedAt);
  if (error) throw new Error(`Removing old listings failed: ${error.message}`);

  return { signature, count: listings.length };
}

/** Mapping as stored in the DB's `columns` jsonb (header row lives in its own column). */
export type StoredColumns =
  | { layout?: "rows"; name: number | null; link: number | null; price: number | null; image: number | null; custom: { col: number; label: string }[] }
  | { layout: "blocks"; link: Offset | null; price: Offset | null; image: Offset | null; custom: (Offset & { label: string })[] };

/** Converts between the app's Mapping and the DB's columns jsonb + header_row. */
export function toColumns(m: Mapping): StoredColumns {
  if (m.layout === "blocks") return { layout: "blocks", link: m.link, price: m.price, image: m.image, custom: m.custom };
  // Row mappings keep the original shape (no layout key) so existing rows and presets still match.
  return { name: m.name, link: m.link, price: m.price, image: m.image, custom: m.custom };
}

export function fromColumns(headerRow: number, c: StoredColumns): Mapping {
  if (c.layout === "blocks") return { layout: "blocks", link: c.link, price: c.price, image: c.image, custom: c.custom };
  return { layout: "rows", headerRow, name: c.name, link: c.link, price: c.price, image: c.image, custom: c.custom };
}

/** header_row column value for a mapping (-1 for block layouts). */
export const headerRowOf = (m: Mapping) => (m.layout === "rows" ? m.headerRow : -1);
