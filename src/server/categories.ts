import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCategorizer } from "./sheets/sync";

/** A user tag becomes everyone's category at this many matching users (or admin approval). */
export const SHARED_TAG_VOTES = 3;
export const OTHER_TAG = "__other__";

/**
 * Recounts shared-tag votes for one product from users' current tags, so changing
 * your tag moves your vote. Approval flags are kept.
 */
export async function recountTag(admin: SupabaseClient, itemKey: string): Promise<void> {
  const { data, error } = await admin.from("user_item_tags").select("category").eq("item_key", itemKey);
  if (error) throw new Error(`Counting tags failed: ${error.message}`);
  const tally = new Map<string, number>();
  for (const r of data ?? []) tally.set(r.category, (tally.get(r.category) ?? 0) + 1);

  await admin.from("shared_item_tags").update({ votes: 0 }).eq("item_key", itemKey);
  if (tally.size) {
    const { error: upErr } = await admin
      .from("shared_item_tags")
      .upsert([...tally].map(([category, votes]) => ({ item_key: itemKey, category, votes })), {
        onConflict: "item_key,category",
      });
    if (upErr) throw new Error(`Saving shared tags failed: ${upErr.message}`);
  }
  // Drop rows nobody votes for and nobody approved.
  await admin.from("shared_item_tags").delete().eq("item_key", itemKey).eq("votes", 0).eq("approved", false);
}

/** Re-applies the keyword list to every listing. Returns how many changed category. */
export async function recategorizeAll(admin: SupabaseClient): Promise<number> {
  const categorize = await loadCategorizer(admin);
  let changed = 0;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("listings")
      .select("source_id, signature, row_index, name, category")
      .order("source_id")
      .order("signature")
      .order("row_index")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Reading listings failed: ${error.message}`);
    const rows = (data ?? [])
      .map((l) => ({ ...l, next: categorize(l.name) }))
      .filter((l) => l.next !== l.category)
      .map((l) => ({ source_id: l.source_id, signature: l.signature, row_index: l.row_index, category: l.next }));
    if (rows.length) {
      const { data: n, error: upErr } = await admin.rpc("set_listing_categories", { p_rows: rows });
      if (upErr) throw new Error(`Updating categories failed: ${upErr.message}`);
      changed += (n as number) ?? 0;
    }
    if (!data || data.length < PAGE) break;
  }
  return changed;
}

/** Categories from the keyword list, for pickers. */
export async function keywordCategories(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from("category_keywords").select("category");
  return [...new Set((data ?? []).map((r) => r.category as string))].sort();
}
