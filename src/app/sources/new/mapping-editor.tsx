"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { spring } from "@/components/ui/motion";
import { formatPrice } from "@/lib/store";
import { cellImage, cellUrl } from "@/server/sheets/auto-map";
import { parsePrice } from "@/server/sheets/price";
import type { Cell, Grid, Mapping } from "@/server/sheets/types";
import type { MappingOrigin } from "@/server/sources";

type CoreField = "name" | "link" | "price" | "image";
type Active = CoreField | "custom" | null;

const FIELDS: { key: CoreField; label: string; required?: boolean; color: string }[] = [
  { key: "name", label: "Name", required: true, color: "#0a84ff" },
  { key: "link", label: "Purchase link", required: true, color: "#30b158" },
  { key: "price", label: "Price", color: "#ff9f0a" },
  { key: "image", label: "Image", color: "#bf5af2" },
];
const CUSTOM_COLOR = "#8e8e93";

const ORIGIN: Record<MappingOrigin, { label: string; className: string }> = {
  yours: { label: "Your saved mapping", className: "bg-hairline text-text" },
  preset: { label: "Mapped from other users’ setup", className: "bg-success/15 text-success" },
  auto: { label: "Guessed automatically — please check", className: "bg-accent/15 text-accent" },
};

export const colLetter = (i: number): string =>
  (i >= 26 ? colLetter(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));

