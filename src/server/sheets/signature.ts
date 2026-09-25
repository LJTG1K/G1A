import { createHash } from "node:crypto";
import type { Mapping } from "./types";

/**
 * Stable fingerprint of a mapping. Two users who map the same tab the same way
 * get the same signature; that is what preset voting counts.
 */
export function mappingSignature(m: Mapping): string {
  const canonical = {
    h: m.headerRow,
    n: m.name,
    l: m.link,
    p: m.price,
    i: m.image,
    c: [...m.custom].sort((a, b) => a.col - b.col).map((f) => [f.col, f.label.trim().toLowerCase()]),
  };
  return createHash("sha1").update(JSON.stringify(canonical)).digest("hex").slice(0, 20);
}
