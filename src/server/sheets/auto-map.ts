import type { Cell, Grid, Mapping } from "./types";

type Field = "name" | "link" | "price" | "image";

const HEADER_PATTERNS: Record<Field, RegExp[]> = {
  image: [/\b(image|img|photo|picture|pic|thumbnail|preview)s?\b/],
  price: [/price|cost|\busd\b|\bcny\b|\brmb\b|^\s*[$¥]\s*$/],
  link: [/link|url|\bbuy\b|purchase|\bagent\b|taobao|weidian/],
  // Most specific first: "ITEM NAME" beats "DESCRIPTION".
  name: [/name|title/, /product|item/],
};
const ANY_HEADER = Object.values(HEADER_PATTERNS).flat();

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;
const IMAGE_HOST = /(^|\.)(ibb\.co|imgur\.com|alicdn\.com|googleusercontent\.com|yupoo\.com|geilicdn\.com|cloudinary\.com)$/i;
const PRICE_LIKE = /^[^\d\n]{0,5}\d[\d,.]*(\s*[-–~]\s*[^\d\n]{0,3}\d[\d,.]*)?\s*[a-z¥$€£]{0,4}$/i;

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function isImageUrl(s: string) {
  if (!isUrl(s)) return false;
  try {
    const u = new URL(s);
    return IMAGE_EXT.test(u.pathname) || IMAGE_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

/** Best URL a cell points to: its hyperlink, else its text when the text is a URL. */
export const cellUrl = (c: Cell | undefined) => c?.href ?? (c && isUrl(c.text) ? c.text : undefined);
export const cellImage = (c: Cell | undefined) => {
  if (!c) return undefined;
  if (c.img) return c.img;
  const u = cellUrl(c);
  return u && isImageUrl(u) ? u : undefined;
};

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
      else if (PRICE_LIKE.test(c.text) && /[$¥€£]|^\d/.test(c.text)) p.price++;
      else if (/[a-z]{2}/i.test(c.text) && c.text.length <= 160) p.text++;
    }
    const n = Math.max(1, sample.length);
    return { image: p.image / n, url: p.url / n, price: p.price / n, text: p.text / n, filled: p.filled / n };
  });
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

/**
 * Guesses a mapping: labels in the header row first, then what the column
 * contents look like. The user always confirms it in the mapping screen.
 */
export function autoMap(grid: Grid): Mapping {
  const headerRow = findHeaderRow(grid);
  const width = Math.max(0, ...grid.slice(0, 200).map((r) => r.length));
  const headers = Array.from({ length: width }, (_, c) => (headerRow >= 0 ? norm(grid[headerRow][c]?.text ?? "") : ""));
  const profile = profileColumns(grid, headerRow, width);
  const used = new Set<number>();
  const mapping: Mapping = { headerRow, name: null, link: null, price: null, image: null, custom: [] };

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
