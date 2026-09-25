"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { snapshotOf } from "@/lib/pins";
import { DEFAULT_BOARD, productsByKeys } from "@/server/pins";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Db = Awaited<ReturnType<typeof requireUser>>["supabase"];

const MAX_BOARDS = 50;
const cleanName = (name: string) => name.trim().replace(/\s+/g, " ").slice(0, 40);

function done() {
  revalidatePath("/boards", "layout");
}

async function ownedBoardIds(db: Db, userId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data } = await db.from("boards").select("id").eq("user_id", userId).in("id", ids);
  return (data ?? []).map((b) => b.id);
}

/** The board a quick pin goes to: the requested one if it's yours, else your first board, else a new "Saved". */
async function targetBoard(db: Db, userId: string, preferred?: string | null) {
  if (preferred) {
    const { data } = await db.from("boards").select("id, name").eq("user_id", userId).eq("id", preferred).maybeSingle();
    if (data) return data;
  }
  const { data: first } = await db
    .from("boards")
    .select("id, name")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (first) return first;
  const { data, error } = await db.from("boards").insert({ user_id: userId, name: DEFAULT_BOARD }).select("id, name").single();
  if (error) throw error;
  return data;
}

/** Snapshot of the product as it is now, taken on the server (never trusted from the client). */
async function snapshot(db: Db, userId: string, key: string) {
  const product = (await productsByKeys(db, userId, [key])).get(key);
  return product ? snapshotOf(product) : null;
}

export async function savePin(
  key: string,
  preferredBoard?: string | null,
): Promise<Result<{ board: { id: string; name: string } }>> {
  const { id: userId, supabase } = await requireUser();
  try {
    const snap = await snapshot(supabase, userId, key);
    if (!snap) return { ok: false, error: "That product isn't in your store any more." };
    const board = await targetBoard(supabase, userId, preferredBoard);
    const { error } = await supabase
      .from("pins")
      .upsert({ board_id: board.id, item_key: key, snapshot: snap }, { onConflict: "board_id,item_key", ignoreDuplicates: true });
    if (error) throw error;
    done();
    return { ok: true, board };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Couldn't save the pin." };
  }
}

/** Puts a product on exactly these boards (adds and removes as needed). */
export async function setPinBoards(key: string, boardIds: string[]): Promise<Result<{ boardIds: string[] }>> {
  const { id: userId, supabase } = await requireUser();
  try {
    const { data: all } = await supabase.from("boards").select("id").eq("user_id", userId);
    const mine = new Set((all ?? []).map((b) => b.id));
    const wanted = boardIds.filter((id) => mine.has(id));

    const { data: existing } = await supabase.from("pins").select("board_id").eq("item_key", key);
    const have = new Set((existing ?? []).map((p) => p.board_id));

    const remove = [...have].filter((id) => !wanted.includes(id));
    const add = wanted.filter((id) => !have.has(id));
    if (remove.length) {
      const { error } = await supabase.from("pins").delete().eq("item_key", key).in("board_id", remove);
      if (error) throw error;
    }
    if (add.length) {
      const snap = await snapshot(supabase, userId, key);
      if (!snap) return { ok: false, error: "That product isn't in your store any more." };
      const { error } = await supabase.from("pins").insert(add.map((board_id) => ({ board_id, item_key: key, snapshot: snap })));
      if (error) throw error;
    }
    done();
    return { ok: true, boardIds: wanted };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Couldn't update boards." };
  }
}

/** Unpins from one board, or from every board when boardId is omitted. */
export async function removePin(key: string, boardId?: string): Promise<Result> {
  const { id: userId, supabase } = await requireUser();
  const ids = boardId
    ? await ownedBoardIds(supabase, userId, [boardId])
    : ((await supabase.from("boards").select("id").eq("user_id", userId)).data ?? []).map((b) => b.id);
  if (!ids.length) return { ok: true };
  const { error } = await supabase.from("pins").delete().eq("item_key", key).in("board_id", ids);
  if (error) return { ok: false, error: "Couldn't remove the pin." };
  done();
  return { ok: true };
}

export async function createBoard(name: string): Promise<Result<{ board: { id: string; name: string } }>> {
  const { id: userId, supabase } = await requireUser();
  const clean = cleanName(name);
  if (!clean) return { ok: false, error: "Give the board a name." };
  const { count } = await supabase.from("boards").select("*", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= MAX_BOARDS) return { ok: false, error: `You can have up to ${MAX_BOARDS} boards.` };
  const { data, error } = await supabase.from("boards").insert({ user_id: userId, name: clean }).select("id, name").single();
  if (error) return { ok: false, error: "Couldn't create the board." };
  done();
  return { ok: true, board: data };
}

export async function renameBoard(id: string, name: string): Promise<Result<{ name: string }>> {
  const { id: userId, supabase } = await requireUser();
  const clean = cleanName(name);
  if (!clean) return { ok: false, error: "Give the board a name." };
  const { error } = await supabase.from("boards").update({ name: clean }).eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: "Couldn't rename the board." };
  done();
  return { ok: true, name: clean };
}

export async function deleteBoard(id: string): Promise<Result> {
  const { id: userId, supabase } = await requireUser();
  const { error } = await supabase.from("boards").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: "Couldn't delete the board." };
  done();
  return { ok: true };
}

/** Accepts the current state as the new baseline, clearing change badges (one pin or the whole board). */
export async function markSeen(boardId: string, key?: string): Promise<Result> {
  const { id: userId, supabase } = await requireUser();
  if (!(await ownedBoardIds(supabase, userId, [boardId])).length) return { ok: false, error: "Board not found." };

  let q = supabase.from("pins").select("item_key").eq("board_id", boardId);
  if (key) q = q.eq("item_key", key);
  const { data: pins } = await q;
  const keys = (pins ?? []).map((p) => p.item_key);
  const current = await productsByKeys(supabase, userId, keys);

  for (const k of keys) {
    const product = current.get(k);
    // Pins that are no longer listed keep their last known snapshot.
    if (!product) continue;
    const { error } = await supabase
      .from("pins")
      .update({ snapshot: snapshotOf(product) })
      .eq("board_id", boardId)
      .eq("item_key", k);
    if (error) return { ok: false, error: "Couldn't update the board." };
  }
  done();
  return { ok: true };
}
