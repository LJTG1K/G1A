import { parseSheetCsv } from "./parse-csv";
import { parseSheetHtml, parseTabList } from "./parse-html";
import { LIMITS, type Grid, type Tab } from "./types";

export class SheetError extends Error {
  constructor(
    public code: "not_found" | "private" | "too_large" | "network" | "empty",
    message: string,
  ) {
    super(message);
  }
}

const base = (sheetId: string) => `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}`;

async function get(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(LIMITS.fetchTimeoutMs),
      headers: { "user-agent": "Mozilla/5.0 (G1A sheet reader)" },
      cache: "no-store",
    });
  } catch {
    throw new SheetError("network", "Couldn't reach Google Sheets. Try again in a moment.");
  }
  // Private sheets redirect to the Google sign-in page.
  if (new URL(res.url).hostname === "accounts.google.com" || res.status === 401 || res.status === 403) {
    throw new SheetError("private", "This sheet isn't public. Set sharing to “Anyone with the link can view”.");
  }
  if (res.status === 404 || res.status === 400) throw new SheetError("not_found", "Sheet not found. Check the link.");
  if (!res.ok) throw new SheetError("network", `Google Sheets returned ${res.status}.`);

  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > LIMITS.maxBytes) throw new SheetError("too_large", "This sheet is too large to import.");
  const body = await res.text();
  if (body.length > LIMITS.maxBytes) throw new SheetError("too_large", "This sheet is too large to import.");
  return body;
}

export async function fetchTabs(sheetId: string): Promise<{ title: string | null; tabs: Tab[] }> {
  const result = parseTabList(await get(`${base(sheetId)}/htmlview`));
  if (result.tabs.length === 0) throw new SheetError("empty", "No tabs found in this sheet.");
  return result;
}

/** Reads one tab: HTML view first (keeps hyperlinks and images), CSV export as fallback. */
export async function fetchGrid(sheetId: string, gid: string): Promise<Grid> {
  try {
    const html = await get(`${base(sheetId)}/htmlview/sheet?headers=false&gid=${encodeURIComponent(gid)}`);
    const grid = parseSheetHtml(html, LIMITS.maxRows);
    if (grid.length > 0) return grid;
  } catch (e) {
    if (e instanceof SheetError && e.code !== "network") throw e;
  }
  const csv = await get(`${base(sheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`);
  const grid = parseSheetCsv(csv, LIMITS.maxRows);
  if (grid.length === 0) throw new SheetError("empty", "This tab is empty.");
  return grid;
}
