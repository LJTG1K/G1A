import { describe, expect, it } from "vitest";
import { diffPin, hasChanges, NO_CHANGES, snapshotOf } from "./pins";
import type { Product } from "./store";

const listing = (sourceId: string, priceCents: number) => ({
  sourceId,
  sheet: `Sheet · ${sourceId}`,
  tab: sourceId,
  name: "Hoodie",
  priceCents,
  priceRaw: `$${priceCents / 100}`,
  link: `https://item.taobao.com/item.htm?id=1&s=${sourceId}`,
  image: "https://i.ibb.co/a.webp",
  custom: [],
});

const product = (over: Partial<Product> = {}): Product => ({
  key: "taobao:1",
  name: "Hoodie",
  image: "https://i.ibb.co/a.webp",
  priceCents: 1200,
  priceRaw: "$12",
  category: "Hoodies",
  custom: [],
  listings: [listing("a", 1200)],
  ...over,
});

describe("diffPin", () => {
  it("reports nothing when the product is unchanged", () => {
    const c = diffPin(snapshotOf(product()), product());
    expect(c).toEqual(NO_CHANGES);
    expect(hasChanges(c)).toBe(false);
  });

  it("reports a price drop from the lowest price across sheets", () => {
    const now = product({ priceCents: 900, listings: [listing("b", 900), listing("a", 1200)] });
    const c = diffPin(snapshotOf(product()), now);
    expect(c.price).toEqual({ from: 1200, to: 900 });
    expect(c.sheets).toEqual({ from: 1, to: 2 });
    expect(hasChanges(c)).toBe(true);
  });

  it("reports removal, rename and new photo", () => {
    expect(diffPin(snapshotOf(product()), undefined).removed).toBe(true);
    const c = diffPin(snapshotOf(product()), product({ name: "Zip Hoodie", image: "https://i.ibb.co/b.webp" }));
    expect(c).toMatchObject({ renamed: true, newImage: true, price: null });
  });

  it("ignores prices that can't be compared", () => {
    expect(diffPin(snapshotOf(product({ priceCents: null })), product()).price).toBeNull();
  });
});
