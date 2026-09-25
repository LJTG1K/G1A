import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, parseStoreQuery } from "@/lib/store";
import { getStoreSources, queryFacets, queryProducts } from "@/server/store";
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
  const sources = await getStoreSources(supabase, userId);
  const [facets, first] = await Promise.all([
    queryFacets(supabase, sources),
    queryProducts(supabase, sources, query, 0, PAGE_SIZE),
  ]);
  // Each tab counts as a sheet, matching the "N sheets" badges on cards.
  const sheetCount = sources.length;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 pb-24 sm:px-6">
      <section className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Store. <span className="text-muted">Every sheet, one place.</span>
        </h1>
        <p className="mt-3 text-muted">
          {facets.total.toLocaleString()} products from {sheetCount} {sheetCount === 1 ? "sheet" : "sheets"}
        </p>
      </section>
      <Storefront
        // Remount when the query or viewer changes on a server navigation.
        key={`${userId ?? "demo"}`}
        initialQuery={query}
        initialProducts={first.products}
        initialTotal={first.total}
        facets={facets}
        demo={demo}
      />
    </main>
  );
}
