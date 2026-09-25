"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { spring } from "@/components/ui/motion";
import { colLetter } from "@/lib/columns";
import { formatPrice } from "@/lib/store";
import { autoMapRows } from "@/server/sheets/auto-map";
import { detectBlocks, findBlocks } from "@/server/sheets/blocks";
import { cellImage, cellUrl, isPriceText } from "@/server/sheets/cells";
import { parsePrice } from "@/server/sheets/price";
import type { BlockMapping, Cell, Grid, Mapping, Offset, RowMapping } from "@/server/sheets/types";
import type { MappingOrigin } from "@/server/sources";

type CoreField = "name" | "link" | "price" | "image";
type Active = CoreField | "custom" | null;
type Pos = { r: number; c: number };
/** Block mode is edited on one example product, by absolute cell position. */
type Example = { name: Pos | null; link: Pos | null; price: Pos | null; image: Pos | null; custom: (Pos & { label: string })[] };

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

const cellRef = (p: Pos) => `${colLetter(p.c)}${p.r + 1}`;
const posKey = (r: number, c: number) => `${r},${c}`;
const add = (p: Pos, o: Offset | null): Pos | null => (o ? { r: p.r + o.dr, c: p.c + o.dc } : null);
const rel = (p: Pos | null, name: Pos): Offset | null => (p ? { dr: p.r - name.r, dc: p.c - name.c } : null);

function toBlockMapping(ex: Example): BlockMapping | null {
  if (!ex.name) return null;
  const n = ex.name;
  return {
    layout: "blocks",
    link: rel(ex.link, n),
    price: rel(ex.price, n),
    image: rel(ex.image, n),
    custom: ex.custom.map(({ label, ...p }) => ({ label, ...rel(p, n)! })),
  };
}

