"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, type Product, type StoreQuery } from "@/lib/store";
import { keywordCategories, OTHER_TAG, recountTag } from "@/server/categories";
import { getStoreSources, queryProducts, refreshStale, scopeSources } from "@/server/store";

/** Signed-in user id, or null for the logged-out demo store. */
async function viewer(demo: boolean) {
  const supabase = await createClient();
  if (demo) return { supabase, userId: null };
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}

/** Next page of products. Sources are resolved on the server, never trusted from the client. */
export async function loadProducts(
  query: StoreQuery,
  offset: number,
  demo: boolean,
  keys?: string[],
): Promise<{ products: Product[]; total: number }> {
  const { supabase, userId } = await viewer(demo);
  const sources = scopeSources(await getStoreSources(supabase, userId), query.spreadsheet);
  return queryProducts(supabase, sources, query, Math.max(0, offset), PAGE_SIZE, keys?.slice(0, PAGE_SIZE));
}

/** Called when the store opens: re-reads stale sheets. Returns true if products changed. */
export async function refreshStore(demo: boolean): Promise<boolean> {
  const { supabase, userId } = await viewer(demo);
  const sources = await getStoreSources(supabase, userId);
  try {
    return await refreshStale(createAdminClient(), sources);
  } catch (e) {
    console.error(e);
    return false;
  }
}

/**
 * Files a product under a category for this user (null = back to automatic,
 * "__other__" = no category). Counts toward the shared tag everyone sees at 3 votes.
 */
export async function setProductCategory(
  key: string,
  category: string | null,
): Promise<{ ok: true; category: string | null } | { ok: false; error: string }> {
  const { id: userId, supabase } = await requireUser();
  const clean = category === null ? null : category.trim().replace(/\s+/g, " ").slice(0, 30);
  if (clean === "") return { ok: false, error: "Enter a category name." };
  try {
    let saved = clean;
    if (clean && clean !== OTHER_TAG) {
      // Reuse an existing category's spelling ("pants" -> "Pants") so votes line up.
      const known = await keywordCategories(supabase);
      saved = known.find((c) => c.toLowerCase() === clean.toLowerCase()) ?? clean;
    }
    if (saved === null) {
      await supabase.from("user_item_tags").delete().eq("user_id", userId).eq("item_key", key);
    } else {
      const { error } = await supabase
        .from("user_item_tags")
        .upsert({ user_id: userId, item_key: key, category: saved }, { onConflict: "user_id,item_key" });
      if (error) throw error;
    }
    await recountTag(createAdminClient(), key);
    revalidatePath("/", "layout");
    return { ok: true, category: saved === OTHER_TAG ? null : saved };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Couldn't save the category." };
  }
}
