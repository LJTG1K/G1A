import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HomeShelves, type ShelfView } from "@/components/home/home-shelves";
import { HomeSearch } from "@/components/home/home-search";
import { recentPins } from "@/server/home";
import { getShelves, getStoreSources } from "@/server/store";

const PER_SHELF = 14;

/** Homepage: one shelf per spreadsheet, plus the viewer's recent pins. */
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;

  const sources = await getStoreSources(supabase, userId);
  const [shelves, pins] = await Promise.all([
    getShelves(supabase, sources, PER_SHELF),
    userId ? recentPins(supabase, userId, PER_SHELF) : null,
  ]);
  const total = shelves.reduce((n, s) => n + s.total, 0);
  const ownSheets = shelves.filter((s) => !s.featured).length;

  const views: ShelfView[] = [
    ...(pins && pins.products.length
      ? [
          {
            id: "pins",
            title: "From your boards",
            subtitle: pins.changed.size
              ? `${pins.changed.size} changed since you pinned ${pins.changed.size === 1 ? "it" : "them"}`
              : `${pins.total} pinned`,
            href: "/boards",
            products: pins.products,
            changed: [...pins.changed],
          },
        ]
      : []),
    ...shelves.map((s) => ({
      id: s.sheetId,
      title: s.title,
      subtitle: `${s.total.toLocaleString()} ${s.total === 1 ? "product" : "products"}${s.featured ? " · Featured" : ""}`,
      href: `/store?ss=${encodeURIComponent(s.sheetId)}`,
      tabs: s.tabs.length > 1 ? s.tabs.map((t) => ({ name: t.name, href: `/store?ss=${encodeURIComponent(s.sheetId)}&sheet=${t.id}` })) : [],
      products: s.products,
      changed: [],
    })),
  ];

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 pb-24 sm:px-6">
      <section className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Store. <span className="text-muted">Every sheet, one place.</span>
        </h1>
        <p className="mt-3 text-muted">
          {total.toLocaleString()} products from {shelves.length} {shelves.length === 1 ? "sheet" : "sheets"}
        </p>
        <HomeSearch total={total} />
      </section>

      {!userId && (
        <div className="bubble mb-8 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span>You’re browsing the demo. Sign in to add your own sheets and pin products.</span>
          <Link href="/login" className="rounded-full bg-accent px-4 py-2 font-medium text-accent-contrast hover:brightness-110">
            Sign in
          </Link>
        </div>
      )}

      <HomeShelves shelves={views} demo={!userId} />

      {userId && ownSheets === 0 && (
        <div className="bubble mt-10 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-medium">Add your first sheet</p>
            <p className="text-sm text-muted">Paste any public buying spreadsheet and it gets its own shelf here.</p>
          </div>
          <Link href="/sources/new" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast hover:brightness-110">
            Add sheet
          </Link>
        </div>
      )}
    </main>
  );
}
