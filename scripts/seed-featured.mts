/**
 * Sets up the featured (reference) sheet: auto-maps each featured tab, saves the
 * mapping as an admin-approved preset, and loads its listings.
 *
 *   npm run seed:featured
 */
import { createClient } from "@supabase/supabase-js";
import { autoMap } from "../src/server/sheets/auto-map";
import { fetchTabs } from "../src/server/sheets/fetch-sheet";
import { mappingSignature } from "../src/server/sheets/signature";
import { getGrid, loadCategorizer, syncListings, toColumns } from "../src/server/sheets/sync";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: sources, error } = await db.from("sources").select("id, sheet_id, gid, tab_name").eq("is_featured", true);
if (error) throw error;

const categorize = await loadCategorizer(db);
const titles = new Map<string, string | null>();

for (const source of sources ?? []) {
  if (!titles.has(source.sheet_id)) titles.set(source.sheet_id, (await fetchTabs(source.sheet_id)).title);
  const { grid } = await getGrid(db, source, { force: true });
  const mapping = autoMap(grid);
  const signature = mappingSignature(mapping);

  await db.from("sources").update({ sheet_title: titles.get(source.sheet_id) }).eq("id", source.id);
  const { error: presetError } = await db.from("mapping_presets").upsert({
    source_id: source.id,
    signature,
    header_row: mapping.headerRow,
    columns: toColumns(mapping),
    approved: true,
    updated_at: new Date().toISOString(),
  });
  if (presetError) throw presetError;

  const { count } = await syncListings(db, source.id, mapping, grid, categorize);
  console.log(`${source.tab_name}: ${grid.length} rows → ${count} listings (preset ${signature})`);
}
