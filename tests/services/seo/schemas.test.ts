import { describe, expect, it } from "vitest";
import { siteInput, actionInput } from "@/services/seo/schemas";
const business = { url: "https://example.com", name: "Example", goal: "Enquiries", services: "Cleaning", audience: "Local businesses", locale: "en-GB", serviceAreas: [], authorised: true };
describe("SEO input contracts", () => {
  it("returns a field validation result for a malformed URL", () => {
    expect(siteInput.safeParse({ ...business, url: "broken" }).success).toBe(false);
  });
  it("requires explicit public website authorisation", () => {
    expect(siteInput.safeParse({ ...business, authorised: false }).success).toBe(false);
  });
  it.each(["http://example.com", "https://name:password@example.com", "https://example.com:8443", "https://example.com?q=private"]) ("rejects unsupported website scope %s", (url) => {
    expect(siteInput.safeParse({ ...business, url }).success).toBe(false);
  });
  it("keeps local features optional", () => {
    expect(siteInput.parse(business).serviceAreas).toEqual([]);
  });
  it("rejects impossible reporting dates", () => {
    expect(actionInput.safeParse({ action: "import", csv: "data", property: "https://example.com", startDate: "2026-02-30", endDate: "2026-03-01" }).success).toBe(false);
  });
  it("rejects attempts to change approval state through an action", () => {
    expect(actionInput.safeParse({ action: "publish", approved: true }).success).toBe(false);
  });
});
