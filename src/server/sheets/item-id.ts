import { createHash } from "node:crypto";

export type ItemKey = { key: string; mergeable: boolean };

// Query params agents use to wrap the original marketplace URL.
const WRAPPER_PARAMS = ["productLink", "url", "link", "goodsUrl", "itemUrl", "productUrl", "u", "q"];
// Query params agents use to name the marketplace when they pass only an ID.
const PLATFORM_PARAMS = ["shop_type", "platform", "source", "channel", "type"];
const ID_PARAMS = ["id", "itemID", "itemId", "item_id", "goodsId", "productId", "offerId"];

// Zero-width spaces and BOMs that sheet authors paste in by accident.
const INVISIBLE = /[​-‍﻿⁠]/g;

/** Leading digits of a param value: "123﻿" and "123#sku" both give "123". */
function digits(v: string | null, min: number): string | null {
  const m = v?.replace(INVISIBLE, "").match(/^\d+/);
  return m && m[0].length >= min ? m[0] : null;
}

/** Undo double/triple URL-encoding: "https%253A..." → "https://...". */
function decodeNested(v: string): string {
  for (let i = 0; i < 3 && /^https?%3A/i.test(v); i++) {
    try {
      v = decodeURIComponent(v);
    } catch {
      break;
    }
  }
  return v;
}

function platformFromLabel(label: string): "taobao" | "weidian" | "1688" | null {
  const l = label.toLowerCase();
  if (["taobao", "tb", "tmall"].includes(l)) return "taobao";
  if (["weidian", "wd", "micro"].includes(l)) return "weidian";
  if (["1688", "ali_1688", "ali1688", "alibaba"].includes(l)) return "1688";
  return null;
}

function tryUrl(s: string): URL | null {
  try {
    return new URL(s.replace(INVISIBLE, "").trim());
  } catch {
    return null;
  }
}

/** The URL itself plus every URL nested in wrapper params (a few levels deep). */
function candidateUrls(link: string): URL[] {
  const out: URL[] = [];
  const queue = [link];
  while (queue.length && out.length < 6) {
    const u = tryUrl(queue.shift()!);
    if (!u) continue;
    out.push(u);
    for (const p of WRAPPER_PARAMS) {
      const v = u.searchParams.get(p);
      if (!v) continue;
      const decoded = decodeNested(v.trim());
      if (/^https?:/i.test(decoded)) queue.push(decoded);
    }
  }
  return out;
}

function fromMarketplaceUrl(u: URL): string | null {
  const host = u.hostname.toLowerCase();
  if (/(^|\.)(taobao|tmall)\.com$/.test(host)) {
    const id = digits(u.searchParams.get("id"), 6);
    if (id) return `taobao:${id}`;
  }
  if (/(^|\.)weidian\.com$/.test(host)) {
    const id = digits(u.searchParams.get("itemID") ?? u.searchParams.get("itemId") ?? u.searchParams.get("id"), 5);
    if (id) return `weidian:${id}`;
  }
  if (/(^|\.)1688\.com$/.test(host)) {
    const m = u.pathname.match(/\/offer\/(\d{6,})\.html/);
    if (m) return `1688:${m[1]}`;
  }
  return null;
}

/** Agent URLs that carry a platform label + bare ID, e.g. ?shop_type=taobao&id=123. */
function fromAgentParams(u: URL): string | null {
  let platform: ReturnType<typeof platformFromLabel> = null;
  for (const p of PLATFORM_PARAMS) {
    const v = u.searchParams.get(p);
    if (v && (platform = platformFromLabel(v))) break;
  }
  if (!platform) return null;
  for (const p of ID_PARAMS) {
    const v = digits(u.searchParams.get(p), 5);
    if (v) return `${platform}:${v}`;
  }
  return null;
}

/**
 * Stable identity for a listing. Marketplace IDs (Taobao/Tmall, Weidian, 1688) are
 * found even inside agent links, so the same item merges across sheets and agents.
 * Anything else gets a hash of the link and never merges.
 */
export function extractItemKey(link: string): ItemKey {
  for (const u of candidateUrls(link)) {
    const key = fromMarketplaceUrl(u) ?? fromAgentParams(u);
    if (key) return { key, mergeable: true };
  }
  const hash = createHash("sha1").update(link.trim()).digest("hex").slice(0, 16);
  return { key: `link:${hash}`, mergeable: false };
}
