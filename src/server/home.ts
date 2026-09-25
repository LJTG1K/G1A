import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { diffPin, hasChanges, type PinSnapshot } from "@/lib/pins";
import type { Product } from "@/lib/store";
import { productsByKeys } from "./pins";

/** Newest pinned products (current state) for the homepage, and how many changed. */
export async function recentPins(
  db: SupabaseClient,
  userId: string,
  limit: number,
): Promise<{ products: Product[]; changed: Set<string>; total: number }> {
  const { data } = await db.from("pins").select("item_key, snapshot, pinned_at").order("pinned_at", { ascending: false });
  const seen = new Map<string, PinSnapshot>();
  for (const p of data ?? []) if (!seen.has(p.item_key)) seen.set(p.item_key, p.snapshot as PinSnapshot);
  const keys = [...seen.keys()].slice(0, limit);
  const current = await productsByKeys(db, userId, keys);
  const changed = new Set(keys.filter((k) => hasChanges(diffPin(seen.get(k)!, current.get(k)))));
  // Pins no longer listed are left off the shelf; the boards page still shows them.
  return { products: keys.flatMap((k) => current.get(k) ?? []), changed, total: seen.size };
}
