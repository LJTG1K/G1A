"use client";

import { memo } from "react";
import { motion } from "motion/react";
import { spring } from "@/components/ui/motion";
import { formatPrice, type Product } from "@/lib/store";
import { PinButton } from "./pin-button";

/** Compact grid card: core fields + source badge only. */
export const ProductCard = memo(function ProductCard({
  product,
  pinned,
  onPin,
  onOpen,
  delay = 0,
  overlay,
  muted = false,
}: {
  product: Product;
  pinned: boolean;
  onPin: (p: Product) => void;
  onOpen: (p: Product) => void;
  delay?: number;
  /** Extra badges over the image (e.g. pin changes on board pages). */
  overlay?: React.ReactNode;
  /** Greyed out, e.g. no longer listed. */
  muted?: boolean;
}) {
  const sheets = new Set(product.listings.map((l) => l.sourceId)).size;
  return (
    <motion.article
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -6, boxShadow: "var(--shadow-lift)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ ...spring.soft, delay }}
      onClick={() => onOpen(product)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(product);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${product.name}, ${formatPrice(product.priceCents, product.priceRaw)}`}
      // Off-screen cards skip layout/paint until scrolled near.
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 340px" }}
      className={`bubble group cursor-pointer overflow-hidden p-3 ${muted ? "opacity-60 grayscale" : ""}`}
    >
      <div className="relative">
        <motion.div
          layoutId={`img-${product.key}`}
          className="aspect-square overflow-hidden rounded-[20px] bg-surface-2"
        >
          {product.image && (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary sheet image hosts
            <img
              src={product.image}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </motion.div>
        {overlay && <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">{overlay}</div>}
        <div className="absolute top-2 right-2">
          <PinButton pinned={pinned} onToggle={() => onPin(product)} />
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
            {sheets > 1 ? `${sheets} sheets` : product.listings[0]?.tab}
          </span>
        </div>
      </div>
    </motion.article>
  );
});
