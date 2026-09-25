import type { Product } from "./store";

/** What a product looked like when it was pinned (or last marked as seen). */
export type PinSnapshot = {
  name: string;
  image: string | null;
  priceCents: number | null;
  priceRaw: string;
  category: string | null;
  listings: { sourceId: string; sheet: string; priceCents: number | null; priceRaw: string; link: string }[];
};

export type PinChanges = {
  /** No sheet in the user's store lists this product any more. */
  removed: boolean;
  price: { from: number; to: number } | null;
  renamed: boolean;
  newImage: boolean;
  sheets: { from: number; to: number } | null;
};

export const NO_CHANGES: PinChanges = { removed: false, price: null, renamed: false, newImage: false, sheets: null };

export function snapshotOf(p: Product): PinSnapshot {
  return {
    name: p.name,
    image: p.image,
    priceCents: p.priceCents,
    priceRaw: p.priceRaw,
    category: p.category,
    listings: p.listings.map((l) => ({
      sourceId: l.sourceId,
      sheet: l.sheet,
      priceCents: l.priceCents,
      priceRaw: l.priceRaw,
      link: l.link,
    })),
  };
}

const sheetCount = (ids: string[]) => new Set(ids).size;

/** Compares a pin's snapshot with the product's current state across the user's sheets. */
export function diffPin(snap: PinSnapshot, current: Product | undefined): PinChanges {
  if (!current) return { ...NO_CHANGES, removed: true };
  const from = snap.priceCents;
  const to = current.priceCents;
  const before = sheetCount(snap.listings.map((l) => l.sourceId));
  const after = sheetCount(current.listings.map((l) => l.sourceId));
  return {
    removed: false,
    price: from !== null && to !== null && from !== to ? { from, to } : null,
    renamed: snap.name.trim() !== current.name.trim(),
    newImage: !!current.image && snap.image !== current.image,
    sheets: before !== after ? { from: before, to: after } : null,
  };
}

export const hasChanges = (c: PinChanges) => c.removed || !!c.price || c.renamed || c.newImage || !!c.sheets;

/** A stand-in product built from the snapshot, for pins that are no longer listed. */
export function productFromSnapshot(key: string, s: PinSnapshot): Product {
  return {
    key,
    name: s.name,
    image: s.image,
    priceCents: s.priceCents,
    priceRaw: s.priceRaw,
    category: s.category,
    custom: [],
    listings: s.listings.map((l) => ({
      sourceId: l.sourceId,
      sheet: l.sheet,
      tab: l.sheet.split(" · ").at(-1) ?? l.sheet,
      name: s.name,
      priceCents: l.priceCents,
      priceRaw: l.priceRaw,
      link: l.link,
      image: s.image,
      custom: [],
    })),
  };
}
