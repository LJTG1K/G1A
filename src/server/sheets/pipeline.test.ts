import { describe, expect, it } from "vitest";
import { fixture } from "./__fixtures__/load";
import { autoMap, findHeaderRow } from "./auto-map";
import { buildCategorizer } from "./categorize";
import { extractItemKey } from "./item-id";
import { normalize } from "./normalize";
import { parseSheetCsv } from "./parse-csv";
import { parseSheetHtml, parseTabList, unwrapGoogleRedirect } from "./parse-html";
import { parseSheetUrl } from "./parse-sheet-url";
import { parsePrice } from "./price";
import { mappingSignature } from "./signature";
import type { Grid } from "./types";

const REF = "1QJyne-Hqh91sWs_UMdyibKa1cN9Bt03E7imF-mZ-gbA";

describe("parseSheetUrl", () => {
  it("reads id and gid from the fragment", () => {
    expect(parseSheetUrl(`https://docs.google.com/spreadsheets/d/${REF}/edit?gid=1201104608#gid=1201104608`)).toEqual({
      sheetId: REF,
      gid: "1201104608",
    });
  });
  it("handles links without a gid and htmlview links", () => {
    expect(parseSheetUrl(`https://docs.google.com/spreadsheets/d/${REF}/htmlview`)).toEqual({ sheetId: REF, gid: null });
    expect(parseSheetUrl(`https://docs.google.com/spreadsheets/d/${REF}/edit#gid=0`)?.gid).toBe("0");
  });
  it("rejects non-Sheets links", () => {
    expect(parseSheetUrl("https://example.com/spreadsheets/d/abc")).toBeNull();
    expect(parseSheetUrl("not a url")).toBeNull();
    expect(parseSheetUrl("https://docs.google.com/document/d/abc/edit")).toBeNull();
  });
});

describe("parseTabList", () => {
  it("lists every tab of the reference sheet", () => {
    const { tabs } = parseTabList(fixture("tabs.html"));
    expect(tabs.map((t) => t.name)).toEqual(expect.arrayContaining(["HOME PAGE", "FASHION", "TECH", "FAQ"]));
    expect(tabs.find((t) => t.name === "FASHION")?.gid).toBe("1201104608");
  });
});

describe("parseSheetHtml", () => {
  it("unwraps Google redirect links", () => {
    expect(unwrapGoogleRedirect("https://www.google.com/url?q=https://a.com/x?y%3D1&sa=D")).toBe("https://a.com/x?y=1");
    expect(unwrapGoogleRedirect("https://a.com/")).toBe("https://a.com/");
  });

  it("expands colspan/rowspan and skips freeze bars", () => {
    const html = `<table class="waffle"><tbody>
      <tr><th>1</th><td>A</td><td colspan="2">B</td><td>C</td></tr>
      <tr><th class="freezebar-cell"></th><td class="freezebar-cell"></td><td class="freezebar-cell"></td></tr>
      <tr><th>2</th><td rowspan="2">D</td><td>E</td><td class="freezebar-cell"></td><td>F</td><td><a href="https://www.google.com/url?q=https://x.com/">buy</a></td></tr>
      <tr><th>3</th><td>G</td><td>H</td><td><img src="https://i.ibb.co/p.webp"></td></tr>
    </tbody></table>`;
    const g = parseSheetHtml(html, 100);
    expect(g.map((r) => r.map((c) => c.text))).toEqual([
      ["A", "B", "", "C"],
      ["D", "E", "F", "buy"],
      ["", "G", "H", ""],
    ]);
    expect(g[1][3].href).toBe("https://x.com/");
    expect(g[2][3].img).toBe("https://i.ibb.co/p.webp");
  });

  it("restores hidden columns and rows as empty cells", () => {
    const html = `<table class="waffle"><thead><tr><th></th><th id="9C0"></th><th id="9C2"></th></tr></thead><tbody>
      <tr><th id="9R0">1</th><td>A</td><td>C</td></tr>
      <tr><th id="9R3">4</th><td>D</td><td>F</td></tr>
    </tbody></table>`;
    expect(parseSheetHtml(html, 100).map((r) => r.map((c) => c.text))).toEqual([
      ["A", "", "C"],
      [],
      [],
      ["D", "", "F"],
    ]);
  });
});

