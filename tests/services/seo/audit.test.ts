// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/seo/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  safeFetch: vi.fn(),
}));

import { auditSite, parsePage } from "@/services/seo/audit";
import { safeFetch } from "@/services/seo/safe-fetch";

const fetchMock = vi.mocked(safeFetch);
const fixture = (title = "Local services") => `<html><head><title>${title}</title><meta name="description" content="Local help &amp; services"><link rel="canonical" href="/services"><script type="application/ld+json">{"@type":"LocalBusiness"}</script></head><body><h1>Help</h1><img src="x" alt=""><img src="y"><a href="/services/contact#team">Contact</a><a href="https://other.com">External</a></body></html>`;

beforeEach(() => vi.resetAllMocks());

function site(resources: Record<string, { status?: number; body: string; headers?: Record<string, string> }>) {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    const found = resources[new URL(url).pathname] ?? { status: 404, body: "" };
    return { url, status: found.status ?? 200, body: found.body, headers: found.headers ?? { "content-type": "text/html" } };
  });
}

describe("observed HTML extraction", () => {
  it("extracts decoded metadata, intentional empty alt, canonical and normalised links", () => {
    const page = parsePage(fixture(), "https://example.com/services", 200);
    expect(page).toMatchObject({ title: "Local services", description: "Local help & services", h1Count: 1, canonical: "https://example.com/services", images: 2, missingAlt: 1, indexable: true });
    expect(page.links).toContain("https://example.com/services/contact");
  });

  it("honours noindex tokens but ignores tags inside scripts and comments", () => {
    const page = parsePage(`<meta name="robots" content="nofollow, NOINDEX"><script>let x='<h1>fake</h1><a href="/fake">x</a>'</script><!-- <h1>fake</h1> -->`, "https://example.com/", 200);
    expect(page.indexable).toBe(false);
    expect(page.h1Count).toBe(0);
    expect(page.links).toEqual([]);
  });
});

