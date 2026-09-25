import { describe, expect, it } from "vitest";
import { megaFixture } from "./__fixtures__/load";
import { autoMap } from "./auto-map";
import { detectBlocks, findBlocks } from "./blocks";
import { normalize } from "./normalize";
import { parseSheetHtml } from "./parse-html";
import { mappingSignature } from "./signature";
import { fromColumns, toColumns } from "./sync";
import type { BlockMapping, Grid } from "./types";

const main = parseSheetHtml(megaFixture("main"), 5000);
const shoes = parseSheetHtml(megaFixture("shoes"), 5000);

describe("product blocks (GillyREPS MEGA SHEET)", () => {
  it("detects the 3-column × 2-row block on MAIN PAGE", () => {
    expect(detectBlocks(main)?.mapping).toEqual({
      layout: "blocks",
      link: { dr: 1, dc: 0 },
      image: { dr: 0, dc: 1 },
      price: { dr: 0, dc: 2 },
      custom: [],
    });
    // autoMap prefers blocks here: rows would find almost nothing.
    expect(autoMap(main).layout).toBe("blocks");
  });

  it("reads two products per row and skips info rows and section titles", () => {
    const listings = normalize(main, autoMap(main));
    const names = listings.map((l) => l.name);
    // First products sit side by side in row 15 (index 14).
    expect(listings[0]).toMatchObject({ name: expect.stringMatching(/^50\+ VERSIONS P BATCH/), priceCents: 2200 });
    expect(listings[1]).toMatchObject({ name: expect.stringMatching(/DIOR B30/), priceCents: 4300 });
    expect(listings[0].rowIndex).toBe(14 * 1000);
    expect(listings[1].rowIndex).toBe(14 * 1000 + 3);
    // Discord/guide links, category buttons and "Sep 6th haul" titles are not products.
    expect(names.some((n) => /DISCORD|Click here|haul|MOST POPULAR/i.test(n))).toBe(false);
    expect(listings.every((l) => l.link.startsWith("http") && l.imageUrl)).toBe(true);
    expect(new Set(listings.map((l) => l.rowIndex)).size).toBe(listings.length);
    expect(listings.length).toBeGreaterThan(80);
  });

  it("never reads a neighbouring product's name as a price", () => {
    // SHOES starts with 2-column blocks that have no price at all.
    const listings = normalize(shoes, autoMap(shoes));
    const gx = listings.find((l) => l.name.startsWith("50+ GX BATCH"));
    expect(gx).toBeDefined();
    expect(gx?.priceCents).toBeNull();
    expect(gx?.priceRaw).toBe("");
  });
});

describe("findBlocks", () => {
  const cell = (text: string, extra: Partial<{ href: string; img: string }> = {}) => ({ text, ...extra });
  const grid: Grid = [
    [cell("JOIN MY DISCORD", { href: "https://discord.gg/x" }), cell("")],
    [cell("Cool Hoodie"), cell("", { img: "https://i.ibb.co/a.png" }), cell("$20"), cell("Nice Pants"), cell("", { img: "https://i.ibb.co/b.png" }), cell("$30")],
    [cell("LINK", { href: "https://item.taobao.com/item.htm?id=1234567" }), cell(""), cell(""), cell("LINK", { href: "https://weidian.com/item.html?itemID=765432" })],
    [cell("WINTER SECTION")],
  ];
  const m: BlockMapping = { layout: "blocks", link: { dr: 1, dc: 0 }, image: { dr: 0, dc: 1 }, price: { dr: 0, dc: 2 }, custom: [] };

  it("finds every block and nothing else", () => {
    expect(findBlocks(grid, m)).toEqual([
      { r: 1, c: 0 },
      { r: 1, c: 3 },
    ]);
  });

  it("round-trips through storage and has a stable signature", () => {
    const stored = toColumns(m);
    expect(fromColumns(-1, stored)).toEqual(m);
    expect(mappingSignature(m)).toBe(mappingSignature({ ...m }));
    expect(mappingSignature(m)).not.toBe(mappingSignature({ ...m, price: null }));
  });
});