describe("extractItemKey", () => {
  it("finds the Taobao id inside a Sugargoo link", () => {
    const link =
      "https://www.sugargoo.com/products?productLink=https%3A%2F%2Fitem.taobao.com%2Fitem.htm%3Fid%3D970345104616&memberId=3229302312621422771";
    expect(extractItemKey(link)).toEqual({ key: "taobao:970345104616", mergeable: true });
  });
  it("handles double-encoded links and stray invisible characters", () => {
    expect(
      extractItemKey("https://www.sugargoo.com/products?productLink=https%253A%252F%252Fitem.taobao.com%252Fitem.htm%253Fid%253D892845881474").key,
    ).toBe("taobao:892845881474");
    expect(
      extractItemKey("https://www.sugargoo.com/products?productLink=https%3A%2F%2Fitem.taobao.com%2Fitem.htm%3Fid%3D1006720400475%EF%BB%BF&memberId=1").key,
    ).toBe("taobao:1006720400475");
  });
  it("merges the same item across agents and marketplaces", () => {
    const a = extractItemKey("https://item.taobao.com/item.htm?id=733359137334");
    const b = extractItemKey("https://cnfans.com/product/?shop_type=taobao&id=733359137334&ref=1");
    const c = extractItemKey("https://www.kakobuy.com/item/details?url=https%3A%2F%2Fdetail.tmall.com%2Fitem.htm%3Fid%3D733359137334");
    expect(a.key).toBe("taobao:733359137334");
    expect(b.key).toBe(a.key);
    expect(c.key).toBe(a.key);
  });
  it("reads Weidian and 1688 ids", () => {
    expect(extractItemKey("https://weidian.com/item.html?itemID=7234567890").key).toBe("weidian:7234567890");
    expect(extractItemKey("https://detail.1688.com/offer/712345678901.html").key).toBe("1688:712345678901");
  });
  it("falls back to a non-mergeable hash", () => {
    const k = extractItemKey("https://some-store.example/p/abc");
    expect(k.mergeable).toBe(false);
    expect(k.key).toMatch(/^link:[0-9a-f]{16}$/);
    expect(extractItemKey("https://some-store.example/p/abc").key).toBe(k.key);
  });
});

describe("parsePrice", () => {
  it.each([
    ["$8", 800, "USD"],
    ["$8.50", 850, "USD"],
    ["¥49.9", 4990, "CNY"],
    ["49.9 CNY", 4990, "CNY"],
    ["$8 - $12", 800, "USD"],
    ["1,299", 129900, "USD"],
    ["€20", 2000, "EUR"],
    ["", null, "USD"],
    ["ask", null, "USD"],
  ])("%s → %s %s", (raw, cents, currency) => {
    expect(parsePrice(raw)).toEqual({ cents, currency });
  });
});

describe("buildCategorizer", () => {
  const categorize = buildCategorizer([
    { category: "Hoodies", keyword: "zip up" },
    { category: "Outerwear", keyword: "jacket" },
    { category: "Pants", keyword: "pants" },
    { category: "Pants", keyword: "sweatpants" },
    { category: "Bags", keyword: "backpack" },
    { category: "Jewellery", keyword: "ring" },
    { category: "Tops", keyword: "top" },
    { category: "Tech", keyword: "keycap" },
    { category: "Headwear", keyword: "cap" },
  ]);
  it("uses the last matching noun in the name", () => {
    expect(categorize("WEST COAST HIPHOP ZIP UP JACKET")).toBe("Outerwear");
    expect(categorize("WEST COAST HIPHOP BLACK SWEATPANTS")).toBe("Pants");
  });
  it("matches plurals and whole words only", () => {
    expect(categorize("CRASHBAGGAGE TRAVEL BACKPACKS")).toBe("Bags");
    expect(categorize("LOSELOS SPIKE TIP RING")).toBe("Jewellery");
    expect(categorize("PEARL EARRINGS")).toBeNull();
    expect(categorize("GAMING LAPTOP STAND")).toBeNull();
    expect(categorize("KIWI KEYCAP LION KEYCAP")).toBe("Tech");
  });
  it("returns null when nothing matches", () => {
    expect(categorize("MYSTERY ITEM")).toBeNull();
  });
});

