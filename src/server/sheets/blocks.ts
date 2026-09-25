import { cellImage, cellUrl, isNameText, isPriceText } from "./cells";
import type { BlockMapping, Cell, Grid, Offset } from "./types";

/** Anchor (name cell) positions of every product block, in sheet order. */
export function findBlocks(grid: Grid, m: BlockMapping): { r: number; c: number }[] {
  if (!m.link) return [];
  const at = (r: number, c: number, o: Offset) => grid[r + o.dr]?.[c + o.dc];
  const out: { r: number; c: number }[] = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      if (!isNameText(row[c])) continue;
      const link = at(r, c, m.link);
      // The link cell must really be a link, and not itself a product name.
      if (!cellUrl(link) || cellImage(link)) continue;
      // Guard against info rows: a mapped image or price must be present too.
      const hasImage = m.image ? !!cellImage(at(r, c, m.image)) : false;
      const hasPrice = m.price ? isPriceText(at(r, c, m.price)?.text ?? "") : false;
      if ((m.image || m.price) && !hasImage && !hasPrice) continue;
      out.push({ r, c });
    }
  }
  return out;
}

export const blockIndex = (r: number, c: number) => r * 1000 + c;

const key = (o: Offset | null) => (o ? `${o.dr},${o.dc}` : "-");

/**
 * Guesses a block layout from the sheet itself: for every link cell, find the
 * nearest name, image and price around it; the most common arrangement wins.
 * Returns null when no arrangement repeats often enough to be a product grid.
 */
export function detectBlocks(grid: Grid): { mapping: BlockMapping; count: number } | null {
  const tally = new Map<string, { m: BlockMapping; n: number }>();
  const nearest = (r: number, c: number, test: (cell: Cell) => boolean) => {
    let best: { r: number; c: number; d: number } | null = null;
    for (let dr = -2; dr <= 1; dr++) {
      for (let dc = -4; dc <= 4; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr;
        const cc = c + dc;
        const cell = grid[rr]?.[cc];
        if (!cell || !test(cell)) continue;
        // Prefer the same column, then rows above, then closer cells.
        const d = Math.abs(dr) * 2 + Math.abs(dc) * 3 + (dr > 0 ? 1 : 0);
        if (!best || d < best.d) best = { r: rr, c: cc, d };
      }
    }
    return best;
  };

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (!cellUrl(cell) || cellImage(cell)) continue;
      const name = nearest(r, c, (x) => isNameText(x) && !x.href);
      if (!name) continue;
      const rel = (p: { r: number; c: number } | null): Offset | null =>
        p ? { dr: p.r - name.r, dc: p.c - name.c } : null;
      const image = nearest(name.r, name.c, (x) => !!cellImage(x));
      const price = nearest(name.r, name.c, (x) => isPriceText(x.text));
      const m: BlockMapping = { layout: "blocks", link: rel({ r, c }), image: rel(image), price: rel(price), custom: [] };
      const k = [key(m.link), key(m.image), key(m.price)].join("|");
      const t = tally.get(k) ?? { m, n: 0 };
      t.n++;
      tally.set(k, t);
    }
  }

  const top = [...tally.values()].filter((t) => t.m.image || t.m.price).sort((a, b) => b.n - a.n)[0];
  if (!top || top.n < 4) return null;

  // Keep image/price only where most blocks really have one there; otherwise the
  // offset probably points at a neighbouring product (e.g. its name).
  const m = top.m;
  const withoutExtras: BlockMapping = { ...m, image: null, price: null };
  const anchors = findBlocks(grid, m.image || m.price ? m : withoutExtras);
  const share = (o: Offset | null, test: (c: Cell | undefined) => boolean) =>
    o ? anchors.filter(({ r, c }) => test(grid[r + o.dr]?.[c + o.dc])).length / Math.max(1, anchors.length) : 0;
  const mapping: BlockMapping = {
    ...m,
    image: share(m.image, (c) => !!cellImage(c)) >= 0.6 ? m.image : null,
    price: share(m.price, (c) => isPriceText(c?.text ?? "")) >= 0.6 ? m.price : null,
  };
  const count = findBlocks(grid, mapping).length;
  return count >= 4 ? { mapping, count } : null;
}
