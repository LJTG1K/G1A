/**
 * Pulls the sheet ID (and tab gid, if present) out of any Google Sheets URL:
 * /edit, /view, /htmlview, /pubhtml, with gid in the query or the #fragment.
 */
export function parseSheetUrl(input: string): { sheetId: string; gid: string | null } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)docs\.google\.com$/.test(url.hostname)) return null;

  const m = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  if (!m) return null;

  const gid =
    url.searchParams.get("gid") ?? new URLSearchParams(url.hash.replace(/^#/, "")).get("gid") ?? null;
  return { sheetId: m[1], gid: gid && /^\d+$/.test(gid) ? gid : null };
}
