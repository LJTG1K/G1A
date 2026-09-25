import { cellImage, cellUrl } from "./auto-map";
import type { Categorizer } from "./categorize";
import { extractItemKey } from "./item-id";
import { parsePrice } from "./price";
import type { Grid, Mapping, NormalizedListing } from "./types";

const EMPTY_VALUES = new Set(["", "n/a", "na", "-", "—", "none", "null", "tbd"]);
const isEmpty = (s: string) => EMPTY_VALUES.has(s.trim().toLowerCase());

/**
 * Applies a mapping to a grid. Rows without a name or a purchase link are skipped
 * (blank rows, section dividers, notes), as are repeats of the header row.
 */
export function normalize(
  grid: Grid,
  mapping: Mapping,
  opts: { categorize?: Categorizer; defaultCurrency?: string } = {},
): NormalizedListing[] {
  if (mapping.name === null || mapping.link === null) return [];
  const header = mapping.headerRow >= 0 ? grid[mapping.headerRow] : undefined;
  const out: NormalizedListing[] = [];

  for (let r = mapping.headerRow + 1; r < grid.length; r++) {
    const row = grid[r];
    const name = row[mapping.name]?.text ?? "";
    const link = cellUrl(row[mapping.link]);
    if (isEmpty(name) || !link) continue;
    if (header && name === header[mapping.name]?.text) continue;

    const priceRaw = mapping.price !== null ? (row[mapping.price]?.text ?? "") : "";
    const { cents, currency } = parsePrice(priceRaw, opts.defaultCurrency);
    const { key, mergeable } = extractItemKey(link);

    out.push({
      rowIndex: r,
      itemKey: key,
      mergeable,
      name,
      priceCents: cents,
      priceRaw,
      currency,
      imageUrl: mapping.image !== null ? (cellImage(row[mapping.image]) ?? null) : null,
      link,
      custom: mapping.custom
        .map(({ col, label }) => ({ label, value: row[col]?.text || cellUrl(row[col]) || "" }))
        .filter((f) => !isEmpty(f.value)),
      category: opts.categorize?.(name) ?? null,
    });
  }
  return out;
}
