"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { spring } from "@/components/ui/motion";
import { usePins } from "@/components/pins/pins-provider";
import { ProductCard } from "@/components/store/product-card";
import { ProductDetail } from "@/components/store/product-detail";
import { useSheetRefresh } from "@/components/store/use-sheet-refresh";
import type { Product } from "@/lib/store";

export type ShelfView = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  tabs?: { name: string; href: string }[];
  products: Product[];
  /** Product keys to badge as changed (pins shelf). */
  changed: string[];
};

export function HomeShelves({ shelves, demo }: { shelves: ShelfView[]; demo: boolean }) {
  const router = useRouter();
  const pins = usePins();
  // Which shelf the open product came from, so the detail morphs out of that card.
  const [open, setOpen] = useState<{ product: Product; scope: string } | null>(null);
  const status = useSheetRefresh(demo, () => router.refresh());

  return (
    <LayoutGroup>
      <AnimatePresence>
        {status !== "idle" && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`-mt-6 mb-6 text-sm ${status === "updated" ? "text-success" : "text-muted"}`}
          >
            {status === "checking" ? "Checking sheets for updates…" : "Sheets updated"}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="space-y-12">
        {shelves.map((s) => (
          <Shelf key={s.id} shelf={s} pinned={pins.isPinned} onPin={pins.toggle} onOpen={(product) => setOpen({ product, scope: `${s.id}:` })} />
        ))}
      </div>

      <ProductDetail
        product={open?.product ?? null}
        layoutScope={open?.scope}
        pinned={!!open && pins.isPinned(open.product.key)}
        onPin={() => open && pins.toggle(open.product)}
        onChooseBoards={() => open && pins.choose(open.product)}
        onClose={() => setOpen(null)}
      />
    </LayoutGroup>
  );
}

function Shelf({
  shelf,
  pinned,
  onPin,
  onOpen,
}: {
  shelf: ShelfView;
  pinned: (key: string) => boolean;
  onPin: (p: Product) => void;
  onOpen: (p: Product) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const scroll = useCallback((dir: 1 | -1) => {
    const el = row.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }, []);
  const changed = new Set(shelf.changed);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={spring.soft}
      aria-label={shelf.title}
    >
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold tracking-tight">{shelf.title}</h2>
          <p className="mt-0.5 text-sm text-muted">{shelf.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ArrowButton dir={-1} onClick={() => scroll(-1)} />
          <ArrowButton dir={1} onClick={() => scroll(1)} />
          <Link href={shelf.href} className="ml-1 rounded-full px-3 py-1.5 text-sm font-medium text-accent hover:bg-hairline">
            See all ›
          </Link>
        </div>
      </div>

      {shelf.tabs && shelf.tabs.length > 0 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {shelf.tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="shrink-0 rounded-full border border-hairline bg-surface px-3.5 py-1.5 text-sm transition-colors hover:bg-surface-2"
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      <div
        ref={row}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-4 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0"
      >
        {shelf.products.map((p, i) => (
          <div key={p.key} className="w-[44vw] max-w-56 shrink-0 snap-start sm:w-52 lg:w-56">
            <ProductCard
              product={p}
              pinned={pinned(p.key)}
              onPin={onPin}
              onOpen={onOpen}
              delay={Math.min(i * 0.03, 0.3)}
              layoutScope={`${shelf.id}:`}
              overlay={
                changed.has(p.key) ? (
                  <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-contrast">Changed</span>
                ) : undefined
              }
            />
          </div>
        ))}
        <Link
          href={shelf.href}
          className="bubble grid w-[44vw] max-w-56 shrink-0 snap-start place-items-center p-6 text-center transition-colors hover:bg-surface-2 sm:w-52 lg:w-56"
        >
          <span>
            <span className="block text-3xl" aria-hidden>
              ›
            </span>
            <span className="mt-1 block text-sm font-medium">See all</span>
          </span>
        </Link>
      </div>
    </motion.section>
  );
}

function ArrowButton({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-label={dir > 0 ? "Scroll right" : "Scroll left"}
      className="hidden h-8 w-8 place-items-center rounded-full border border-hairline bg-surface text-muted transition-colors hover:text-text sm:grid"
    >
      {dir > 0 ? "›" : "‹"}
    </motion.button>
  );
}
