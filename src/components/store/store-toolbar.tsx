"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Chip } from "@/components/ui/chip";
import {
  EMPTY_QUERY,
  OTHER_CATEGORY,
  PRICE_BUCKETS,
  SORTS,
  type Facets,
  type Sort,
  type StoreQuery,
} from "@/lib/store";

export function StoreToolbar({
  query,
  onChange,
  facets,
  total,
  loading,
  status,
  scopedToSheet = false,
}: {
  query: StoreQuery;
  onChange: (q: StoreQuery) => void;
  facets: Facets;
  total: number;
  loading: boolean;
  status: "idle" | "checking" | "updated";
  scopedToSheet?: boolean;
}) {
  // Search is debounced so typing doesn't fire a query per keystroke.
  const [text, setText] = useState(query.q);
  useEffect(() => {
    if (text.trim() === query.q) return;
    const t = setTimeout(() => onChange({ ...query, q: text.trim() }), 250);
    return () => clearTimeout(t);
  }, [text, query, onChange]);

  const set = (patch: Partial<StoreQuery>) => onChange({ ...query, ...patch });
  const named = facets.categories.filter((c) => c.category);
  const other = facets.categories.find((c) => !c.category);
  const anyFilter = !!(query.q || query.category || query.sheet || query.price);

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full basis-full sm:max-w-md sm:flex-1 sm:basis-auto">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 fill-none stroke-current stroke-2 text-muted"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Search ${facets.total.toLocaleString()} products`}
            aria-label="Search products"
            className="field pl-10"
          />
        </div>
        {/* One scrollable row on phones, inline beside search on wider screens. */}
        <div className="-mx-4 flex w-[calc(100%+2rem)] shrink-0 gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
          <Select
            label="Sort"
            value={query.sort}
            onChange={(v) => set({ sort: v as Sort })}
            options={SORTS.map((s) => ({ value: s.id, label: s.label }))}
          />
          {!scopedToSheet && (
          <Select
            label="Sheet"
            value={query.sheet ?? ""}
            onChange={(v) => set({ sheet: v || null })}
            options={[
              { value: "", label: "All sheets" },
              ...facets.sheets.map((s) => ({ value: s.id, label: `${s.label} (${s.count.toLocaleString()})` })),
            ]}
          />
          )}
          <Select
            label="Price"
            value={query.price ?? ""}
            onChange={(v) => set({ price: v || null })}
            options={[{ value: "", label: "Any price" }, ...PRICE_BUCKETS.map((b) => ({ value: b.id, label: b.label }))]}
          />
        </div>
      </div>

      {scopedToSheet && facets.sheets.length > 1 && (
        // One spreadsheet: its tabs as chips.
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip group="tab" active={!query.sheet} onClick={() => set({ sheet: null })}>
            All tabs
          </Chip>
          {facets.sheets.map((t) => (
            <Chip key={t.id} group="tab" active={query.sheet === t.id} onClick={() => set({ sheet: query.sheet === t.id ? null : t.id })}>
              {t.tab} <span className="opacity-60">{t.count.toLocaleString()}</span>
            </Chip>
          ))}
        </div>
      )}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip group="category" active={!query.category} onClick={() => set({ category: null })}>
          All
        </Chip>
        {named.map((c) => (
          <Chip
            key={c.category}
            group="category"
            active={query.category === c.category}
            onClick={() => set({ category: query.category === c.category ? null : c.category })}
          >
            {c.category} <span className="opacity-60">{c.count}</span>
          </Chip>
        ))}
        {other && (
          <Chip
            group="category"
            active={query.category === OTHER_CATEGORY}
            onClick={() => set({ category: query.category === OTHER_CATEGORY ? null : OTHER_CATEGORY })}
          >
            Other <span className="opacity-60">{other.count}</span>
          </Chip>
        )}
      </div>

      <div className="flex min-h-6 items-center gap-3 text-sm text-muted">
        <span aria-live="polite">
          {loading ? "Searching…" : `${total.toLocaleString()} ${total === 1 ? "product" : "products"}`}
          {query.q && !loading && ` for “${query.q}”`}
        </span>
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setText("");
              onChange({ ...EMPTY_QUERY, spreadsheet: query.spreadsheet, sort: query.sort });
            }}
            className="font-medium text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
        <AnimatePresence>
          {status !== "idle" && (
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="ml-auto flex items-center gap-2"
            >
              {status === "checking" ? (
                <>
                  <motion.span
                    className="h-3 w-3 rounded-full border-2 border-muted border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  />
                  Checking sheets for updates
                </>
              ) : (
                <span className="text-success">Sheets updated</span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Native select styled as a pill: accessible and good on phones. */
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`max-w-56 appearance-none truncate rounded-full border py-2.5 pr-9 pl-4 text-sm font-medium outline-none transition-colors focus:border-accent ${
          value && value !== "sheet" ? "border-accent bg-accent/10 text-accent" : "border-hairline bg-surface text-text"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 fill-none stroke-current stroke-2 text-muted"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
