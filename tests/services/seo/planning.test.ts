import { describe, expect, it } from "vitest";
import { classifySearchIntent, planOpportunities } from "@/services/seo/planning";

const site = {
  url: "https://example.com",
  services: "Plumbing, boiler repair",
  audience: "homeowners",
  goal: "Win local enquiries",
  locale: "en-GB",
  serviceAreas: ["London", "London", ""],
};

describe("SEO planning", () => {
  it.each([
    ["how to fix a leaking tap", "informational"],
    ["best plumbing services", "commercial"],
    ["book a plumber near me", "transactional"],
    ["example.com login", "navigational"],
  ])("labels %s as a transparent intent heuristic", (query, intent) => {
    expect(classifySearchIntent(query)).toMatchObject({ intent, confidence: "medium" });
    expect(classifySearchIntent(query).reason).toMatch(/heuristic/i);
  });

  it("marks ambiguous intent low confidence", () => {
    expect(classifySearchIntent("plumbing")).toMatchObject({ confidence: "low" });
  });

  it("builds distinct, business-specific local and wider opportunities without invented metrics", () => {
    const opportunities = planOpportunities(site);
    expect(opportunities.length).toBeGreaterThan(2);
    expect(opportunities.some((item) => /london/i.test(item.keyword))).toBe(true);
    expect(opportunities.some((item) => !/london/i.test(item.keyword))).toBe(true);
    expect(new Set(opportunities.map((item) => item.key)).size).toBe(opportunities.length);
    for (const item of opportunities) {
      expect(item.volume).toBeNull();
      expect(item.difficulty).toBeNull();
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(100);
      expect(item.scoreVersion).toBeTruthy();
      expect(item.reason).toMatch(/heuristic/i);
      expect(item.reason).toMatch(/existing page/i);
      expect(item.evidence).toMatch(/brief/i);
      expect(item.targetUrl).toBeNull();
    }
  });

  it("uses measured query evidence, deduplicates terms and explains a quick-win score", () => {
    const opportunities = planOpportunities(site, [
      { query: "plumbing London", clicks: 1, impressions: 400, position: 8 },
      { query: " Plumbing   London ", clicks: 1, impressions: 400, position: 8 },
    ]);
    const matched = opportunities.filter((item) => item.keyword.toLowerCase() === "plumbing london");
    expect(matched).toHaveLength(1);
    expect(matched[0]).toMatchObject({ source: "search_console_import", targetUrl: null, action: "create" });
    expect(matched[0].evidence).toContain("400");
    expect(matched[0].reason).toMatch(/position|ranking/i);
    expect(matched[0].reason).toMatch(/query/i);
    expect(planOpportunities(site, [{ query: "plumbing London", clicks: 1, impressions: 400, position: 60 }])[0].score).toBeLessThan(matched[0].score);
  });

  it("ignores invalid input metrics and never treats imports as search volume", () => {
    const opportunities = planOpportunities(site, [{ query: "bad", clicks: 3, impressions: 2, position: 8 }]);
    expect(opportunities.some((item) => item.keyword === "bad")).toBe(false);
    expect(opportunities.every((item) => item.volume === null)).toBe(true);
  });
});
