import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { diffPin, hasChanges, productFromSnapshot, type PinChanges, type PinSnapshot } from "@/lib/pins";
import { EMPTY_QUERY, type Product } from "@/lib/store";
import { getStoreSources, queryProducts } from "./store";

export const DEFAULT_BOARD = "Saved";
const KEY_CHUNK = 120;

export type PinState = {
  boards: { id: string; name: string }[];
  /** product key -> ids of the boards it's pinned to */
  pins: Record<string, string[]>;
};

/** Boards and pinned keys for the signed-in user (drives the pin buttons everywhere). */
export async function getPinState(db: SupabaseClient, userId: string | null): Promise<PinState> {
  if (!userId) return { boards: [], pins: {} };
  const [{ data: boards }, { data: pins }] = await Promise.all([
    db.from("boards").select("id, name").eq("user_id", userId).order("created_at"),
    db.from("pins").select("board_id, item_key"),
  ]);
  const map: Record<string, string[]> = {};
  for (const p of pins ?? []) (map[p.item_key] ??= []).push(p.board_id);
  return { boards: boards ?? [], pins: map };
}

/** Current state of specific products across the user's sheets. */
export async function productsByKeys(
  db: SupabaseClient,
  userId: string,
  keys: string[],
): Promise<Map<string, Product>> {
  const out = new Map<string, Product>();
  if (!keys.length) return out;
  const sources = await getStoreSources(db, userId);
  for (let i = 0; i < keys.length; i += KEY_CHUNK) {
    const chunk = keys.slice(i, i + KEY_CHUNK);
    const { products } = await queryProducts(db, sources, EMPTY_QUERY, 0, KEY_CHUNK, chunk);
    for (const p of products) out.set(p.key, p);
  }
  return out;
}

export type BoardPin = {
  key: string;
  pinnedAt: string;
  /** Current product, or a stand-in from the snapshot if no longer listed. */
  product: Product;
  snapshot: PinSnapshot;
  changes: PinChanges;
};

export type BoardSummary = {
  id: string;
  name: string;
  count: number;
  changed: number;
  covers: string[];
};

type PinRow = { board_id: string; item_key: string; snapshot: PinSnapshot; pinned_at: string };

async function loadPins(db: SupabaseClient, userId: string, boardIds: string[]) {
  if (!boardIds.length) return { rows: [] as PinRow[], current: new Map<string, Product>() };
  const { data } = await db
    .from("pins")
    .select("board_id, item_key, snapshot, pinned_at")
    .in("board_id", boardIds)
    .order("pinned_at", { ascending: false });
  const rows = (data ?? []) as PinRow[];
  const current = await productsByKeys(db, userId, [...new Set(rows.map((r) => r.item_key))]);
  return { rows, current };
}

export async function getBoardSummaries(db: SupabaseClient, userId: string): Promise<BoardSummary[]> {
  const { data: boards } = await db.from("boards").select("id, name").eq("user_id", userId).order("created_at");
  const { rows, current } = await loadPins(db, userId, (boards ?? []).map((b) => b.id));
  return (boards ?? []).map((b) => {
    const mine = rows.filter((r) => r.board_id === b.id);
    return {
      id: b.id,
      name: b.name,
      count: mine.length,
      changed: mine.filter((r) => hasChanges(diffPin(r.snapshot, current.get(r.item_key)))).length,
      covers: mine
        .map((r) => current.get(r.item_key)?.image ?? r.snapshot.image)
        .filter((u): u is string => !!u)
        .slice(0, 4),
    };
  });
}

export async function getBoard(
  db: SupabaseClient,
  userId: string,
  boardId: string,
): Promise<{ id: string; name: string; pins: BoardPin[] } | null> {
  const { data: board } = await db.from("boards").select("id, name").eq("id", boardId).maybeSingle();
  if (!board) return null;
  const { rows, current } = await loadPins(db, userId, [board.id]);
  return {
    ...board,
    pins: rows.map((r) => {
      const now = current.get(r.item_key);
      return {
        key: r.item_key,
        pinnedAt: r.pinned_at,
        product: now ?? productFromSnapshot(r.item_key, r.snapshot),
        snapshot: r.snapshot,
        changes: diffPin(r.snapshot, now),
      };
    }),
  };
}
