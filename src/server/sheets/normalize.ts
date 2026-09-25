import { blockIndex, findBlocks } from "./blocks";
import { cellImage, cellUrl, isPriceText } from "./cells";
import type { Categorizer } from "./categorize";
import { extractItemKey } from "./item-id";
import { parsePrice } from "./price";
import type { BlockMapping, Cell, Grid, Mapping, NormalizedListing, RowMapping } from "./types";

const EMPTY_VALUES = new Set(["", "n/a", "na", "-", "—", "none", "null", "tbd"]);
const isEmpty = (s: string) => EMPTY_VALUES.has(s.trim().toLowerCase());

type Opts = { categorize?: Categorizer; defaultCurrency?: string };

/** Fields for one product, however the sheet lays them out. */
type Raw = { position: number; name: string; link: string; price?: Cell; image?: Cell; custom: { label: string; cell?: Cell }[] };

function toListing(raw: Raw, opts: Opts, strictPrice: boolean): NormalizedListing {
  // In block layouts a price offset can land on a neighbour's name; only trust real prices.
  const priceText = raw.price?.text ?? "";
  const priceRaw = strictPrice && !isPriceText(priceText) ? "" : priceText;
  const { cents, currency } = parsePrice(priceRaw, opts.defaultCurrency);
  const { key, mergeable } = extractItemKey(raw.link);
  return {
    rowIndex: raw.position,
    itemKey: key,
    mergeable,
    name: raw.name,
    priceCents: cents,
    priceRaw,
    currency,
    imageUrl: cellImage(raw.image) ?? null,
    link: raw.link,
    custom: raw.custom
      .map(({ label, cell }) => ({ label, value: cell?.text || cellUrl(cell) || "" }))
      .filter((f) => !isEmpty(f.value)),
    category: opts.categorize?.(raw.name) ?? null,
  };
}

function rowsOf(grid: Grid, m: RowMapping): Raw[] {
  if (m.name === null || m.link === null) return [];
  const header = m.headerRow >= 0 ? grid[m.headerRow] : undefined;
  const out: Raw[] = [];
  for (let r = m.headerRow + 1; r < grid.length; r++) {
    const row = grid[r];
    const name = row[m.name]?.text ?? "";
    const link = cellUrl(row[m.link]);
    if (isEmpty(name) || !link) continue;
    if (header && name === header[m.name]?.text) continue;
    out.push({
      position: r,
      name,
      link,
      price: m.price !== null ? row[m.price] : undefined,
      image: m.image !== null ? row[m.image] : undefined,
      custom: m.custom.map(({ col, label }) => ({ label, cell: row[col] })),
    });
  }
  return out;
}

function blocksOf(grid: Grid, m: BlockMapping): Raw[] {
  const at = (r: number, c: number, o: { dr: number; dc: number } | null) => (o ? grid[r + o.dr]?.[c + o.dc] : undefined);
  return findBlocks(grid, m).map(({ r, c }) => ({
    position: blockIndex(r, c),
    name: grid[r][c].text,
    link: cellUrl(at(r, c, m.link))!,
    price: at(r, c, m.price),
    image: at(r, c, m.image),
    custom: m.custom.map(({ label, ...o }) => ({ label, cell: at(r, c, o) })),
  }));
}

/**
 * Applies a mapping to a grid. Rows/blocks without a name or a purchase link are
 * skipped (blank rows, section titles, notes), as are repeats of the header row.
 */
export function normalize(grid: Grid, mapping: Mapping, opts: Opts = {}): NormalizedListing[] {
  return mapping.layout === "blocks"
    ? blocksOf(grid, mapping).map((raw) => toListing(raw, opts, true))
    : rowsOf(grid, mapping).map((raw) => toListing(raw, opts, false));
}
