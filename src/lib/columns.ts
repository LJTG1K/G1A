/** Spreadsheet column letter for a 0-based index: 0 → A, 25 → Z, 26 → AA. */
export const colLetter = (i: number): string =>
  (i >= 26 ? colLetter(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));
