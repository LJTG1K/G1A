import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SourceList, type SourceItem } from "./source-list";

export const metadata: Metadata = { title: "Sheets" };

type SourceRow = { id: string; sheet_id: string; gid: string; tab_name: string; sheet_title: string | null };

export default async function SourcesPage() {
  const { id: userId, supabase } = await requireUser();

  const [{ data: mine }, { data: featured }] = await Promise.all([
    supabase
      .from("user_sources")
      .select("added_at, sources(id, sheet_id, gid, tab_name, sheet_title), mappings(signature)")
      .eq("user_id", userId)
      .order("added_at", { ascending: false }),
    supabase
      .from("sources")
      .select("id, sheet_id, gid, tab_name, sheet_title, mapping_presets(signature, approved)")
      .eq("is_featured", true),
  ]);

  const rows = [
    ...(featured ?? []).map((s) => ({
      source: s as SourceRow,
      signature: (s.mapping_presets as { signature: string; approved: boolean }[]).find((p) => p.approved)?.signature,
      featured: true,
    })),
    ...(mine ?? []).map((r) => ({
      source: r.sources as unknown as SourceRow,
      signature: (r.mappings as unknown as { signature: string } | null)?.signature,
      featured: false,
    })),
  ];

  const ids = rows.map((r) => r.source.id);
  const [{ data: snaps }, counts] = await Promise.all([
    supabase.from("snapshots").select("source_id, fetched_at").in("source_id", ids.length ? ids : [""]),
    Promise.all(
      rows.map(async (r) => {
        if (!r.signature) return 0;
        const { count } = await supabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("source_id", r.source.id)
          .eq("signature", r.signature);
        return count ?? 0;
      }),
    ),
  ]);
  const fetched = new Map((snaps ?? []).map((s) => [s.source_id, s.fetched_at as string]));

  const items: SourceItem[] = rows.map((r, i) => ({
    id: r.source.id,
    tabName: r.source.tab_name,
    sheetTitle: r.source.sheet_title,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${r.source.sheet_id}/edit#gid=${r.source.gid}`,
    featured: r.featured,
    products: counts[i],
    fetchedAt: fetched.get(r.source.id) ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-10 pb-24 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Sheets</h1>
          <p className="mt-2 text-muted">Every tab here feeds your store.</p>
        </div>
        <Link
          href="/sources/new"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition hover:brightness-110 active:scale-95"
        >
          Add sheet
        </Link>
      </div>
      <SourceList items={items} />
    </main>
  );
}