/** Example block for a mapping: the first product it finds in the preview. */
function exampleFor(grid: Grid, m: BlockMapping | null): Example {
  const empty: Example = { name: null, link: null, price: null, image: null, custom: [] };
  if (!m) return empty;
  const first = findBlocks(grid, m)[0];
  if (!first) return empty;
  return {
    name: first,
    link: add(first, m.link),
    price: add(first, m.price),
    image: add(first, m.image),
    custom: m.custom.map(({ label, ...o }) => ({ label, ...add(first, o)! })),
  };
}

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
  const [layout, setLayout] = useState<Mapping["layout"]>(initial.layout);
  const [rows, setRows] = useState<RowMapping>(() => (initial.layout === "rows" ? initial : autoMapRows(grid)));
  const [example, setExample] = useState<Example>(() =>
    exampleFor(grid, initial.layout === "blocks" ? initial : (detectBlocks(grid)?.mapping ?? null)),
  );
  const [active, setActive] = useState<Active>(null);

  const width = Math.max(1, ...grid.map((r) => r.length));
  const blockMapping = useMemo(() => toBlockMapping(example), [example]);
  const blocks = useMemo(() => (blockMapping?.link ? findBlocks(grid, blockMapping) : []), [grid, blockMapping]);

  // ── Rows mode ────────────────────────────────────────────────────────
  const header = rows.headerRow >= 0 ? grid[rows.headerRow] : undefined;
  const fieldForCol = (c: number): { label: string; color: string } | null => {
    const core = FIELDS.find((f) => rows[f.key] === c);
    if (core) return core;
    const custom = rows.custom.find((f) => f.col === c);
    return custom ? { label: custom.label || "Custom", color: CUSTOM_COLOR } : null;
  };

  function assignColumn(col: number) {
    if (!active) return;
    // A column holds one field at a time: clear it from wherever it was.
    const next: RowMapping = {
      ...rows,
      custom: rows.custom.filter((f) => f.col !== col),
      ...Object.fromEntries(FIELDS.filter((f) => rows[f.key] === col).map((f) => [f.key, null])),
    };
    if (active === "custom") {
      const label = header?.[col]?.text.trim() || `Column ${colLetter(col)}`;
      next.custom = [...next.custom, { col, label: label.slice(0, 40) }].sort((a, b) => a.col - b.col);
    } else {
      next[active] = rows[active] === col ? null : col;
    }
    setRows(next);
    setActive(next.name === null ? "name" : next.link === null ? "link" : null);
  }

  // ── Blocks mode ──────────────────────────────────────────────────────
  // Every cell of every detected block, coloured by field; the example block is filled.
  const blockCells = useMemo(() => {
    const map = new Map<string, { color: string; example: boolean }>();
    if (!blockMapping) return map;
    const mark = (p: Pos | null, color: string, example: boolean) => {
      if (p && !(map.get(posKey(p.r, p.c))?.example)) map.set(posKey(p.r, p.c), { color, example });
    };
    const colors: [Offset | null, string][] = [
      [{ dr: 0, dc: 0 }, FIELDS[0].color],
      [blockMapping.link, FIELDS[1].color],
      [blockMapping.price, FIELDS[2].color],
      [blockMapping.image, FIELDS[3].color],
      ...blockMapping.custom.map((o) => [o, CUSTOM_COLOR] as [Offset, string]),
    ];
    for (const b of blocks) for (const [o, color] of colors) mark(add(b, o), color, false);
    if (example.name) for (const [o, color] of colors) mark(add(example.name, o), color, true);
    return map;
  }, [blocks, blockMapping, example.name]);

  function assignCell(r: number, c: number) {
    if (!active) return;
    const p = { r, c };
    const same = (q: Pos | null) => !!q && q.r === r && q.c === c;
    // A cell holds one field at a time.
    const next: Example = {
      name: same(example.name) ? null : example.name,
      link: same(example.link) ? null : example.link,
      price: same(example.price) ? null : example.price,
      image: same(example.image) ? null : example.image,
      custom: example.custom.filter((f) => !same(f)),
    };
    if (active === "custom") next.custom = [...next.custom, { ...p, label: `Detail ${next.custom.length + 1}` }];
    else next[active] = same(example[active]) ? null : p;
    setExample(next);
    setActive(!next.name ? "name" : !next.link ? "link" : null);
  }

  // ── Shared ───────────────────────────────────────────────────────────
  const ready = layout === "rows" ? rows.name !== null && rows.link !== null : !!blockMapping?.link && blocks.length > 0;
  const preview = useMemo(
    () => (layout === "rows" ? previewRows(grid, rows) : blockMapping ? previewBlocks(grid, blockMapping, blocks) : []),
    [layout, grid, rows, blockMapping, blocks],
  );
  const assigned = (f: CoreField) =>
    layout === "rows" ? (rows[f] !== null ? colLetter(rows[f]!) : null) : example[f] ? cellRef(example[f]!) : null;
  const customs =
    layout === "rows"
      ? rows.custom.map((f) => ({ id: `c${f.col}`, ref: colLetter(f.col), label: f.label }))
      : example.custom.map((f) => ({ id: `b${f.r},${f.c}`, ref: cellRef(f), label: f.label }));

  const renameCustom = (i: number, label: string) =>
    layout === "rows"
      ? setRows((m) => ({ ...m, custom: m.custom.map((c, j) => (j === i ? { ...c, label } : c)) }))
      : setExample((e) => ({ ...e, custom: e.custom.map((c, j) => (j === i ? { ...c, label } : c)) }));
  const removeCustom = (i: number) =>
    layout === "rows"
      ? setRows((m) => ({ ...m, custom: m.custom.filter((_, j) => j !== i) }))
      : setExample((e) => ({ ...e, custom: e.custom.filter((_, j) => j !== i) }));

  const save = () => {
    if (layout === "rows") onSave(rows);
    else if (blockMapping) onSave(blockMapping);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">{tabName}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${ORIGIN[origin].className}`}>{ORIGIN[origin].label}</span>
        <span className="text-sm text-muted">{totalRows.toLocaleString()} rows</span>
      </div>

      {/* Layout + field picker */}
      <div className="bubble space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-medium">Layout</span>
          <Chip group="layout" active={layout === "rows"} onClick={() => setLayout("rows")}>
            One product per row
          </Chip>
          <Chip group="layout" active={layout === "blocks"} onClick={() => setLayout("blocks")}>
            Product blocks
          </Chip>
        </div>
        <p className="text-sm text-muted">
          {layout === "rows"
            ? "Choose a field, then tap its column in the sheet below. Tap a row number to set the header row."
            : "Choose a field, then tap that cell in one example product. Every product laid out the same way is found automatically — info rows and section titles are skipped."}
        </p>
        <div className="flex flex-wrap gap-2">
          {FIELDS.map((f) => (
            <FieldChip
              key={f.key}
              label={f.label}
              color={f.color}
              required={f.required}
              assigned={assigned(f.key)}
              active={active === f.key}
              onClick={() => setActive(active === f.key ? null : f.key)}
            />
          ))}
          <FieldChip
            label="+ Custom field"
            color={CUSTOM_COLOR}
            assigned={null}
            active={active === "custom"}
            onClick={() => setActive(active === "custom" ? null : "custom")}
          />
        </div>

        <AnimatePresence initial={false}>
          {customs.map((f, i) => (
            <motion.div
              key={f.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2"
            >
              <span className="w-12 shrink-0 text-center font-mono text-xs text-muted">{f.ref}</span>
              <input
                value={f.label}
                maxLength={40}
                onChange={(e) => renameCustom(i, e.target.value)}
                className="field max-w-xs py-2 text-sm"
                aria-label={`Label for ${f.ref}`}
              />
              <button
                type="button"
                onClick={() => removeCustom(i)}
                className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hairline hover:text-danger"
              >
                Remove
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {layout === "blocks" && (
          <p className="text-sm">
            <span className="font-medium">{blocks.length.toLocaleString()}</span>{" "}
            <span className="text-muted">
              {blocks.length === 1 ? "product" : "products"} found in this preview
              {blocks.length === 0 && " — tap the name and link of one product to start"}
            </span>
          </p>
        )}
      </div>

      {/* Sheet preview */}
      <div className="bubble overflow-hidden">
        <div className="max-h-[480px] overflow-auto">
          <table className="w-max min-w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface shadow-[0_1px_0_var(--hairline)]">
                <th className="w-10" />
                {Array.from({ length: width }, (_, c) => {
                  const f = layout === "rows" ? fieldForCol(c) : null;
                  const clickable = layout === "rows" && !!active;
                  return (
                    <th key={c} className="p-1.5 align-bottom font-normal">
                      <button
                        type="button"
                        onClick={() => assignColumn(c)}
                        disabled={!clickable}
                        className={`flex w-full min-w-24 flex-col items-start gap-1 rounded-lg px-2 py-1 transition-colors ${
                          clickable ? "cursor-pointer hover:bg-accent/10" : "cursor-default"
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
                const isHeader = layout === "rows" && r === rows.headerRow;
                const above = layout === "rows" && r < rows.headerRow;
                return (
                  <tr
                    key={r}
                    className={`border-b border-hairline ${isHeader ? "bg-accent/10 font-semibold" : ""} ${above ? "opacity-40" : ""}`}
                  >
                    <td className="px-1 text-center">
                      {layout === "rows" ? (
                        <button
                          type="button"
                          title="Use as header row"
                          onClick={() => setRows((m) => ({ ...m, headerRow: m.headerRow === r ? -1 : r }))}
                          className={`w-8 rounded-md py-1 font-mono text-[11px] ${
                            isHeader ? "bg-accent text-accent-contrast" : "text-muted hover:bg-hairline"
                          }`}
                        >
                          {r + 1}
                        </button>
                      ) : (
                        <span className="inline-block w-8 py-1 font-mono text-[11px] text-muted">{r + 1}</span>
                      )}
                    </td>
                    {Array.from({ length: width }, (_, c) => {
                      if (layout === "rows") {
                        const f = fieldForCol(c);
                        return (
                          <td
                            key={c}
                            onClick={() => assignColumn(c)}
                            className={`max-w-56 px-3 py-2 align-top ${active ? "cursor-pointer" : ""}`}
                            style={f ? { boxShadow: `inset 3px 0 0 ${f.color}` } : undefined}
                          >
                            <CellView cell={row[c]} />
                          </td>
                        );
                      }
                      const mark = blockCells.get(posKey(r, c));
                      return (
                        <td
                          key={c}
                          onClick={() => assignCell(r, c)}
                          className={`max-w-56 px-3 py-2 align-top transition-colors ${active ? "cursor-pointer hover:bg-accent/10" : ""}`}
                          style={
                            mark
                              ? {
                                  boxShadow: `inset 0 0 0 ${mark.example ? 2 : 1}px ${mark.color}`,
                                  background: mark.example ? `color-mix(in srgb, ${mark.color} 14%, transparent)` : undefined,
                                }
                              : undefined
                          }
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
            {layout === "rows"
              ? ready
                ? "No products found with this mapping. Check the header row and columns."
                : "Map Name and Purchase link to see products."
              : "Tap the name and purchase link of one product to see products."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {preview.map((p, i) => (
              <motion.div
                key={p.key}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.soft, delay: i * 0.04 }}
                className="bubble overflow-hidden p-2.5"
              >
                <div className="aspect-square overflow-hidden rounded-2xl bg-surface-2">
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary sheet hosts
                    <img src={p.image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" loading="lazy" />
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
        {!ready && (
          <span className="text-sm text-muted">
            {layout === "rows" ? "Name and Purchase link are required" : "Pick one product’s name and link"}
          </span>
        )}
        <Button variant="ghost" onClick={onSkip} disabled={saving}>
          Skip this tab
        </Button>
        <Button onClick={save} disabled={!ready || saving}>
          {saving ? "Saving…" : "Save tab"}
        </Button>
      </div>
    </div>
  );
}

function FieldChip({
  label,
  color,
  assigned,
  active,
  required,
  onClick,
}: {
  label: string;
  color: string;
  assigned: string | null;
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
      {required && assigned === null && <span className="text-danger">*</span>}
      {assigned !== null && <span className="font-mono text-xs text-muted">{assigned}</span>}
    </motion.button>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function CellView({ cell }: { cell: Cell | undefined }) {
  if (!cell) return null;
  const img = cellImage(cell);
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary sheet hosts
    return <img src={img} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-md object-cover" loading="lazy" />;
  }
  const url = cellUrl(cell);
  return (
    <span className="line-clamp-2 break-all">
      {url && <span className="mr-1 text-accent">🔗</span>}
      {cell.text || (url ? hostOf(url) : "")}
    </span>
  );
}

type PreviewItem = { key: string; name: string; price: string; image: string | null; custom: { label: string; value: string }[] };

function previewRows(grid: Grid, m: RowMapping): PreviewItem[] {
  if (m.name === null || m.link === null) return [];
  const out: PreviewItem[] = [];
  for (let r = m.headerRow + 1; r < grid.length && out.length < 4; r++) {
    const row = grid[r];
    const name = row[m.name]?.text;
    if (!name || !cellUrl(row[m.link])) continue;
    const raw = m.price !== null ? (row[m.price]?.text ?? "") : "";
    out.push({
      key: `r${r}`,
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

function previewBlocks(grid: Grid, m: BlockMapping, anchors: Pos[]): PreviewItem[] {
  const at = (p: Pos, o: Offset | null) => (o ? grid[p.r + o.dr]?.[p.c + o.dc] : undefined);
  return anchors.slice(0, 4).map((p) => {
    const text = at(p, m.price)?.text ?? "";
    const raw = isPriceText(text) ? text : "";
    return {
      key: `b${p.r},${p.c}`,
      name: grid[p.r][p.c].text,
      price: formatPrice(parsePrice(raw).cents, raw),
      image: cellImage(at(p, m.image)) ?? null,
      custom: m.custom
        .map(({ label, ...o }) => ({ label, value: at(p, o)?.text ?? "" }))
        .filter((c) => c.value && c.value.toLowerCase() !== "n/a"),
    };
  });
}
