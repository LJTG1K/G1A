"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, type Product, type StoreQuery } from "@/lib/store";
import { getStoreSources, queryProducts, refreshStale } from "@/server/store";

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
): Promise<{ products: Product[]; total: number }> {
  const { supabase, userId } = await viewer(demo);
  const sources = await getStoreSources(supabase, userId);
  return queryProducts(supabase, sources, query, Math.max(0, offset), PAGE_SIZE);
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
