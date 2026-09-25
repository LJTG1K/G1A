import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, parseStoreQuery } from "@/lib/store";
import { keywordCategories } from "@/server/categories";
import Link from "next/link";
import { getStoreSources, queryFacets, queryProducts, scopeSources } from "@/server/store";
import { Storefront } from "./storefront";

/** Server-rendered first page of the store; the client takes over for filters and scrolling. */
export async function StorePage({
  searchParams,
  forceDemo = false,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  forceDemo?: boolean;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = forceDemo ? null : ((data?.claims?.sub as string | undefined) ?? null);
  const demo = !userId;

  const query = parseStoreQuery(searchParams);
  const sources = scopeSources(await getStoreSources(supabase, userId), query.spreadsheet);
  // Scoped to one spreadsheet (from a homepage shelf) when all sources share its id.
  const scoped = query.spreadsheet && sources.every((s) => s.sheetId === query.spreadsheet) ? sources[0] : null;
  const [facets, first, keywordCats] = await Promise.all([
    queryFacets(supabase, sources),
    queryProducts(supabase, sources, query, 0, PAGE_SIZE),
    keywordCategories(supabase),
  ]);
  // Everything a product can be filed under: keyword categories plus any in use.
  const categories = [
    ...new Set([...keywordCats, ...facets.categories.flatMap((c) => (c.category ? [c.category] : []))]),
  ].sort();
  // Each tab counts as a sheet, matching the "N sheets" badges on cards.
  const sheetCount = sources.length;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 pb-24 sm:px-6">
      <section className="mb-8">
        {scoped ? (
          <>
            <Link href="/" className="text-sm text-muted hover:text-text">
              ← Home
            </Link>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{scoped.sheetTitle}</h1>
            <p className="mt-3 text-muted">
              {facets.total.toLocaleString()} products · {sheetCount} {sheetCount === 1 ? "tab" : "tabs"}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              All products. <span className="text-muted">Every sheet, one grid.</span>
            </h1>
            <p className="mt-3 text-muted">
              {facets.total.toLocaleString()} products from {sheetCount} {sheetCount === 1 ? "sheet" : "sheets"}
            </p>
          </>
        )}
      </section>
      <Storefront
        // Remount when the viewer or spreadsheet scope changes on a server navigation.
        key={`${userId ?? "demo"}-${scoped?.sheetId ?? "all"}`}
        scopedToSheet={!!scoped}
        initialQuery={query}
        initialProducts={first.products}
        initialTotal={first.total}
        facets={facets}
        categories={categories}
        demo={demo}
      />
    </main>
  );
}
