import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { colLetter } from "@/lib/columns";
import { createAdminClient } from "@/lib/supabase/server";
import type { StoredColumns } from "@/server/sheets/sync";
import type { Offset } from "@/server/sheets/types";
import { PRESET_VOTES } from "@/server/sources";
import { SHARED_TAG_VOTES } from "@/server/categories";
import { AdminPanel, type PresetRow, type TagRow } from "./admin-panel";

export const metadata: Metadata = { title: "Admin" };

/** "right 1, down 2" for a block offset relative to the name cell. */
const where = (o: Offset) =>
  [o.dc && `${o.dc > 0 ? "right" : "left"} ${Math.abs(o.dc)}`, o.dr && `${o.dr > 0 ? "down" : "up"} ${Math.abs(o.dr)}`]
    .filter(Boolean)
    .join(", ") || "same cell";

function describe(headerRow: number, c: StoredColumns): string {
  if (c.layout === "blocks") {
    return [
      "Product blocks",
      c.link && `Link ${where(c.link)}`,
      c.image && `Image ${where(c.image)}`,
      c.price && `Price ${where(c.price)}`,
      ...c.custom.map((f) => `${f.label} ${where(f)}`),
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return [
    headerRow >= 0 ? `Header row ${headerRow + 1}` : "No header",
    c.name !== null && `Name ${colLetter(c.name)}`,
    c.link !== null && `Link ${colLetter(c.link)}`,
    c.price !== null && `Price ${colLetter(c.price)}`,
    c.image !== null && `Image ${colLetter(c.image)}`,
    ...c.custom.map((f) => `${f.label} ${colLetter(f.col)}`),
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const admin = createAdminClient();

  const [{ data: keywords }, { data: presets }, { data: tags }, { count: users }] = await Promise.all([
    supabase.from("category_keywords").select("id, category, keyword").order("category").order("keyword"),
    supabase
      .from("mapping_presets")
      .select("source_id, signature, header_row, columns, votes, approved, updated_at, sources(tab_name, sheet_title, is_featured)")
      .order("updated_at", { ascending: false }),
    supabase.from("shared_item_tags").select("item_key, category, votes, approved").order("votes", { ascending: false }),
    admin.from("profiles").select("*", { count: "exact", head: true }),
  ]);

  // Product names for shared tags (keys may carry a "#n" suffix for repeated links).
  const baseKeys = [...new Set((tags ?? []).map((t) => t.item_key.split("#")[0]))];
  const { data: names } = baseKeys.length
    ? await supabase.from("listings").select("item_key, name").in("item_key", baseKeys)
    : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.item_key, n.name as string]));

  const presetRows: PresetRow[] = (presets ?? []).map((p) => {
    const s = p.sources as unknown as { tab_name: string; sheet_title: string | null; is_featured: boolean } | null;
    return {
      sourceId: p.source_id,
      signature: p.signature,
      tab: s?.tab_name ?? "?",
      sheet: s?.sheet_title ?? "Google Sheet",
      featured: !!s?.is_featured,
      summary: describe(p.header_row, p.columns as StoredColumns),
      votes: p.votes,
      approved: p.approved,
    };
  });

  const tagRows: TagRow[] = (tags ?? []).map((t) => ({
    itemKey: t.item_key,
    name: nameOf.get(t.item_key.split("#")[0]) ?? t.item_key,
    category: t.category === "__other__" ? "Other" : t.category,
    rawCategory: t.category,
    votes: t.votes,
    approved: t.approved,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-24 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 text-muted">
        {users ?? 0} {users === 1 ? "user" : "users"} · Presets go live at {PRESET_VOTES} matching users, shared
        categories at {SHARED_TAG_VOTES} — or immediately when you approve them.
      </p>
      <AdminPanel keywords={keywords ?? []} presets={presetRows} tags={tagRows} />
    </main>
  );
}
