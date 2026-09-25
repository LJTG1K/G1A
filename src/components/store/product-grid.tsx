"use client";

import { useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { staggerGrid } from "@/components/ui/motion";
import type { Product } from "@/lib/types";
import { ProductCard } from "./product-card";
import { ProductDetail } from "./product-detail";

export function ProductGrid({ products }: { products: Product[] }) {
  const [open, setOpen] = useState<Product | null>(null);
  // Local-only pins for the design preview; persisted boards arrive in M5.
  const [pins, setPins] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setPins((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <LayoutGroup>
      <motion.div
        variants={staggerGrid}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5"
      >
        {products.map((p) => (
          <ProductCard
            key={p.key}
            product={p}
            pinned={pins.has(p.key)}
            onPin={() => toggle(p.key)}
            onOpen={() => setOpen(p)}
          />
        ))}
      </motion.div>
      <ProductDetail
        product={open}
        pinned={!!open && pins.has(open.key)}
        onPin={() => open && toggle(open.key)}
        onClose={() => setOpen(null)}
      />
    </LayoutGroup>
  );
}