export function MappingEditor({
  tabName,
  grid,
  totalRows,
  initial,
  origin,
  saving,
  onSave,
  onSkip,
}: {
  tabName: string;
  grid: Grid;
  totalRows: number;
  initial: Mapping;
  origin: MappingOrigin;
  saving: boolean;
  onSave: (m: Mapping) => void;
  onSkip: () => void;
}) {
  const [mapping, setMapping] = useState<Mapping>(initial);
  const [active, setActive] = useState<Active>(initial.name === null ? "name" : initial.link === null ? "link" : null);
  const width = Math.max(1, ...grid.map((r) => r.length));
  const header = mapping.headerRow >= 0 ? grid[mapping.headerRow] : undefined;

  const fieldForCol = (c: number): { label: string; color: string } | null => {
    const core = FIELDS.find((f) => mapping[f.key] === c);
    if (core) return core;
    const custom = mapping.custom.find((f) => f.col === c);
    return custom ? { label: custom.label || "Custom", color: CUSTOM_COLOR } : null;
  };

  function assign(col: number) {
    if (!active) return;
    // A column holds one field at a time: clear it from wherever it was.
    const next: Mapping = {
      ...mapping,
      custom: mapping.custom.filter((f) => f.col !== col),
      ...Object.fromEntries(FIELDS.filter((f) => mapping[f.key] === col).map((f) => [f.key, null])),
    };
    if (active === "custom") {
      const label = header?.[col]?.text.trim() || `Column ${colLetter(col)}`;
      next.custom = [...next.custom, { col, label: label.slice(0, 40) }].sort((a, b) => a.col - b.col);
    } else {
      next[active] = mapping[active] === col ? null : col;
    }
    setMapping(next);
    // Move on to a required field that's still empty.
    setActive(next.name === null ? "name" : next.link === null ? "link" : null);
  }

  const preview = useMemo(() => previewListings(grid, mapping), [grid, mapping]);
  const ready = mapping.name !== null && mapping.link !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">{tabName}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${ORIGIN[origin].className}`}>
          {ORIGIN[origin].label}
        </span>
        <span className="text-sm text-muted">{totalRows.toLocaleString()} rows</span>
      </div>

      {/* Field picker */}
      <div className="bubble space-y-4 p-4 sm:p-5">
        <p className="text-sm text-muted">
          Choose a field, then tap its column in the sheet below. Tap a row number to set the header row.
        </p>
        <div className="flex flex-wrap gap-2">
          {FIELDS.map((f) => (
            <FieldChip
              key={f.key}
              label={f.label}
              color={f.color}
              required={f.required}
              col={mapping[f.key]}
              active={active === f.key}
              onClick={() => setActive(active === f.key ? null : f.key)}
            />
          ))}
          <FieldChip
            label="+ Custom field"
            color={CUSTOM_COLOR}
            col={null}
            active={active === "custom"}
            onClick={() => setActive(active === "custom" ? null : "custom")}
          />
        </div>

        <AnimatePresence initial={false}>
          {mapping.custom.map((f) => (
            <motion.div
              key={f.col}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2"
            >
              <span className="w-10 shrink-0 text-center font-mono text-xs text-muted">{colLetter(f.col)}</span>
              <input
                value={f.label}
                maxLength={40}
                onChange={(e) =>
                  setMapping((m) => ({
                    ...m,
                    custom: m.custom.map((c) => (c.col === f.col ? { ...c, label: e.target.value } : c)),
                  }))
                }
                className="field max-w-xs py-2 text-sm"
                aria-label={`Label for column ${colLetter(f.col)}`}
              />
              <button
                type="button"
                onClick={() => setMapping((m) => ({ ...m, custom: m.custom.filter((c) => c.col !== f.col) }))}
                className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hairline hover:text-danger"
              >
                Remove
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sheet preview */}
      <div className="bubble overflow-hidden">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-max min-w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface shadow-[0_1px_0_var(--hairline)]">
                <th className="w-10 border-b border-hairline" />
                {Array.from({ length: width }, (_, c) => {
                  const f = fieldForCol(c);
                  return (
                    <th key={c} className="border-b border-hairline p-1.5 align-bottom font-normal">
                      <button
                        type="button"
                        onClick={() => assign(c)}
                        disabled={!active}
                        className={`flex w-full min-w-24 flex-col items-start gap-1 rounded-lg px-2 py-1 transition-colors ${
                          active ? "cursor-pointer hover:bg-accent/10" : "cursor-default"
                        }`}
                      >
                        <span className="font-mono text-[11px] text-muted">{colLetter(c)}</span>
                        <AnimatePresence mode="popLayout">
                          {f && (
                            <motion.span
                              key={f.label}
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.6, opacity: 0 }}
                              transition={spring.bouncy}
                              className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                              style={{ background: f.color }}
                            >
                              {f.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, r) => {
                const isHeader = r === mapping.headerRow;
                const above = r < mapping.headerRow;
                return (
                  <tr
                    key={r}
                    className={`border-b border-hairline ${isHeader ? "bg-accent/10 font-semibold" : ""} ${
                      above ? "opacity-40" : ""
                    }`}
                  >
                    <td className="px-1 text-center">
                      <button
                        type="button"
                        title="Use as header row"
                        onClick={() => setMapping((m) => ({ ...m, headerRow: m.headerRow === r ? -1 : r }))}
                        className={`w-8 rounded-md py-1 font-mono text-[11px] ${
                          isHeader ? "bg-accent text-accent-contrast" : "text-muted hover:bg-hairline"
                        }`}
                      >
                        {r + 1}
                      </button>
                    </td>
                    {Array.from({ length: width }, (_, c) => {
                      const f = fieldForCol(c);
                      return (
                        <td
                          key={c}
                          onClick={() => assign(c)}
                          className={`max-w-56 px-3 py-2 align-top ${active ? "cursor-pointer" : ""}`}
                          style={f ? { boxShadow: `inset 3px 0 0 ${f.color}` } : undefined}
                        >
                          <CellView cell={row[c]} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live product preview */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted">Preview</h3>
        {preview.length === 0 ? (
          <p className="bubble p-5 text-sm text-muted">
            {ready ? "No products found with this mapping. Check the header row and columns." : "Map Name and Purchase link to see products."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {preview.map((p, i) => (
              <motion.div
                key={p.row}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.soft, delay: i * 0.04 }}
                className="bubble overflow-hidden p-2.5"
              >
                <div className="aspect-square overflow-hidden rounded-2xl bg-surface-2">
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary sheet hosts
                    <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] font-medium">{p.name}</p>
                <p className="text-[13px] font-semibold">{p.price}</p>
                {p.custom.length > 0 && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted">
                    {p.custom.map((c) => `${c.label}: ${c.value}`).join(" · ")}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!ready && <span className="text-sm text-muted">Name and Purchase link are required</span>}
        <Button variant="ghost" onClick={onSkip} disabled={saving}>
          Skip this tab
        </Button>
        <Button onClick={() => onSave(mapping)} disabled={!ready || saving}>
          {saving ? "Saving…" : "Save tab"}
        </Button>
      </div>
    </div>
  );
}

function FieldChip({
  label,
  color,
  col,
  active,
  required,
  onClick,
}: {
  label: string;
  color: string;
  col: number | null;
  active: boolean;
  required?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={spring.snappy}
      aria-pressed={active}
      className="relative flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium"
      style={{
        borderColor: active ? color : "var(--hairline)",
        boxShadow: active ? `0 0 0 3px color-mix(in srgb, ${color} 25%, transparent)` : undefined,
      }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
      {required && col === null && <span className="text-danger">*</span>}
      {col !== null && <span className="font-mono text-xs text-muted">{colLetter(col)}</span>}
    </motion.button>
  );
}

function CellView({ cell }: { cell: Cell | undefined }) {
  if (!cell) return null;
  const img = cellImage(cell);
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary sheet hosts
    return <img src={img} alt="" className="h-10 w-10 rounded-md object-cover" loading="lazy" />;
  }
  const url = cellUrl(cell);
  return (
    <span className="line-clamp-2 break-all">
      {url && <span className="mr-1 text-accent">🔗</span>}
      {cell.text || (url ? hostOf(url) : "")}
    </span>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function previewListings(grid: Grid, m: Mapping) {
  if (m.name === null || m.link === null) return [];
  const out = [];
  for (let r = m.headerRow + 1; r < grid.length && out.length < 4; r++) {
    const row = grid[r];
    const name = row[m.name]?.text;
    if (!name || !cellUrl(row[m.link])) continue;
    const raw = m.price !== null ? (row[m.price]?.text ?? "") : "";
    out.push({
      row: r,
      name,
      price: formatPrice(parsePrice(raw).cents, raw),
      image: m.image !== null ? (cellImage(row[m.image]) ?? null) : null,
      custom: m.custom
        .map((c) => ({ label: c.label, value: row[c.col]?.text ?? "" }))
        .filter((c) => c.value && c.value.toLowerCase() !== "n/a"),
    });
  }
  return out;
}