describe("reference sheet end to end", () => {
  const fashion = parseSheetHtml(fixture("fashion.html"), 5000);

  it("auto-maps FASHION with no user input", () => {
    expect(autoMap(fashion)).toEqual({
      headerRow: 0,
      name: 1,
      image: 2,
      price: 4,
      link: 5,
      custom: [
        { col: 3, label: "Description" },
        { col: 6, label: "Style Tags" },
        { col: 7, label: "Fit" },
      ],
    });
  });

  it("normalises FASHION: blank and divider rows skipped", () => {
    const listings = normalize(fashion, autoMap(fashion));
    expect(listings).toHaveLength(1400);
    expect(listings.every((l) => l.priceCents !== null && l.currency === "USD")).toBe(true);
    expect(listings.filter((l) => l.mergeable).length).toBe(1400);
    expect(listings[0]).toMatchObject({
      name: "DIAMOND SOLDIER BELT",
      priceCents: 800,
      itemKey: "taobao:1009017778902",
      imageUrl: "https://i.ibb.co/WpGqC402/diamond-soldier-belt.webp",
      custom: [{ label: "Description", value: "Soldier buckle, Black croc pattern belt." }],
    });
    // "N/A" custom values are dropped.
    expect(listings[0].custom.some((f) => f.value === "N/A")).toBe(false);
  });

  it("maps TECH (different columns) and gives the same result from HTML and CSV", () => {
    const html = parseSheetHtml(fixture("tech.html"), 5000);
    const csv = parseSheetCsv(fixture("tech.csv"), 5000);
    const m = autoMap(html);
    expect(m).toMatchObject({ headerRow: 0, name: 1, image: 2, price: 4, link: 5 });
    const fromHtml = normalize(html, m).map((l) => [l.itemKey, l.priceCents]);
    const fromCsv = normalize(csv, autoMap(csv)).map((l) => [l.itemKey, l.priceCents]);
    expect(fromHtml.length).toBeGreaterThan(20);
    expect(fromHtml).toEqual(fromCsv);
  });
});

describe("autoMap on a sheet with no header labels", () => {
  it("falls back to column contents", () => {
    const grid: Grid = [
      [{ text: "My sheet" }],
      ...Array.from({ length: 6 }, (_, i) => [
        { text: `Cool Hoodie ${i}` },
        { text: "BUY", href: `https://item.taobao.com/item.htm?id=10000000${i}` },
        { text: `$${10 + i}` },
        { text: "", img: `https://i.ibb.co/x${i}.png` },
      ]),
    ];
    expect(findHeaderRow(grid)).toBe(-1);
    expect(autoMap(grid)).toMatchObject({ headerRow: -1, name: 0, link: 1, price: 2, image: 3 });
    const listings = normalize(grid, autoMap(grid));
    expect(listings).toHaveLength(6);
    expect(listings[0]).toMatchObject({ link: "https://item.taobao.com/item.htm?id=100000000", priceCents: 1000 });
  });
});

describe("mappingSignature", () => {
  it("ignores custom-field order and label case", () => {
    const base = { headerRow: 0, name: 1, link: 5, price: 4, image: 2 };
    const a = mappingSignature({ ...base, custom: [{ col: 3, label: "Fit" }, { col: 6, label: "Style" }] });
    const b = mappingSignature({ ...base, custom: [{ col: 6, label: "style" }, { col: 3, label: "fit " }] });
    expect(a).toBe(b);
    expect(mappingSignature({ ...base, price: 3, custom: [] })).not.toBe(a);
  });
});
