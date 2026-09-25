import Papa from "papaparse";
import type { Grid } from "./types";

/** Fallback when the HTML view is unavailable. Loses hidden hyperlinks and =IMAGE() pictures. */
export function parseSheetCsv(csv: string, maxRows: number): Grid {
  const { data } = Papa.parse<string[]>(csv, { skipEmptyLines: false, preview: maxRows });
  return data.map((row) => row.map((text) => ({ text: text.replace(/ /g, " ").trim() })));
}
