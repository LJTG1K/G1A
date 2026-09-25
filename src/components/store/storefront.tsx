"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { spring } from "@/components/ui/motion";
import {
  EMPTY_QUERY,
  PAGE_SIZE,
  storeQueryString,
  type Facets,
  type Product,
  type StoreQuery,
} from "@/lib/store";
import { loadProducts, refreshStore } from "@/app/store-actions";
import { ProductCard } from "./product-card";
import { ProductDetail } from "./product-detail";
import { StoreToolbar } from "./store-toolbar";

const REFRESH_KEY = "g1a-store-checked";
const REFRESH_EVERY_MS = 10 * 60 * 1000;

export function Storefront({
  initialQuery,
  initialProducts,
  initialTotal,
  facets,
  demo,
}: {
  initialQuery: StoreQuery;
  initialProducts: Product[];
  initialTotal: number;
  facets: Facets;
  demo: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [products, setProducts] = useState(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<Product | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "updated">("idle");
  // Local-only pins until boards arrive in M5.
  const [pins, setPins] = useState<Set<string>>(new Set());
  const requestId = useRef(0);
  const firstPage = useRef(PAGE_SIZE);

  // Re-query from the first page whenever filters change (not on first render).
  const isFirst = useRef(true);
  const runQuery = useCallback(
    async (q: StoreQuery) => {
      const id = ++requestId.current;
      setLoading(true);
      try {
        const res = await loadProducts(q, 0, demo);
        if (id !== requestId.current) return;
        setProducts(res.products);
        setTotal(res.total);
        firstPage.current = res.products.length;
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [demo],
  );

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    // Keep the URL shareable without re-rendering the server page.
    window.history.replaceState(null, "", `${window.location.pathname}${storeQueryString(query)}`);
    void runQuery(query);
  }, [query, runQuery]);

  // Infinite scroll.
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = products.length < total;
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const res = await loadProducts(query, products.length, demo);
      if (id !== requestId.current) return;
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.key));
        return [...prev, ...res.products.filter((p) => !seen.has(p.key))];
      });
      setTotal(res.total);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, hasMore, query, products.length, demo]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && void loadMore(), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // On open, check sheets for updates (at most every 10 minutes per tab session).
  useEffect(() => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(REFRESH_KEY)) || 0;
    } catch {}
    if (Date.now() - last < REFRESH_EVERY_MS) return;
    // Start after first paint so the store shows immediately.
    const start = setTimeout(async () => {
      setStatus("checking");
      const changed = await refreshStore(demo);
      try {
        sessionStorage.setItem(REFRESH_KEY, String(Date.now()));
      } catch {}
      if (!changed) return setStatus("idle");
      setStatus("updated");
      void runQuery(query);
      router.refresh();
      setTimeout(() => setStatus("idle"), 2500);
    }, 300);
    return () => clearTimeout(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePin = useCallback(
    (p: Product) =>
      setPins((prev) => {
        const next = new Set(prev);
        if (next.has(p.key)) next.delete(p.key);
        else next.add(p.key);
        return next;
      }),
    [],
  );

  const filtered =
    !!query.q || !!query.category || !!query.sheet || !!query.price;

  return (
    <>
      <StoreToolbar
        query={query}
        onChange={setQuery}
        facets={facets}
        total={total}
        loading={loading}
        status={status}
      />

      {demo && (
        <div className="bubble mb-6 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span>You’re browsing the demo store. Sign in to add your own sheets and pin products.</span>
          <Link
            href="/login"
            className="rounded-full bg-accent px-4 py-2 font-medium text-accent-contrast transition hover:brightness-110"
          >
            Sign in
          </Link>
        </div>
      )}

      <LayoutGroup>
        <motion.div
          animate={{ opacity: loading ? 0.5 : 1 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5"
        >
          {products.map((p, i) => (
            <ProductCard
              key={p.key}
              product={p}
              pinned={pins.has(p.key)}
              onPin={togglePin}
              onOpen={setOpen}
              // Stagger only within each page so later pages don't wait.
              delay={Math.min((i % PAGE_SIZE) * 0.02, 0.4)}
            />
          ))}
          {loadingMore && Array.from({ length: 5 }, (_, i) => <ProductCardSkeleton key={`s${i}`} />)}
        </motion.div>

        <ProductDetail
          product={open}
          pinned={!!open && pins.has(open.key)}
          onPin={() => open && togglePin(open)}
          onClose={() => setOpen(null)}
        />
      </LayoutGroup>

      <AnimatePresence>
        {!loading && products.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring.soft}
            className="bubble mx-auto mt-6 max-w-md p-8 text-center"
          >
            <p className="text-lg font-medium">{filtered ? "No products match" : "No products yet"}</p>
            <p className="mt-1 text-sm text-muted">
              {filtered ? "Try a different search or filter." : "Add a sheet to fill your store."}
            </p>
            {filtered ? (
              <button
                type="button"
                onClick={() => setQuery({ ...EMPTY_QUERY, sort: query.sort })}
                className="mt-4 rounded-full px-4 py-2 text-sm font-medium text-accent hover:bg-hairline"
              >
                Clear filters
              </button>
            ) : (
              !demo && (
                <Link href="/sources/new" className="mt-4 inline-block rounded-full px-4 py-2 text-sm font-medium text-accent hover:bg-hairline">
                  Add a sheet
                </Link>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={sentinel} className="h-px" />
      {!hasMore && products.length > PAGE_SIZE && (
        <p className="mt-10 text-center text-sm text-muted">That’s everything · {total.toLocaleString()} products</p>
      )}
    </>
  );
}
