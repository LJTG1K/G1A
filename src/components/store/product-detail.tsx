"use client";

import { motion } from "motion/react";
import { Sheet } from "@/components/ui/sheet";
import { riseIn, staggerGrid } from "@/components/ui/motion";
import { formatPrice, type Product } from "@/lib/store";
import { PinButton } from "./pin-button";

/** Full card: everything, including custom fields and every listing (cheapest first). */
export function ProductDetail({
  product,
  pinned,
  onPin,
  onClose,
}: {
  product: Product | null;
  pinned: boolean;
  onPin: () => void;
  onClose: () => void;
}) {
  const listings = product?.listings ?? [];
  const sheets = new Set(listings.map((l) => l.sourceId)).size;
  // Listings arrive cheapest first; only call it "Lowest" if it actually beats the rest.
  const cheapestIsUnique =
    listings.length > 1 && listings[0].priceCents !== null && listings.slice(1).every((l) => l.priceCents === null || l.priceCents > listings[0].priceCents!);

  return (
    <Sheet open={!!product} onClose={onClose} label={product?.name ?? "Product"}>
      {product && (
        <div className="grid gap-6 p-4 sm:grid-cols-2 sm:p-6">
          <motion.div
            layoutId={`img-${product.key}`}
            className="aspect-square overflow-hidden rounded-[22px] bg-surface-2"
          >
            {product.image && (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary sheet image hosts
              <img
                src={product.image}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            )}
          </motion.div>

          <motion.div variants={staggerGrid} initial="hidden" animate="show" className="flex min-w-0 flex-col">
            <div className="flex items-start justify-between gap-3">
              <motion.h2 layoutId={`name-${product.key}`} className="text-2xl font-semibold tracking-tight">
                {product.name}
              </motion.h2>
              <PinButton pinned={pinned} onToggle={onPin} size="lg" />
            </div>
            <motion.div variants={riseIn} className="mt-2 flex items-baseline gap-3">
              <span className="text-2xl font-semibold">{formatPrice(product.priceCents, product.priceRaw)}</span>
              {product.category && <span className="text-sm text-muted">{product.category}</span>}
            </motion.div>

            {product.custom.length > 0 && (
              <motion.dl variants={riseIn} className="mt-5 space-y-2 text-sm">
                {product.custom.map((f) => (
                  <div key={f.label} className="flex gap-3">
                    <dt className="w-24 shrink-0 text-muted">{f.label}</dt>
                    <dd className="min-w-0 break-words">{f.value}</dd>
                  </div>
                ))}
              </motion.dl>
            )}

            <motion.div variants={riseIn} className="mt-6">
              <h3 className="text-sm font-medium text-muted">
                {sheets > 1 ? `Available in ${sheets} sheets` : "Available from"}
              </h3>
              <ul className="mt-2 space-y-2">
                {listings.map((l, i) => (
                  <li
                    key={`${l.sourceId}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface-2 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.sheet}</p>
                      {l.name !== product.name && <p className="truncate text-xs text-muted">{l.name}</p>}
                      <p className="text-sm text-muted">
                        {formatPrice(l.priceCents, l.priceRaw)}
                        {i === 0 && cheapestIsUnique && <span className="ml-2 text-success">Lowest</span>}
                      </p>
                    </div>
                    <a
                      href={l.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition hover:brightness-110 active:scale-95"
                    >
                      Buy
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      )}
    </Sheet>
  );
}
