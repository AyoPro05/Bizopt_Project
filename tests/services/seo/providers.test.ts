import { afterEach, describe, expect, it, vi } from "vitest";
import { readSearchConsole, SEO_PROVIDERS, SearchConsoleProviderError } from "@/services/seo/providers";

const token = "private-access-token";
const range = { startDate: "2026-10-01", endDate: "2026-10-14" };
const row = { keys: ["plumbing London"], clicks: 2, impressions: 100, ctr: 0.02, position: 8 };
const respond = (body: unknown, status = 200) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("honest SEO provider capabilities", () => {
  it("advertises only available manual workflows and gives unavailable integrations a reason", () => {
    expect(SEO_PROVIDERS.map((provider) => provider.id)).toEqual(["search_console", "business_profile", "wordpress", "semrush", "pagespeed"]);
    for (const provider of SEO_PROVIDERS) {
      expect(["manual", "unavailable"]).toContain(provider.status);
      expect(provider.reason.length).toBeGreaterThan(15);
      expect(provider.docsUrl).toMatch(/^https:\/\//);
      if (provider.status === "unavailable") expect(provider.capabilities).toEqual([]);
    }
    expect(SEO_PROVIDERS[0]).toMatchObject({ status: "manual", capabilities: ["Search Console CSV import"] });
    expect(SEO_PROVIDERS[0].reason).toMatch(/OAuth.*unavailable/i);
    expect(SEO_PROVIDERS[1].reason).toMatch(/API.*unavailable/i);
    expect(SEO_PROVIDERS[2].reason).toMatch(/publish.*unavailable/i);
  });
});

describe("read-only Search Console provider contract", () => {
  it("encodes the exact property, requests finalized top rows and labels the result partial", async () => {
    const fetchMock = respond({ rows: [row], responseAggregationType: "byProperty", ignored: "unused" });
    vi.stubGlobal("fetch", fetchMock);
    const result = await readSearchConsole(token, "https://example.com/resources/", { ...range, dimensions: ["query"], startRow: 25000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fexample.com%2Fresources%2F/searchAnalytics/query");
    expect(request).toMatchObject({ method: "POST", cache: "no-store", redirect: "error", credentials: "omit", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(request.body)).toEqual({ ...range, dimensions: ["query"], startRow: 25000, rowLimit: 25000, dataState: "final", type: "web", aggregationType: "byProperty" });
    expect(result).toMatchObject({ rows: [row], scope: "breakdown", completeness: "partial", source: "search_console", property: "https://example.com/resources/", ...range, responseAggregationType: "byProperty" });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(result).not.toHaveProperty("ignored");
  });

  it("keeps dimensionless property totals separate from page and date breakdowns", async () => {
    const fetchMock = respond({ rows: [{ ...row, keys: [] }], responseAggregationType: "byProperty" });
    vi.stubGlobal("fetch", fetchMock);
    const totals = await readSearchConsole(token, "sc-domain:example.com", range);
    expect(fetchMock.mock.calls[0][0]).toContain("sc-domain%3Aexample.com");
    expect(totals).toMatchObject({ scope: "property_totals", dimensions: [], completeness: "partial" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ rows: [{ ...row, keys: ["https://example.com/"] }], responseAggregationType: "byPage" })));
    expect(await readSearchConsole(token, "sc-domain:example.com", { ...range, dimensions: ["page"] })).toMatchObject({ scope: "breakdown" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).aggregationType).toBe("auto");
  });

  it("preserves empty data without manufacturing measured zero rows or completeness", async () => {
    vi.stubGlobal("fetch", respond({}));
    expect(await readSearchConsole(token, "https://example.com/", range)).toMatchObject({ rows: [], responseAggregationType: null, completeness: "partial" });
  });

  it.each([
    [401, "token_revoked"], [403, "permission_denied"], [429, "quota_exceeded"], [503, "provider_unavailable"],
  ])("classifies HTTP %i without exposing provider error bodies", async (status, code) => {
    vi.stubGlobal("fetch", respond({ error: { message: token } }, status as number));
    const error = await readSearchConsole(token, "https://example.com/", range).catch((value) => value);
    expect(error).toBeInstanceOf(SearchConsoleProviderError);
    expect(error.code).toBe(code);
    expect(error.message).not.toContain(token);
    expect(JSON.stringify(error)).not.toContain(token);
  });

  it("redacts network errors and response values that echo the token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(`Authorization failed: ${token}`)));
    await expect(readSearchConsole(token, "https://example.com/", range)).rejects.toMatchObject({ code: "provider_unavailable" });
    vi.stubGlobal("fetch", respond({ rows: [{ ...row, keys: [token] }], responseAggregationType: "byProperty" }));
    const error = await readSearchConsole(token, "https://example.com/", { ...range, dimensions: ["query"] }).catch((value) => value);
    expect(error).toMatchObject({ code: "invalid_response" });
    expect(error.message).not.toContain(token);
  });

  it.each([
    { ...row, clicks: -1 }, { ...row, clicks: 101 }, { ...row, ctr: 10 }, { ...row, position: null }, { ...row, position: 0 }, { ...row, keys: [] },
  ])("validates response metrics and dimension keys: %j", async (invalid) => {
    vi.stubGlobal("fetch", respond({ rows: [invalid], responseAggregationType: "byProperty" }));
    await expect(readSearchConsole(token, "https://example.com/", { ...range, dimensions: ["query"] })).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects malformed aggregation and non-JSON responses", async () => {
    vi.stubGlobal("fetch", respond({ rows: [row], responseAggregationType: "madeUp" }));
    await expect(readSearchConsole(token, "https://example.com/", { ...range, dimensions: ["query"] })).rejects.toMatchObject({ code: "invalid_response" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`not JSON ${token}`)));
    await expect(readSearchConsole(token, "https://example.com/", range)).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("aborts a stalled fetch after ten seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, request: RequestInit) => new Promise((_resolve, reject) => {
      request.signal?.addEventListener("abort", () => reject(new Error(`Abort ${token}`)));
    })));
    const result = readSearchConsole(token, "https://example.com/", range).catch((error) => error);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toMatchObject({ code: "provider_unavailable" });
    expect((await result).message).not.toContain(token);
  });

  it.each([
    { ...range, endDate: "2026-02-30" },
    { ...range, startDate: "2026-10-15" },
    { ...range, startRow: -1 },
    { ...range, dimensions: ["query", "query"] },
  ])("validates request options before sending HTTP: %j", async (options) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(readSearchConsole(token, "https://example.com/", options as Parameters<typeof readSearchConsole>[2])).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
