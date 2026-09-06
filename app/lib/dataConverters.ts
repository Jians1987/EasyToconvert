import Papa from "papaparse";

export function csvToJson(input: string): string {
  const parsed = Papa.parse<string[]>(input, { skipEmptyLines: "greedy" });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  const [headers, ...rows] = parsed.data;
  if (!headers || !rows.length) throw new Error("CSV must contain at least a header and one data row.");
  if (headers.some(h => !h.trim()) || new Set(headers).size !== headers.length) {
    throw new Error("CSV headers must be non-empty and unique.");
  }
  return JSON.stringify(rows.map((row, index) => {
    if (row.length !== headers.length) throw new Error(`CSV row ${index + 2} has a different number of fields than the header.`);
    return Object.fromEntries(headers.map((header, i) => [header, row[i]]));
  }), null, 2);
}

export function jsonToCsv(input: string): string {
  const parsed = JSON.parse(input);
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  if (!rows.length) throw new Error("Input JSON array is empty — nothing to convert.");
  if (rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("Use a JSON object or an array of objects.");
  }
  const fields = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  if (!fields.length) throw new Error("JSON objects must contain at least one field.");
  return Papa.unparse({ fields, data: rows.map(row => fields.map(field => {
    const value = row[field];
    return value != null && typeof value === "object" ? JSON.stringify(value) : value ?? "";
  })) });
}
