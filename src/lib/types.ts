/** One row from one sheet. */
export type Listing = {
  sheet: string;
  priceCents: number | null;
  priceRaw: string;
  link: string;
};

/** A storefront product: one or more listings merged by marketplace item ID. */
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

export function formatPrice(cents: number | null, raw = "") {
  if (cents == null) return raw || "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
