import { describe, expect, it } from "vitest";
import { aggregateMetrics, parseSearchConsoleCsv } from "@/services/seo/metrics";

describe("Search Console CSV imports", () => {
  it("keeps query imports separate from site totals and recalculates CTR", () => {
    const result = parseSearchConsoleCsv('\uFEFFTop queries,Clicks,Impressions,CTR,Position\r\n"plumber, london",2,100,99%,8\r\n');
    expect(result).toEqual({ kind: "queries", rows: [{ key: "plumber, london", clicks: 2, impressions: 100, ctr: 0.02, position: 8 }] });
    expect(aggregateMetrics(result.rows)).toEqual({ clicks: 2, impressions: 100, ctr: 0.02, position: 8 });
  });

  it.each(["Query", "Top queries", "Page", "Top pages", "Date"])("recognises %s exports", (header) => {
    const key = header === "Date" ? "2026-10-01" : "=HYPERLINK(\"example\")";
    const escaped = `"${key.replace(/"/g, '""')}"`;
    const result = parseSearchConsoleCsv(`${header},Clicks,Impressions\n${escaped},0,0`);
    expect(result.kind).toBe(header === "Date" ? "totals" : header.includes("Page") || header.includes("pages") ? "pages" : "queries");
    expect(result.rows[0]).toEqual({ key, clicks: 0, impressions: 0, ctr: null, position: null });
  });

  it("distinguishes absent position and empty datasets from measured zero clicks", () => {
    const empty = parseSearchConsoleCsv("Query,Clicks,Impressions,Position\n");
    expect(empty.rows).toEqual([]);
    expect(aggregateMetrics(empty.rows)).toEqual({ clicks: 0, impressions: 0, ctr: null, position: null });
    const measured = parseSearchConsoleCsv("Query,Clicks,Impressions,Position\nlocal service,0,100,");
    expect(measured.rows[0].ctr).toBe(0);
    expect(measured.rows[0].position).toBeNull();
    expect(aggregateMetrics(measured.rows).position).toBeNull();
  });

  it("weights position by impressions only when every measured row has a position", () => {
    const rows = parseSearchConsoleCsv("Date,Clicks,Impressions,Position\n2026-10-01,2,100,4\n2026-10-02,3,300,8\n2026-10-03,0,0,").rows;
    expect(aggregateMetrics(rows)).toEqual({ clicks: 5, impressions: 400, ctr: 0.0125, position: 7 });
    rows[1].position = null;
    expect(aggregateMetrics(rows).position).toBeNull();
  });

  it("supports quoted numbers, escaped quotes and embedded newlines", () => {
    const result = parseSearchConsoleCsv('Query,Clicks,Impressions,Position\n"a ""local""\nservice",1,"1,000",2.5');
    expect(result.rows[0]).toMatchObject({ key: 'a "local"\nservice', impressions: 1000, position: 2.5 });
  });

  it.each([
    "Query,Clicks,Impressions\nx,-1,2",
    "Query,Clicks,Impressions\nx,3,2",
    "Query,Clicks,Impressions\nx,NaN,2",
    "Query,Clicks,Impressions\nx,,2",
    "Query,Clicks,Impressions\nx,1.5,2",
    "Query,Clicks,Impressions\nx,1,Infinity",
    "Query,Clicks,Impressions,Position\nx,1,2,0",
    "Query,Clicks,Impressions\nx,1,2\nx,1,2",
    "Date,Clicks,Impressions\n2026-02-30,0,0",
    "Date,Query,Clicks,Impressions\n2026-10-01,x,0,0",
    "Query,Clicks,Impressions\n\"unfinished,1,2",
    "Query,Clicks,Impressions\n\"x\"suffix,1,2",
    "Query,Clicks,Impressions\nx,1,2,3",
  ])("rejects malformed or misleading metrics: %s", (csv) => {
    expect(() => parseSearchConsoleCsv(csv)).toThrow();
  });

  it("rejects duplicate headers and oversized imports", () => {
    expect(() => parseSearchConsoleCsv("Query,Clicks,Clicks,Impressions\nx,1,1,2")).toThrow();
    expect(() => parseSearchConsoleCsv(`Query,Clicks,Impressions\n${"x".repeat(1_048_576)},0,0`)).toThrow(/1 MB/);
    expect(() => parseSearchConsoleCsv(`Query,Clicks,Impressions\n${Array.from({ length: 5001 }, (_, i) => `q${i},0,0`).join("\n")}`)).toThrow(/5,000/);
  });
});
