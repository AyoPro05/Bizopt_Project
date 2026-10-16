import { z } from "zod";

export type SeoProvider = {
  id: "search_console" | "business_profile" | "wordpress" | "semrush" | "pagespeed";
  name: string;
  status: "manual" | "unavailable";
  reason: string;
  /** Workflows currently exposed in this release, rather than planned API features. */
  capabilities: string[];
  docsUrl: string;
};

export const SEO_PROVIDERS: readonly SeoProvider[] = [
  {
    id: "search_console", name: "Google Search Console", status: "manual",
    reason: "CSV imports are available. OAuth connection is unavailable in this release; the read-only adapter is an integration contract only.",
    capabilities: ["Search Console CSV import"],
    docsUrl: "https://developers.google.com/webmaster-tools/v1/searchanalytics/query",
  },
  {
    id: "business_profile", name: "Google Business Profile", status: "manual",
    reason: "A manual local visibility checklist is available. Business Profile API connection and updates are unavailable in this release.",
    capabilities: ["Local visibility checklist"],
    docsUrl: "https://developers.google.com/my-business",
  },
  {
    id: "wordpress", name: "WordPress", status: "manual",
    reason: "Markdown content export is available for manual transfer. Automatic WordPress publishing is unavailable in this release.",
    capabilities: ["Markdown export"],
    docsUrl: "https://developer.wordpress.org/rest-api/",
  },
  {
    id: "semrush", name: "Semrush", status: "unavailable",
    reason: "Provider credentials and applicable API licensing are not configured. Search volume, difficulty and backlink metrics are unavailable.",
    capabilities: [],
    docsUrl: "https://developer.semrush.com/api/",
  },
  {
    id: "pagespeed", name: "PageSpeed Insights", status: "unavailable",
    reason: "The PageSpeed Insights API is not connected in this release. Performance scores and Core Web Vitals are unavailable.",
    capabilities: [],
    docsUrl: "https://developers.google.com/speed/docs/insights/v5/get-started",
  },
];

export const SEARCH_CONSOLE_READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const dimensionSchema = z.enum(["query", "page", "date", "country", "device"]);
export type SearchConsoleDimension = z.infer<typeof dimensionSchema>;
export type SearchConsoleOptions = {
  startDate: string;
  endDate: string;
  dimensions?: SearchConsoleDimension[];
  startRow?: number;
};

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
});
const optionsSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  dimensions: z.array(dimensionSchema).max(5).default([]).refine((value) => new Set(value).size === value.length),
  startRow: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 25_000).default(0),
}).strict().refine((value) => value.startDate <= value.endDate);

const propertySchema = z.string().min(1).max(2048).refine((value) => {
  if (value.startsWith("sc-domain:")) return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(value.slice(10));
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.hash && !url.search && !/\s/.test(value);
  } catch { return false; }
});
const rowSchema = z.object({
  keys: z.array(z.string().max(25_000)).max(5).default([]),
  clicks: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  impressions: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ctr: z.number().finite().min(0).max(1),
  position: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).refine((row) => row.clicks <= row.impressions && (row.impressions === 0 || row.position >= 1));
const responseSchema = z.object({
  rows: z.array(rowSchema).max(25_000).default([]),
  responseAggregationType: z.enum(["auto", "byPage", "byProperty"]).optional(),
});

export type SearchConsoleRow = z.infer<typeof rowSchema>;
export type SearchConsoleResult = {
  source: "search_console";
  property: string;
  startDate: string;
  endDate: string;
  /** Search Console reports daily ranges in Pacific time. */
  reportingTimezone: "America/Los_Angeles";
  searchType: "web";
  dimensions: SearchConsoleDimension[];
  startRow: number;
  rowLimit: 25000;
  rows: SearchConsoleRow[];
  responseAggregationType: "auto" | "byPage" | "byProperty" | null;
  scope: "property_totals" | "breakdown";
  /** Even paginated API responses may omit rows under Search Console limits. */
  completeness: "partial";
};

type ProviderErrorCode = "invalid_request" | "token_revoked" | "permission_denied" | "quota_exceeded" | "provider_unavailable" | "invalid_response";
const errorDetails: Record<ProviderErrorCode, { message: string; status: number }> = {
  invalid_request: { message: "Check the Search Console property, date range and request options.", status: 400 },
  token_revoked: { message: "Search Console authorisation has expired or been revoked. Reauthorise before retrying.", status: 401 },
  permission_denied: { message: "This account does not have permission to read the selected Search Console property.", status: 403 },
  quota_exceeded: { message: "Search Console request quota was exceeded. Retry later.", status: 429 },
  provider_unavailable: { message: "Search Console is temporarily unavailable or the request timed out. Retry later.", status: 503 },
  invalid_response: { message: "Search Console returned an unsupported response. Try again later.", status: 502 },
};

export class SearchConsoleProviderError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(public readonly code: ProviderErrorCode) {
    super(errorDetails[code].message);
    this.name = "SearchConsoleProviderError";
    this.status = errorDetails[code].status;
    this.retryable = code === "quota_exceeded" || code === "provider_unavailable";
  }
}

/**
 * Server integration contract only: no route, OAuth UI or credential storage is
 * connected to this adapter. Callers must obtain an appropriately scoped token
 * and verify organisation/property access before calling it. The fixed query
 * endpoint reads reports despite Google's POST method; it never mutates a site.
 * https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 */
export async function readSearchConsole(accessToken: string, property: string, options: SearchConsoleOptions): Promise<SearchConsoleResult> {
  const parsedOptions = optionsSchema.safeParse(options);
  if (!parsedOptions.success || !propertySchema.safeParse(property).success || !/^[A-Za-z0-9._~+\/-]+=*$/.test(accessToken)) throw new SearchConsoleProviderError("invalid_request");
  const { startDate, endDate, dimensions, startRow } = parsedOptions.data;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    let response: Response;
    try {
      response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, dimensions, startRow, rowLimit: 25_000, dataState: "final", type: "web", aggregationType: dimensions.includes("page") ? "auto" : "byProperty" }),
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
        credentials: "omit",
      });
    } catch {
      // Network errors can contain headers, URLs or provider bodies; do not wrap them.
      throw new SearchConsoleProviderError("provider_unavailable");
    }
    if (!response.ok) {
      const code = response.status === 401 ? "token_revoked" : response.status === 403 ? "permission_denied" : response.status === 429 ? "quota_exceeded" : response.status === 400 ? "invalid_request" : "provider_unavailable";
      throw new SearchConsoleProviderError(code);
    }
    let raw: unknown;
    try { raw = await response.json(); }
    catch { throw new SearchConsoleProviderError(controller.signal.aborted ? "provider_unavailable" : "invalid_response"); }
    const validated = responseSchema.safeParse(raw);
    if (!validated.success || validated.data.rows.some((row) => row.keys.length !== dimensions.length) || (!dimensions.includes("page") && validated.data.responseAggregationType === "byPage")) throw new SearchConsoleProviderError("invalid_response");
    const result: SearchConsoleResult = {
      source: "search_console", property, startDate, endDate,
      reportingTimezone: "America/Los_Angeles", searchType: "web",
      dimensions, startRow, rowLimit: 25_000,
      rows: validated.data.rows,
      responseAggregationType: validated.data.responseAggregationType ?? null,
      scope: dimensions.length === 0 ? "property_totals" : "breakdown",
      completeness: "partial",
    };
    // A provider must not be allowed to echo this request's credential into output.
    if (JSON.stringify(result).includes(accessToken)) throw new SearchConsoleProviderError("invalid_response");
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
