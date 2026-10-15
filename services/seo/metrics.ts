export type SearchMetricRow = {
  key: string;
  clicks: number;
  impressions: number;
  /** Ratio, from 0 to 1. Null means no impressions were measured. */
  ctr: number | null;
  position: number | null;
};

export type SearchConsoleImport = {
  /** Only date rows can describe period totals. Query/page rows are subtotals. */
  kind: "totals" | "queries" | "pages";
  rows: SearchMetricRow[];
};

// Parse RFC 4180 quoting without evaluating formulas or trusting spreadsheet CTR.
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  const finishRow = () => {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    if (rows.length > 5001) throw new Error("CSV imports are limited to 5,000 data rows.");
    row = [];
    field = "";
    closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === ",") {
      row.push(field); field = ""; closed = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      finishRow();
    } else if (char === '"' && field === "" && !closed) {
      quoted = true;
    } else {
      if (closed || char === '"') throw new Error("Malformed CSV quotation.");
      field += char;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quotation.");
  if (field || row.length || closed) finishRow();
  return rows;
}

function count(value: string, label: string): number {
  const cleaned = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(cleaned)) throw new Error(`${label} must be a non-negative whole number.`);
  const result = Number(cleaned.replace(/,/g, ""));
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the supported range.`);
  return result;
}

export function parseSearchConsoleCsv(text: string): SearchConsoleImport {
  if (new TextEncoder().encode(text).byteLength > 1_048_576) throw new Error("CSV imports are limited to 1 MB.");
  const [rawHeaders, ...data] = csvRows(text.replace(/^\uFEFF/, ""));
  if (!rawHeaders) throw new Error("Add a Search Console CSV header.");
  const headers = rawHeaders.map((header) => header.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error("CSV headers must be unique.");
  const dimensions = headers.flatMap((header, index) => {
    const kind = header === "date" ? "totals" : ["query", "top queries"].includes(header) ? "queries" : ["page", "top pages"].includes(header) ? "pages" : null;
    return kind ? [{ kind: kind as SearchConsoleImport["kind"], index }] : [];
  });
  if (dimensions.length !== 1) throw new Error("Import one Date, Query, or Page dimension at a time.");
  const clicksIndex = headers.indexOf("clicks");
  const impressionsIndex = headers.indexOf("impressions");
  const positionIndex = headers.findIndex((header) => header === "position" || header === "average position");
  if (clicksIndex < 0 || impressionsIndex < 0) throw new Error("CSV requires Clicks and Impressions columns.");
  const { kind, index } = dimensions[0];
  const seen = new Set<string>();
  const rows = data.map((cells, offset): SearchMetricRow => {
    const line = offset + 2;
    if (cells.length !== headers.length) throw new Error(`CSV row ${line} does not match the header.`);
    const key = cells[index].trim();
    if (!key) throw new Error(`CSV row ${line} needs a dimension value.`);
    if (kind === "totals" && (!/^\d{4}-\d{2}-\d{2}$/.test(key) || Number.isNaN(Date.parse(key)) || new Date(key).toISOString().slice(0, 10) !== key)) throw new Error(`CSV row ${line} needs a valid YYYY-MM-DD date.`);
    const duplicateKey = kind === "queries" ? key.toLowerCase().replace(/\s+/g, " ") : key;
    if (seen.has(duplicateKey)) throw new Error(`Duplicate dimension value on CSV row ${line}.`);
    seen.add(duplicateKey);
    const clicks = count(cells[clicksIndex], `Clicks on row ${line}`);
    const impressions = count(cells[impressionsIndex], `Impressions on row ${line}`);
    if (clicks > impressions) throw new Error(`Clicks exceed impressions on CSV row ${line}.`);
    const rawPosition = positionIndex < 0 ? "" : cells[positionIndex].trim();
    const position = rawPosition === "" ? null : Number(rawPosition);
    if (position !== null && (!/^\d+(?:\.\d+)?$/.test(rawPosition) || !Number.isFinite(position) || position < 1 || position > Number.MAX_SAFE_INTEGER)) throw new Error(`Position on row ${line} must be at least 1, or blank if unknown.`);
    return { key, clicks, impressions, ctr: impressions > 0 ? clicks / impressions : null, position };
  });
  return { kind, rows };
}

/** These are totals for the supplied rows, not necessarily totals for a property. */
export function aggregateMetrics(rows: SearchMetricRow[]): { clicks: number; impressions: number; ctr: number | null; position: number | null } {
  let clicks = 0;
  let impressions = 0;
  for (const row of rows) {
    if (!Number.isSafeInteger(row.clicks) || !Number.isSafeInteger(row.impressions) || row.clicks < 0 || row.impressions < row.clicks) throw new Error("Invalid metric counts.");
    clicks += row.clicks;
    impressions += row.impressions;
  }
  if (!Number.isSafeInteger(clicks) || !Number.isSafeInteger(impressions)) throw new Error("Aggregated counts exceed the supported range.");
  const measured = rows.filter((row) => row.impressions > 0);
  const completePosition = measured.length > 0 && measured.every((row) => row.position !== null && Number.isFinite(row.position) && row.position >= 1);
  const position = completePosition ? measured.reduce((sum, row) => sum + row.position! * (row.impressions / impressions), 0) : null;
  return { clicks, impressions, ctr: impressions > 0 ? clicks / impressions : null, position };
}
