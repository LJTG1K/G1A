"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { recategorizeAll } from "@/server/categories";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function done() {
  revalidatePath("/", "layout");
}

const fail = (e: unknown, msg: string): { ok: false; error: string } => {
  console.error(e);
  return { ok: false, error: msg };
};

// ─── Keywords ─────────────────────────────────────────────────────────

export async function addKeyword(category: string, keyword: string): Promise<Result<{ id: number; changed: number }>> {
  const { supabase } = await requireAdmin();
  const cat = category.trim().replace(/\s+/g, " ").slice(0, 30);
  const kw = keyword.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
  if (!cat || !kw) return { ok: false, error: "Enter a category and a keyword." };
  const { data, error } = await supabase.from("category_keywords").insert({ category: cat, keyword: kw }).select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? `“${kw}” is already a keyword.` : "Couldn't add the keyword." };
  try {
    const changed = await recategorizeAll(createAdminClient());
    done();
    return { ok: true, id: data.id, changed };
  } catch (e) {
    return fail(e, "Keyword added, but re-categorising failed. Use “Re-apply keywords”.");
  }
}

export async function removeKeyword(id: number): Promise<Result<{ changed: number }>> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("category_keywords").delete().eq("id", id);
  if (error) return fail(error, "Couldn't remove the keyword.");
  try {
    const changed = await recategorizeAll(createAdminClient());
    done();
    return { ok: true, changed };
  } catch (e) {
    return fail(e, "Keyword removed, but re-categorising failed. Use “Re-apply keywords”.");
  }
}

export async function reapplyKeywords(): Promise<Result<{ changed: number }>> {
  await requireAdmin();
  try {
    const changed = await recategorizeAll(createAdminClient());
    done();
    return { ok: true, changed };
  } catch (e) {
    return fail(e, "Re-categorising failed.");
  }
}

// ─── Mapping presets ──────────────────────────────────────────────────

/** Approving makes this the tab's preset for everyone; only one approved preset per tab. */
export async function setPresetApproved(sourceId: string, signature: string, approved: boolean): Promise<Result> {
  const { supabase } = await requireAdmin();
  if (approved) {
    await supabase.from("mapping_presets").update({ approved: false }).eq("source_id", sourceId).neq("signature", signature);
  }
  const { error } = await supabase
    .from("mapping_presets")
    .update({ approved, updated_at: new Date().toISOString() })
    .eq("source_id", sourceId)
    .eq("signature", signature);
  if (error) return fail(error, "Couldn't update the preset.");
  done();
  return { ok: true };
}

export async function deletePreset(sourceId: string, signature: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("mapping_presets").delete().eq("source_id", sourceId).eq("signature", signature);
  if (error) return fail(error, "Couldn't delete the preset.");
  done();
  return { ok: true };
}

// ─── Shared category tags ─────────────────────────────────────────────

/** Approving makes this the item's category for everyone; only one approved category per item. */
export async function setTagApproved(itemKey: string, category: string, approved: boolean): Promise<Result> {
  const { supabase } = await requireAdmin();
  if (approved) {
    await supabase.from("shared_item_tags").update({ approved: false }).eq("item_key", itemKey).neq("category", category);
  }
  const { error } = await supabase
    .from("shared_item_tags")
    .update({ approved })
    .eq("item_key", itemKey)
    .eq("category", category);
  if (error) return fail(error, "Couldn't update the tag.");
  done();
  return { ok: true };
}

export async function deleteSharedTag(itemKey: string, category: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("shared_item_tags").delete().eq("item_key", itemKey).eq("category", category);
  if (error) return fail(error, "Couldn't delete the tag.");
  done();
  return { ok: true };
}
