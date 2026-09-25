import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

/** Real pages saved from the reference sheet (1QJyne-…) on 2026-09-25. */
export function fixture(name: "fashion.html" | "tech.html" | "tech.csv" | "tabs.html"): string {
  return gunzipSync(readFileSync(join(__dirname, `reference-${name}.gz`))).toString("utf8");
}

/** First rows of the GillyREPS MEGA SHEET (1rfnDD0…) tabs, saved 2026-09-25: product blocks. */
export function megaFixture(tab: "main" | "shoes"): string {
  return gunzipSync(readFileSync(join(__dirname, `mega-${tab}.html.gz`))).toString("utf8");
}
