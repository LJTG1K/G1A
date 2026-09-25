export type KeywordRule = { category: string; keyword: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type Categorizer = (name: string) => string | null;

/**
 * Builds a matcher from the admin keyword list. Keywords match whole words
 * (plural "s"/"es" allowed). When several match, the one that appears LAST in the
 * name wins, since product names usually end with the noun: "ZIP UP JACKET" → jacket.
 * Ties at the same position go to the longer keyword.
 */
export function buildCategorizer(rules: KeywordRule[]): Categorizer {
  const compiled = rules.map((r) => ({
    category: r.category,
    length: r.keyword.length,
    re: new RegExp(`(?<![a-z0-9])${escape(r.keyword.toLowerCase()).replace(/[\s-]+/g, "[\\s-]*")}(?:e?s)?(?![a-z0-9])`, "gi"),
  }));

  return (name) => {
    let best: { category: string; end: number; length: number } | null = null;
    for (const c of compiled) {
      for (const m of name.matchAll(c.re)) {
        const end = m.index! + m[0].length;
        if (!best || end > best.end || (end === best.end && c.length > best.length)) {
          best = { category: c.category, end, length: c.length };
        }
      }
    }
    return best?.category ?? null;
  };
}
