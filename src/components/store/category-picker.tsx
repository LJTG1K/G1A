"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { spring } from "@/components/ui/motion";
import { OTHER_CATEGORY, type Product } from "@/lib/store";

/**
 * "Change category": file a product under an existing or new category for yourself.
 * Three users agreeing makes it the category everyone sees.
 */
export function CategoryPicker({
  product,
  categories,
  onPick,
  onClose,
}: {
  product: Product | null;
  categories: string[];
  /** null = back to automatic, OTHER_CATEGORY = no category */
  onPick: (category: string | null) => Promise<boolean>;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!product} onClose={onClose} label="Change category" size="sm">
      {product && <Body key={product.key} product={product} categories={categories} onPick={onPick} onClose={onClose} />}
    </Sheet>
  );
}

function Body({
  product,
  categories,
  onPick,
  onClose,
}: {
  product: Product;
  categories: string[];
  onPick: (category: string | null) => Promise<boolean>;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [pending, start] = useTransition();

  const pick = (c: string | null) =>
    start(async () => {
      if (await onPick(c)) onClose();
    });

  return (
    <div className="p-5">
      <h2 className="text-lg font-semibold">Change category</h2>
      <p className="mt-0.5 truncate text-sm text-muted">{product.name}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {[...categories, OTHER_CATEGORY].map((c, i) => {
          const current = c === OTHER_CATEGORY ? product.category === null : product.category === c;
          return (
            <motion.button
              key={c}
              type="button"
              disabled={pending}
              onClick={() => pick(c)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.94 }}
              transition={{ ...spring.snappy, delay: i * 0.01 }}
              aria-pressed={current}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                current ? "border-accent bg-accent text-accent-contrast" : "border-hairline bg-surface-2 hover:bg-hairline"
              }`}
            >
              {c === OTHER_CATEGORY ? "Other" : c}
            </motion.button>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) pick(custom);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          maxLength={30}
          placeholder="New category, e.g. Vests"
          aria-label="New category"
          className="field py-2.5 text-sm"
        />
        <Button type="submit" variant="secondary" disabled={pending || !custom.trim()}>
          Save
        </Button>
      </form>

      <p className="mt-4 text-xs text-muted">
        Only you see your choice at first. When 3 people file an item the same way, everyone sees it.
      </p>
      <div className="mt-4 flex justify-between gap-2">
        <Button variant="ghost" onClick={() => pick(null)} disabled={pending}>
          Reset to automatic
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
