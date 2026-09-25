import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autoMap } from "./sheets/auto-map";
import { mappingSignature } from "./sheets/signature";
import { findBlocks } from "./sheets/blocks";
import { fromColumns, headerRowOf, toColumns } from "./sheets/sync";
import type { Grid, Mapping } from "./sheets/types";

/** A mapping becomes the shared default for a tab at this many matching users. */
export const PRESET_VOTES = 3;
/** Most distinct spreadsheets one user can add (featured sheet not counted). */
export const MAX_SHEETS_PER_USER = 20;
/** Rows sent to the mapping screen for preview. */
export const PREVIEW_ROWS = 100;
export const PREVIEW_COLS = 26;

export type MappingOrigin = "yours" | "preset" | "auto";

/** Upserts the shared row for a sheet tab and returns its id. */
export async function ensureSource(
  admin: SupabaseClient,
  s: { sheetId: string; gid: string; tabName: string; sheetTitle: string | null },
): Promise<{ id: string; sheet_id: string; gid: string; is_featured: boolean }> {
  const { data, error } = await admin
    .from("sources")
    .upsert(
      { sheet_id: s.sheetId, gid: s.gid, tab_name: s.tabName, sheet_title: s.sheetTitle },
      { onConflict: "sheet_id,gid" },
    )
    .select("id, sheet_id, gid, is_featured")
    .single();
  if (error) throw new Error(`Saving sheet failed: ${error.message}`);
  return data;
}

/** The shared preset for a tab: admin-approved first, then most votes (≥ PRESET_VOTES). */
export async function findPreset(db: SupabaseClient, sourceId: string): Promise<Mapping | null> {
  const { data } = await db
    .from("mapping_presets")
    .select("header_row, columns, votes, approved")
    .eq("source_id", sourceId)
    .or(`approved.eq.true,votes.gte.${PRESET_VOTES}`)
    .order("approved", { ascending: false })
    .order("votes", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? fromColumns(data.header_row, data.columns) : null;
}

/** Preset if one qualifies, otherwise the auto-mapper's guess. */
export async function suggestMapping(
  db: SupabaseClient,
  sourceId: string,
  grid: Grid,
): Promise<{ mapping: Mapping; origin: MappingOrigin }> {
  const preset = await findPreset(db, sourceId);
  if (preset && isValidMapping(preset, grid)) return { mapping: preset, origin: "preset" };
  return { mapping: autoMap(grid), origin: "auto" };
}

export function isValidMapping(m: Mapping, grid: Grid): boolean {
  const labelsOk = m.custom.every((c) => c.label.trim().length > 0 && c.label.length <= 40);
  if (m.layout === "blocks") {
    // Offsets are small and distinct, and the layout must find at least one product.
    const offsets = [{ dr: 0, dc: 0 }, m.link, m.price, m.image, ...m.custom].filter(
      (o): o is { dr: number; dc: number } => !!o,
    );
    const small = offsets.every((o) => Number.isInteger(o.dr) && Number.isInteger(o.dc) && Math.abs(o.dr) <= 10 && Math.abs(o.dc) <= 10);
    const distinct = new Set(offsets.map((o) => `${o.dr},${o.dc}`)).size === offsets.length;
    return !!m.link && small && distinct && labelsOk && m.custom.length <= 10 && findBlocks(grid, m).length > 0;
  }
  const width = Math.max(0, ...grid.slice(0, 500).map((r) => r.length));
  const cols = [m.name, m.link, m.price, m.image, ...m.custom.map((c) => c.col)].filter(
    (c): c is number => c !== null,
  );
  return (
    m.name !== null &&
    m.link !== null &&
    Number.isInteger(m.headerRow) &&
    m.headerRow >= -1 &&
    m.headerRow < grid.length &&
    cols.every((c) => Number.isInteger(c) && c >= 0 && c < width) &&
    new Set(cols).size === cols.length &&
    labelsOk
  );
}

/**
 * Recounts preset votes for a tab from users' current mappings, so a user who
 * re-maps moves their vote rather than adding a second one.
 */
export async function recountVotes(admin: SupabaseClient, sourceId: string): Promise<void> {
  const { data, error } = await admin
    .from("user_sources")
    .select("mappings!inner(signature, header_row, columns)")
    .eq("source_id", sourceId);
  if (error) throw new Error(`Counting presets failed: ${error.message}`);

  const tally = new Map<string, { votes: number; header_row: number; columns: unknown }>();
  for (const row of data ?? []) {
    const m = row.mappings as unknown as { signature: string; header_row: number; columns: unknown };
    const t = tally.get(m.signature) ?? { votes: 0, header_row: m.header_row, columns: m.columns };
    t.votes++;
    tally.set(m.signature, t);
  }

  const now = new Date().toISOString();
  // Zero out signatures nobody uses any more (approved flag is kept).
  await admin.from("mapping_presets").update({ votes: 0, updated_at: now }).eq("source_id", sourceId);
  if (tally.size) {
    const { error: upErr } = await admin.from("mapping_presets").upsert(
      [...tally].map(([signature, t]) => ({
        source_id: sourceId,
        signature,
        header_row: t.header_row,
        columns: t.columns,
        votes: t.votes,
        updated_at: now,
      })),
      { onConflict: "source_id,signature" },
    );
    if (upErr) throw new Error(`Saving presets failed: ${upErr.message}`);
  }
}

export function mappingRecord(sourceId: string, m: Mapping, userId: string) {
  return {
    source_id: sourceId,
    header_row: headerRowOf(m),
    columns: toColumns(m),
    signature: mappingSignature(m),
    created_by: userId,
  };
}

/** Trims a grid for sending to the browser: first rows/cols, long text shortened. */
export function previewGrid(grid: Grid): Grid {
  return grid.slice(0, PREVIEW_ROWS).map((row) =>
    row.slice(0, PREVIEW_COLS).map((c) => ({
      text: c.text.length > 140 ? `${c.text.slice(0, 140)}…` : c.text,
      ...(c.href ? { href: c.href } : {}),
      ...(c.img ? { img: c.img } : {}),
    })),
  );
}
