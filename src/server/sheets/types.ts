/** One spreadsheet cell as read from Google's HTML view (or CSV fallback). */
export type Cell = {
  text: string;
  /** Hyperlink behind the cell, if any (Google redirect already unwrapped). */
  href?: string;
  /** Image rendered in the cell via =IMAGE(), if any. */
  img?: string;
};

/** Rectangular grid of cells, row-major. Row/column indexes are 0-based. */
export type Grid = Cell[][];

export type Tab = { name: string; gid: string };

/** Which column holds each field. `null` = not mapped. */
export type Mapping = {
  headerRow: number;
  name: number | null;
  link: number | null;
  price: number | null;
  image: number | null;
  custom: { col: number; label: string }[];
};

export type NormalizedListing = {
  rowIndex: number;
  itemKey: string;
  /** True when itemKey is a real marketplace ID, so it can merge across sheets. */
  mergeable: boolean;
  name: string;
  priceCents: number | null;
  priceRaw: string;
  currency: string;
  imageUrl: string | null;
  link: string;
  custom: { label: string; value: string }[];
  category: string | null;
};

export const LIMITS = {
  maxRows: 5000,
  maxBytes: 15 * 1024 * 1024,
  fetchTimeoutMs: 20_000,
} as const;
