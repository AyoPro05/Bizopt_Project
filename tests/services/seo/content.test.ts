import { describe, expect, it } from "vitest";
import { createContentBrief, draftFromBrief, exportMarkdown, reviewContent } from "@/services/seo/content";

const site = { url: "https://example.com", services: "Plumbing", audience: "homeowners", goal: "Win local enquiries", locale: "en-GB", serviceAreas: ["London"] };
const opportunity = { title: "Plumbing in London", keyword: "plumbing London", intent: "commercial", targetUrl: null, evidence: "Business brief only" };

describe("content briefs and drafts", () => {
  it("produces an actionable validated brief with evidence checks", () => {
    const brief = createContentBrief(site, opportunity);
    expect(brief).toMatchObject({ audience: "homeowners", keyword: "plumbing London", targetUrl: null });
    expect(brief.outline.length).toBeGreaterThanOrEqual(4);
    expect(brief.internalLinks.every((link) => link.startsWith(site.url))).toBe(true);
    expect(brief.claimsToVerify.join(" ")).toMatch(/price|qualification|service area/i);
    expect(() => createContentBrief(site, { ...opportunity, keyword: "" })).toThrow();
  });

  it("creates a labelled template with explicit factual placeholders", () => {
    const draft = draftFromBrief(site, createContentBrief(site, opportunity));
    expect(draft.source).toBe("template");
    expect(draft.body).toMatch(/\[VERIFY:/);
    expect(draft.body).not.toMatch(/20 years|award.winning|guaranteed rankings/i);
    expect(draft.reviewNotes.join(" ")).toMatch(/publish|verify/i);
    expect(draft.slug).toBe("plumbing-london");
    expect(reviewContent(draft, opportunity.keyword).join(" ")).toMatch(/placeholder/i);
  });

  it("supports complete business briefs and editor-compatible slugs across locales", () => {
    const fullSite = { ...site, services: "a".repeat(1500), audience: "b".repeat(500), goal: "c".repeat(500), serviceAreas: Array.from({ length: 20 }, () => "d".repeat(120)) };
    const fullOpportunity = { ...opportunity, keyword: "e".repeat(500), evidence: "f".repeat(6000) };
    const draft = draftFromBrief(fullSite, createContentBrief(fullSite, fullOpportunity));
    expect(draft.title.length).toBeLessThanOrEqual(200);
    const localised = draftFromBrief(site, createContentBrief(site, { ...opportunity, keyword: "東京 配管" }));
    expect(localised.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("flags missing search fields, keyword overuse, unverified guarantees and unsafe markup", () => {
    expect(reviewContent({ title: "", description: "", body: "" }, "plumbing").length).toBeGreaterThanOrEqual(3);
    const issues = reviewContent({ title: "Plumbing", description: "Plumbing in London", body: `${"plumbing ".repeat(80)}guaranteed #1 rankings<script>alert(1)</script>` }, "plumbing");
    expect(issues.join(" ")).toMatch(/overuse|stuffing/i);
    expect(issues.join(" ")).toMatch(/guarantee/i);
    expect(issues.join(" ")).toMatch(/HTML|markup/i);
  });

  it("exports plain Markdown with safely quoted metadata and inert HTML", () => {
    const markdown = exportMarkdown({ title: 'A "quoted" title\n---', description: "=HYPERLINK(x)", slug: "test", body: "<script>alert(1)</script>\nUseful text" });
    expect(markdown).toContain('title: "A \\"quoted\\" title\\n---"');
    expect(markdown).toContain("=HYPERLINK(x)");
    expect(markdown).not.toContain("<script>");
    expect(markdown).toContain("Useful text");
  });
});