describe("bounded site audit", () => {
  it("fails closed when robots cannot be fetched", async () => {
    fetchMock.mockRejectedValue(new Error("network unavailable"));
    const result = await auditSite("https://example.com/services");
    expect(result.pages).toEqual([]);
    expect(result.limited).toBe(true);
    expect(result.findings.some((f) => f.code === "ROBOTS_UNAVAILABLE")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not request disallowed pages including a matching wildcard rule", async () => {
    site({ "/robots.txt": { body: "User-agent: *\nDisallow: /services/private*\nAllow: /services/private/public$" }, "/services": { body: `${fixture()}<a href="/services/private-secret">private</a><a href="/outside">outside</a>` } });
    const result = await auditSite("https://example.com/services");
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).not.toContain("https://example.com/services/private-secret");
    expect(urls).not.toContain("https://example.com/outside");
    expect(result.coverage.join(" ")).toMatch(/robots/i);
  });

  it("uses same-scope sitemap links and reports observed duplicate metadata and broken pages", async () => {
    site({
      "/robots.txt": { status: 404, body: "" },
      "/sitemap.xml": { body: `<urlset><url><loc>https://example.com/services/other</loc></url><url><loc>https://other.com/evil</loc></url></urlset>` },
      "/services": { body: `${fixture()}<script type="application/ld+json">{broken}</script>` },
      "/services/other": { body: fixture() },
      "/services/contact": { status: 404, body: "missing" },
    });
    const result = await auditSite("https://example.com/services");
    expect(result.pages.map((page) => page.url)).toContain("https://example.com/services/other");
    expect(result.findings.map((f) => f.code)).toEqual(expect.arrayContaining(["DUPLICATE_TITLE", "DUPLICATE_DESCRIPTION", "BROKEN_INTERNAL_LINK", "INVALID_STRUCTURED_DATA", "MISSING_IMAGE_ALT"]));
    expect(fetchMock.mock.calls.every(([url]) => new URL(String(url)).origin === "https://example.com")).toBe(true);
  });

  it("caps the audit at twelve pages and reports the sampling limit", async () => {
    const resources: Record<string, { body: string; status?: number }> = { "/robots.txt": { status: 404, body: "" }, "/services": { body: Array.from({ length: 30 }, (_, i) => `<a href="/services/page${i}">Page</a>`).join("") } };
    for (let i = 0; i < 30; i++) resources[`/services/page${i}`] = { body: fixture(String(i)) };
    site(resources);
    const result = await auditSite("https://example.com/services");
    expect(result.pages).toHaveLength(12);
    expect(result.limited).toBe(true);
  });

  it("refuses to continue when robots returns a server error", async () => {
    site({ "/robots.txt": { status: 503, body: "unavailable" } });
    const result = await auditSite("https://example.com/");
    expect(result.pages).toEqual([]);
    expect(result.findings.map((f) => f.code)).toContain("ROBOTS_UNAVAILABLE");
  });

  it("uses matching crawler-specific groups instead of a wildcard group", async () => {
    site({ "/robots.txt": { body: "User-agent: *\nDisallow: /\nUser-agent: BizOptzSEO\nAllow: /services\nDisallow: /services/private\nAllow: /services/private/public$" }, "/services": { body: `${fixture()}<a href="/services/private/public">Public</a><a href="/services/private/secret">Secret</a>` }, "/services/private/public": { body: fixture("Public") } });
    const result = await auditSite("https://example.com/services");
    expect(result.pages.map((page) => page.url)).toContain("https://example.com/services/private/public");
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain("https://example.com/services/private/secret");
  });

  it("matches robots paths containing percent-encoded unreserved characters", async () => {
    site({ "/robots.txt": { body: "User-agent: *\nDisallow: /services/private" }, "/services": { body: `<a href="/services/%70rivate">Private</a>` } });
    await auditSite("https://example.com/services");
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain("https://example.com/services/%70rivate");
  });

  it("respects noindex response headers", async () => {
    site({ "/robots.txt": { status: 404, body: "" }, "/services": { body: fixture(), headers: { "content-type": "text/html", "x-robots-tag": "noindex" } } });
    const result = await auditSite("https://example.com/services");
    expect(result.pages[0].indexable).toBe(false);
    expect(result.findings.map((finding) => finding.code)).toContain("NOINDEX");
  });

  it("does not follow links beyond depth two", async () => {
    site({ "/robots.txt": { status: 404, body: "" }, "/services": { body: '<a href="/services/one">One</a>' }, "/services/one": { body: '<a href="/services/two">Two</a>' }, "/services/two": { body: '<a href="/services/three">Three</a>' }, "/services/three": { body: fixture() } });
    const result = await auditSite("https://example.com/services");
    expect(result.pages).toHaveLength(3);
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain("https://example.com/services/three");
    expect(result.limited).toBe(true);
  });

  it("flags a canonical that points away from the observed page", async () => {
    site({ "/robots.txt": { status: 404, body: "" }, "/services": { body: '<html><head><title>Service</title><link rel="canonical" href="https://elsewhere.example/other"></head><body><h1>Service</h1></body></html>' } });
    const result = await auditSite("https://example.com/services");
    expect(result.findings.map((finding) => finding.code)).toContain("CANONICAL_OTHER_URL");
  });

  it("follows a bounded same-origin sitemap index to seed pages", async () => {
    site({ "/robots.txt": { body: "User-agent: *\nSitemap: https://example.com/sitemap-index.xml" }, "/sitemap-index.xml": { body: '<sitemapindex><sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap></sitemapindex>' }, "/sitemap-pages.xml": { body: '<urlset><url><loc>https://example.com/services/seed</loc></url></urlset>' }, "/services": { body: '<html><title>Main</title><h1>Main</h1></html>' }, "/services/seed": { body: fixture("Seed") } });
    const result = await auditSite("https://example.com/services");
    expect(result.pages.map((page) => page.url)).toContain("https://example.com/services/seed");
  });

  it("caps findings from hostile repetitive markup", async () => {
    site({ "/robots.txt": { status: 404, body: "" }, "/services": { body: `<html><title>Service</title><h1>Service</h1>${'<script type="application/ld+json">{invalid}</script>'.repeat(300)}</html>` } });
    const result = await auditSite("https://example.com/services");
    expect(result.findings.length).toBeLessThanOrEqual(200);
    expect(result.limited).toBe(true);
  });
});
