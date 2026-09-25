"use client";

import { motion } from "motion/react";
import { riseIn, spring } from "@/components/ui/motion";
import { formatPrice, type Product } from "@/lib/types";
import { PinButton } from "./pin-button";

/** Compact grid card: core fields + source badge only. */
export function ProductCard({
  product,
  pinned,
  onPin,
  onOpen,
}: {
  product: Product;
  pinned: boolean;
  onPin: () => void;
  onOpen: () => void;
}) {
  const sheets = product.listings.length;
  return (
    <motion.article
      variants={riseIn}
      whileHover={{ y: -6, boxShadow: "var(--shadow-lift)" }}
      whileTap={{ scale: 0.98 }}
      transition={spring.soft}
      onClick={onOpen}
      className="bubble group cursor-pointer overflow-hidden p-3"
    >
      <div className="relative">
        <motion.div
          layoutId={`img-${product.key}`}
          className="aspect-square overflow-hidden rounded-[20px] bg-surface-2"
        >
          {product.image && (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary sheet hosts; proxied in M2
            <img
              src={product.image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </motion.div>
        <div className="absolute top-2 right-2">
          <PinButton pinned={pinned} onToggle={onPin} />
        </div>
      </div>
      <div className="px-1 pt-3 pb-1">
        <motion.h3 layoutId={`name-${product.key}`} className="line-clamp-2 text-[15px] leading-snug font-medium">
          {product.name}
        </motion.h3>
        <div className="mt-1.5 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <span className="shrink-0 text-[15px] font-semibold">
            {sheets > 1 && <span className="mr-1 text-xs font-normal text-muted">from</span>}
            {formatPrice(product.priceCents, product.priceRaw)}
          </span>
          <span className="max-w-full truncate rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-muted">
            {sheets > 1 ? `${sheets} sheets` : product.listings[0]?.sheet}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
