/** Store types and query params shared by server and client. */

export type Listing = {
  sourceId: string;
  /** "Sheet title · Tab" */
  sheet: string;
  /** Tab name alone, for compact badges. */
  tab: string;
  name: string;
  priceCents: number | null;
  priceRaw: string;
  link: string;
  image: string | null;
  custom: { label: string; value: string }[];
};

/** One storefront card: listings of the same item across sheets, cheapest first. */
export type Product = {
  key: string;
  name: string;
  image: string | null;
  priceCents: number | null;
  priceRaw: string;
  category: string | null;
  custom: { label: string; value: string }[];
  listings: Listing[];
};

export type Facets = {
  total: number;
  categories: { category: string | null; count: number }[];
  sheets: { id: string; label: string; tab: string; count: number; featured: boolean }[];
};

export const SORTS = [
  { id: "sheet", label: "Featured" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "newest", label: "Newest" },
  { id: "name", label: "Name" },
] as const;
export type Sort = (typeof SORTS)[number]["id"];

export const PRICE_BUCKETS = [
  { id: "u20", label: "Under $20", min: null, max: 1999 },
  { id: "20-50", label: "$20 – $50", min: 2000, max: 5000 },
  { id: "50-100", label: "$50 – $100", min: 5000, max: 10000 },
  { id: "100", label: "$100+", min: 10000, max: null },
] as const;

export const OTHER_CATEGORY = "__other__";
export const PAGE_SIZE = 60;

export type StoreQuery = {
  q: string;
  category: string | null;
  /** Only this spreadsheet (Google sheet id), e.g. from a homepage shelf. */
  spreadsheet: string | null;
  /** Only this tab (source id). */
  sheet: string | null;
  price: string | null;
  sort: Sort;
};

export const EMPTY_QUERY: StoreQuery = { q: "", category: null, spreadsheet: null, sheet: null, price: null, sort: "sheet" };

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

/** Reads a store query from the URL (?q=&cat=&ss=&sheet=&price=&sort=). */
export function parseStoreQuery(params: Params): StoreQuery {
  const get = (k: string) => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || null;
  };
  const sort = get("sort");
  const price = get("price");
  return {
    q: (get("q") ?? "").slice(0, 100),
    category: get("cat")?.slice(0, 40) ?? null,
    spreadsheet: get("ss"),
    sheet: get("sheet"),
    price: PRICE_BUCKETS.some((b) => b.id === price) ? price : null,
    sort: SORTS.some((s) => s.id === sort) ? (sort as Sort) : "sheet",
  };
}

export function storeQueryString(q: StoreQuery): string {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.category) p.set("cat", q.category);
  if (q.spreadsheet) p.set("ss", q.spreadsheet);
  if (q.sheet) p.set("sheet", q.sheet);
  if (q.price) p.set("price", q.price);
  if (q.sort !== "sheet") p.set("sort", q.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function formatPrice(cents: number | null, raw = "") {
  if (cents == null) return raw || "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
