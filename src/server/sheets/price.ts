export type ParsedPrice = { cents: number | null; currency: string };

const CURRENCY_HINTS: [RegExp, string][] = [
  [/¥|￥|\bcny\b|\brmb\b|元/i, "CNY"],
  [/€|\beur\b/i, "EUR"],
  [/£|\bgbp\b/i, "GBP"],
  [/\bau\$|\baud\b|a\$/i, "AUD"],
  [/\bca\$|\bcad\b|c\$/i, "CAD"],
];

/**
 * "$8" → 800 USD, "¥49.9" → 4990 CNY, "$8 - $12" → 800 (lowest), "1,299" → 129900.
 * Returns cents: null when there is no number. Defaults to USD (most sheets).
 */
export function parsePrice(raw: string, defaultCurrency = "USD"): ParsedPrice {
  const currency = CURRENCY_HINTS.find(([re]) => re.test(raw))?.[1] ?? defaultCurrency;
  const numbers = [...raw.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)]
    .map((m) => Number(m[0].replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (numbers.length === 0) return { cents: null, currency };
  return { cents: Math.round(Math.min(...numbers) * 100), currency };
}
