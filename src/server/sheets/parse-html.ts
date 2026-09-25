import { HTMLElement, parse } from "node-html-parser";
import type { Cell, Grid, Tab } from "./types";

/** Google wraps every sheet hyperlink in https://www.google.com/url?q=<real>. */
export function unwrapGoogleRedirect(href: string): string {
  try {
    const u = new URL(href);
    if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === "/url") {
      return u.searchParams.get("q") ?? href;
    }
  } catch {}
  return href;
}

const clean = (s: string) => s.replace(/ /g, " ").replace(/[ \t]+/g, " ").trim();

function readCell(td: HTMLElement): Cell {
  const cell: Cell = { text: clean(td.text) };
  const a = td.querySelector("a[href]");
  if (a) cell.href = unwrapGoogleRedirect(a.getAttribute("href")!);
  const img = td.querySelector("img[src]");
  if (img) cell.img = img.getAttribute("src")!;
  return cell;
}

/** Real sheet index from ids like "1209966016C4" / "1209966016R12". */
const indexFromId = (el: HTMLElement | undefined, axis: "C" | "R") => {
  const m = el?.getAttribute("id")?.match(new RegExp(`${axis}(\\d+)$`));
  return m ? Number(m[1]) : null;
};

/**
 * Converts the table in /htmlview/sheet?gid=… into a grid.
 * Skips the row-number column and freeze-bar separators, expands merged cells
 * (colspan/rowspan), and puts hidden rows/columns back as empty cells so indexes
 * match the real sheet (and the CSV export).
 */
export function parseSheetHtml(html: string, maxRows: number): Grid {
  const root = parse(html, { blockTextElements: { script: false, style: false } });
  const table = root.querySelector("table.waffle") ?? root.querySelector("table");
  if (!table) return [];

  // Visible column position -> real column index (hidden columns are absent from the HTML).
  const realCols = table
    .querySelectorAll("thead th")
    .map((th) => indexFromId(th, "C"))
    .filter((c): c is number => c !== null);
  const realCol = (visible: number) =>
    visible < realCols.length ? realCols[visible] : (realCols.at(-1) ?? -1) + 1 + visible - realCols.length;

  const grid: Grid = [];
  // Columns still covered by a rowspan from an earlier row: col -> rows remaining.
  const carry = new Map<number, number>();

  for (const tr of table.querySelectorAll("tbody > tr")) {
    const children = tr.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement);
    const tds = children.filter((n) => n.tagName === "TD");
    if (tds.length === 0 || tds.every((td) => td.classList.contains("freezebar-cell"))) continue;
    const rowIndex = indexFromId(children.find((n) => n.tagName === "TH"), "R") ?? grid.length;
    if (rowIndex >= maxRows) break;

    const row: Cell[] = [];
    let col = 0;
    const fillCarry = () => {
      while (carry.has(col)) {
        const left = carry.get(col)! - 1;
        row[col] = { text: "" };
        if (left === 0) carry.delete(col);
        else carry.set(col, left);
        col++;
      }
    };

    for (const td of tds) {
      if (td.classList.contains("freezebar-cell")) continue;
      fillCarry();
      const cell = readCell(td);
      const colspan = Math.max(1, Number(td.getAttribute("colspan")) || 1);
      const rowspan = Math.max(1, Number(td.getAttribute("rowspan")) || 1);
      for (let k = 0; k < colspan; k++) {
        // Merged cells keep their value only in the top-left position, like Sheets itself.
        row[col] = k === 0 ? cell : { text: "" };
        if (rowspan > 1) carry.set(col, rowspan - 1);
        col++;
      }
    }
    fillCarry();

    const real: Cell[] = [];
    row.forEach((c, v) => (real[realCol(v)] = c ?? { text: "" }));
    // Hidden rows come back as empty rows so later row indexes stay true.
    while (grid.length < rowIndex) grid.push([]);
    grid[rowIndex] = Array.from(real, (c) => c ?? { text: "" });
  }
  return grid;
}

/** Reads the sheet title and tab list from the top-level /htmlview page. */
export function parseTabList(html: string): { title: string | null; tabs: Tab[] } {
  const tabs: Tab[] = [];
  const re = /\{name:\s*"((?:[^"\\]|\\.)*)",[^{}]*?gid:\s*"(\d+)"/g;
  for (const m of html.matchAll(re)) {
    const name = JSON.parse(`"${m[1]}"`) as string;
    if (!tabs.some((t) => t.gid === m[2])) tabs.push({ name, gid: m[2] });
  }
  const t = html.match(/<title>([^<]*)<\/title>/);
  const title = t ? clean(parse(t[1]).text.replace(/\s*-\s*Google (Sheets|Drive)\s*$/, "")) : null;
  return { title: title || null, tabs };
}
