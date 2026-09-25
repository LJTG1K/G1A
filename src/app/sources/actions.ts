"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { SheetError, fetchTabs } from "@/server/sheets/fetch-sheet";
import { parseSheetUrl } from "@/server/sheets/parse-sheet-url";
import { fromColumns, getGrid, loadCategorizer, syncListings } from "@/server/sheets/sync";
import type { Grid, Mapping, Tab } from "@/server/sheets/types";
import {
  MAX_SHEETS_PER_USER,
  ensureSource,
  isValidMapping,
  mappingRecord,
  previewGrid,
  recountVotes,
  suggestMapping,
  type MappingOrigin,
} from "@/server/sources";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => {
  if (e instanceof SheetError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "Something went wrong. Please try again." };
};

export type InspectResult = Result<{
  sheetId: string;
  title: string | null;
  tabs: (Tab & { added: boolean })[];
  preselect: string | null;
}>;

/** Step 1: read the link and list the sheet's tabs. */
export async function inspectSheet(url: string): Promise<InspectResult> {
  const { id: userId, supabase } = await requireUser();
  const parsed = parseSheetUrl(url);
  if (!parsed) return { ok: false, error: "That doesn't look like a Google Sheets link." };
  try {
    const { title, tabs } = await fetchTabs(parsed.sheetId);
    const { data: mine } = await supabase
      .from("user_sources")
      .select("sources!inner(sheet_id, gid)")
      .eq("user_id", userId)
      .eq("sources.sheet_id", parsed.sheetId);
    const added = new Set((mine ?? []).map((r) => (r.sources as unknown as { gid: string }).gid));
    return {
      ok: true,
      sheetId: parsed.sheetId,
      title,
      tabs: tabs.map((t) => ({ ...t, added: added.has(t.gid) })),
      preselect: parsed.gid,
    };
  } catch (e) {
    return fail(e);
  }
}

export type PreviewResult = Result<{
  sourceId: string;
  grid: Grid;
  totalRows: number;
  mapping: Mapping;
  origin: MappingOrigin;
}>;

/** Step 2: fetch one tab and suggest a mapping (shared preset, else auto-guess). */
export async function previewTab(sheetId: string, tab: Tab, sheetTitle: string | null): Promise<PreviewResult> {
  const { id: userId, supabase } = await requireUser();
  try {
    const admin = createAdminClient();
    const source = await ensureSource(admin, { sheetId, gid: tab.gid, tabName: tab.name, sheetTitle });
    const { grid } = await getGrid(admin, source);

    // Re-mapping a tab starts from the user's own saved mapping.
    const { data: own } = await supabase
      .from("user_sources")
      .select("mappings(header_row, columns)")
      .eq("user_id", userId)
      .eq("source_id", source.id)
      .maybeSingle();
    const saved = own?.mappings as unknown as { header_row: number; columns: Parameters<typeof fromColumns>[1] } | null;
    const yours = saved ? fromColumns(saved.header_row, saved.columns) : null;
    const { mapping, origin } =
      yours && isValidMapping(yours, grid)
        ? { mapping: yours, origin: "yours" as const }
        : await suggestMapping(admin, source.id, grid);
    return { ok: true, sourceId: source.id, grid: previewGrid(grid), totalRows: grid.length, mapping, origin };
  } catch (e) {
    return fail(e);
  }
}

/** Step 3: save the user's mapping, count it toward the shared preset, and load listings. */
export async function saveTab(sourceId: string, mapping: Mapping): Promise<Result<{ count: number }>> {
  const { id: userId, supabase } = await requireUser();
  try {
    const admin = createAdminClient();
    const { data: source } = await admin.from("sources").select("id, sheet_id, gid").eq("id", sourceId).single();
    if (!source) return { ok: false, error: "Sheet not found." };

    // Limit counts distinct spreadsheets, so extra tabs of an added sheet are free.
    const { data: mine } = await supabase.from("user_sources").select("sources!inner(sheet_id)").eq("user_id", userId);
    const sheets = new Set((mine ?? []).map((r) => (r.sources as unknown as { sheet_id: string }).sheet_id));
    if (!sheets.has(source.sheet_id) && sheets.size >= MAX_SHEETS_PER_USER) {
      return { ok: false, error: `You can add up to ${MAX_SHEETS_PER_USER} sheets during the beta.` };
    }

    const { grid } = await getGrid(admin, source);
    const clean: Mapping = { ...mapping, custom: mapping.custom.map((c) => ({ ...c, label: c.label.trim() })) };
    if (!isValidMapping(clean, grid)) return { ok: false, error: "Pick a column for Name and Purchase link." };

    const { data: saved, error } = await supabase
      .from("mappings")
      .insert(mappingRecord(source.id, clean, userId))
      .select("id")
      .single();
    if (error) throw error;

    const { error: linkErr } = await supabase
      .from("user_sources")
      .upsert({ user_id: userId, source_id: source.id, mapping_id: saved.id }, { onConflict: "user_id,source_id" });
    if (linkErr) throw linkErr;

    await recountVotes(admin, source.id);
    const { count } = await syncListings(admin, source.id, clean, grid, await loadCategorizer(admin));
    revalidatePath("/sources");
    revalidatePath("/");
    return { ok: true, count };
  } catch (e) {
    return fail(e);
  }
}

export async function removeTab(sourceId: string): Promise<Result<object>> {
  const { id: userId, supabase } = await requireUser();
  try {
    const { error } = await supabase.from("user_sources").delete().eq("user_id", userId).eq("source_id", sourceId);
    if (error) throw error;
    await recountVotes(createAdminClient(), sourceId);
    revalidatePath("/sources");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Manual refresh: re-read the tab from Google now and re-apply the user's mapping. */
export async function refreshTab(sourceId: string): Promise<Result<{ count: number }>> {
  const { id: userId, supabase } = await requireUser();
  try {
    const { data: link } = await supabase
      .from("user_sources")
      .select("mappings(header_row, columns)")
      .eq("user_id", userId)
      .eq("source_id", sourceId)
      .maybeSingle();
    const m = link?.mappings as unknown as { header_row: number; columns: Parameters<typeof fromColumns>[1] } | null;
    if (!m) return { ok: false, error: "This sheet isn't in your list." };

    const admin = createAdminClient();
    const { data: source } = await admin.from("sources").select("id, sheet_id, gid").eq("id", sourceId).single();
    if (!source) return { ok: false, error: "Sheet not found." };
    const { grid } = await getGrid(admin, source, { force: true });
    const { count } = await syncListings(
      admin,
      source.id,
      fromColumns(m.header_row, m.columns),
      grid,
      await loadCategorizer(admin),
    );
    revalidatePath("/sources");
    return { ok: true, count };
  } catch (e) {
    return fail(e);
  }
}
