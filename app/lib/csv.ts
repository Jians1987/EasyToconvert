// RFC 4180 CSV parsing shared by the Data Hub and the /api/v1 CSV endpoint.
// Handles quoted fields containing commas, escaped quotes ("") and line breaks,
// and both LF and CRLF row endings. Field values are trimmed.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error("CSV has an unclosed quoted field.");
  row.push(field.trim());
  rows.push(row);
  return rows.filter((r) => r.some((value) => value !== ""));
}

/** Converts CSV with a header row into an array of objects keyed by header. */
export function csvToObjects(text: string): Record<string, string>[] {
  const [headers, ...rows] = parseCsv(text.trim());
  if (!headers || rows.length === 0) throw new Error("CSV must contain at least a header and one data row.");
  return rows.map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""])));
}
