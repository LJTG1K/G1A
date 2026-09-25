import { detectBlocks } from "./blocks";
import { cellImage, cellUrl, isNameText, isPriceText } from "./cells";
import type { Grid, Mapping, RowMapping } from "./types";

export { cellImage, cellUrl, isImageUrl } from "./cells";

type Field = "name" | "link" | "price" | "image";

const HEADER_PATTERNS: Record<Field, RegExp[]> = {
  image: [/\b(image|img|photo|picture|pic|thumbnail|preview)s?\b/],
  price: [/price|cost|\busd\b|\bcny\b|\brmb\b|^\s*[$¥]\s*$/],
  link: [/link|url|\bbuy\b|purchase|\bagent\b|taobao|weidian/],
  // Most specific first: "ITEM NAME" beats "DESCRIPTION".
  name: [/name|title/, /product|item/],
};
const ANY_HEADER = Object.values(HEADER_PATTERNS).flat();

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Header row = the row in the first 30 whose cells look most like field labels. */
export function findHeaderRow(grid: Grid): number {
  let best = -1;
  let bestScore = 1; // need at least 2 recognised labels
  grid.slice(0, 30).forEach((row, r) => {
    const score = row.filter((c) => c.text.length <= 40 && ANY_HEADER.some((re) => re.test(norm(c.text)))).length;
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  });
  return best;
}

type ColumnProfile = { image: number; url: number; price: number; text: number; filled: number };

function profileColumns(grid: Grid, headerRow: number, width: number): ColumnProfile[] {
  const sample = grid.slice(headerRow + 1).filter((row) => row.some((c) => c.text || c.href || c.img)).slice(0, 60);
  return Array.from({ length: width }, (_, col) => {
    const p = { image: 0, url: 0, price: 0, text: 0, filled: 0 };
    for (const row of sample) {
      const c = row[col];
      if (!c || !(c.text || c.href || c.img)) continue;
      p.filled++;
      if (cellImage(c)) p.image++;
      else if (cellUrl(c)) p.url++;
      else if (isPriceText(c.text)) p.price++;
      else if (/[a-z]{2}/i.test(c.text) && c.text.length <= 160) p.text++;
    }
    const n = Math.max(1, sample.length);
    return { image: p.image / n, url: p.url / n, price: p.price / n, text: p.text / n, filled: p.filled / n };
  });
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

/** One-product-per-row guess: header labels first, then what the columns contain. */
export function autoMapRows(grid: Grid): RowMapping {
  const headerRow = findHeaderRow(grid);
  const width = Math.max(0, ...grid.slice(0, 200).map((r) => r.length));
  const headers = Array.from({ length: width }, (_, c) => (headerRow >= 0 ? norm(grid[headerRow][c]?.text ?? "") : ""));
  const profile = profileColumns(grid, headerRow, width);
  const used = new Set<number>();
  const mapping: RowMapping = { layout: "rows", headerRow, name: null, link: null, price: null, image: null, custom: [] };

  // 1. Header labels, most distinctive fields first.
  for (const field of ["image", "price", "link", "name"] as Field[]) {
    for (const re of HEADER_PATTERNS[field]) {
      const col = headers.findIndex((h, c) => !used.has(c) && h && h.length <= 40 && re.test(h));
      if (col >= 0) {
        mapping[field] = col;
        used.add(col);
        break;
      }
    }
  }

  // 2. Column contents for anything still missing.
  const pick = (field: Field, score: (p: ColumnProfile) => number) => {
    if (mapping[field] !== null) return;
    let best = -1;
    let bestScore = 0.5;
    profile.forEach((p, c) => {
      if (!used.has(c) && score(p) > bestScore) {
        best = c;
        bestScore = score(p);
      }
    });
    if (best >= 0) {
      mapping[field] = best;
      used.add(best);
    }
  };
  pick("image", (p) => p.image);
  pick("link", (p) => p.url);
  pick("price", (p) => p.price);
  pick("name", (p) => p.text);

  // 3. Other labelled, reasonably filled columns are suggested as custom fields.
  headers.forEach((h, c) => {
    if (!used.has(c) && h && /[a-z]/.test(h) && profile[c].filled >= 0.2) {
      mapping.custom.push({ col: c, label: titleCase(grid[headerRow][c].text) });
    }
  });

  return mapping;
}

/** Rows that would become products under a row mapping (for comparing layouts). */
export function countRowProducts(grid: Grid, m: RowMapping): number {
  if (m.name === null || m.link === null) return 0;
  let n = 0;
  for (let r = m.headerRow + 1; r < grid.length; r++) {
    if (isNameText(grid[r][m.name]) && cellUrl(grid[r][m.link])) n++;
  }
  return n;
}

/**
 * Guesses a mapping. Tries one-product-per-row and repeating product blocks, and
 * picks blocks only when they find clearly more products. The user always
 * confirms it in the mapping screen.
 */
export function autoMap(grid: Grid): Mapping {
  const rows = autoMapRows(grid);
  const blocks = detectBlocks(grid);
  if (blocks && blocks.count > countRowProducts(grid, rows) * 1.2) return blocks.mapping;
  return rows;
}
