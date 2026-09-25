import type { Cell } from "./types";

/** Pure helpers for reading cell contents. Safe to import in client components. */

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;
const IMAGE_HOST = /(^|\.)(ibb\.co|imgur\.com|alicdn\.com|googleusercontent\.com|yupoo\.com|geilicdn\.com|cloudinary\.com)$/i;
export const PRICE_LIKE = /^[^\d\n]{0,5}\d[\d,.]*(\s*[-–~]\s*[^\d\n]{0,3}\d[\d,.]*)?\s*[a-z¥$€£]{0,4}$/i;

export const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);

export function isImageUrl(s: string) {
  if (!isUrl(s)) return false;
  try {
    const u = new URL(s);
    return IMAGE_EXT.test(u.pathname) || IMAGE_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

/** Best URL a cell points to: its hyperlink, else its text when the text is a URL. */
export const cellUrl = (c: Cell | undefined) => c?.href ?? (c && isUrl(c.text) ? c.text : undefined);

export const cellImage = (c: Cell | undefined) => {
  if (!c) return undefined;
  if (c.img) return c.img;
  const u = cellUrl(c);
  return u && isImageUrl(u) ? u : undefined;
};

/** "$22", "¥49.9", "$8 - $12", "120" — but not free text that happens to contain a digit. */
export const isPriceText = (s: string) => PRICE_LIKE.test(s.trim()) && /[$¥€£]|^\d/.test(s.trim());

/** Plain text that could be a product name (not a link, image, price or tiny label). */
export const isNameText = (c: Cell | undefined) =>
  !!c && !c.img && !isUrl(c.text) && c.text.length >= 3 && c.text.length <= 160 && /[a-z]{2}/i.test(c.text) && !isPriceText(c.text);
