// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { disposableTestDatabase } from "@/scripts/test-database-config.mjs";
import { createSeoSite, createSeoPlan, createSeoContent, getSeoContent, saveSeoVersion, exportSeoContent, importSeoSearch, queueSeoAudit } from "@/services/seo/workspace";

// Opt in only against the disposable local database; never use the app's .env URL.
const testUrl = disposableTestDatabase(process.env.SEO_TEST_DATABASE_URL);
const enabled = !!testUrl;
const db = new PrismaClient({ datasourceUrl: enabled ? testUrl : "postgresql://disabled@127.0.0.1:1/disabled" });
const suffix = randomUUID();
let orgId = "";
let otherOrgId = "";
let userId = "";
let siteId = "";
let contentId = "";

describe.skipIf(!enabled)("SEO PostgreSQL integration", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== testUrl) throw new Error("DATABASE_URL must match the isolated test database.");
    const user = await db.user.create({ data: { email: `seo-${suffix}@example.test`, name: "SEO test" } });
    userId = user.id;
    const org = await db.organization.create({ data: { name: "SEO tests", slug: `seo-${suffix}`, members: { create: { userId, role: "owner" } } } });
    orgId = org.id;
    otherOrgId = (await db.organization.create({ data: { name: "Other tenant", slug: `other-${suffix}` } })).id;
  });

  afterAll(async () => {
    if (orgId) {
      await db.seoSite.deleteMany({ where: { orgId } });
      await db.editorSession.deleteMany({ where: { orgId } });
      await db.auditLog.deleteMany({ where: { orgId } });
      await db.organization.delete({ where: { id: orgId } });
    }
    if (otherOrgId) await db.organization.delete({ where: { id: otherOrgId } });
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it("persists website, opportunities, brief, session, draft and export", async () => {
    const site = await createSeoSite(orgId, userId, { name: "Example services", url: "https://example.com", services: "Office cleaning", goal: "More enquiries", audience: "Office managers", locale: "en-GB", serviceAreas: ["London"], authorised: true });
    siteId = site.id;
    expect(site.authorisedBy).toBe(userId);
    expect(await createSeoPlan(orgId, siteId)).toBeGreaterThan(0);
    const opportunity = await db.seoOpportunity.findFirstOrThrow({ where: { orgId, siteId } });
    const content = await createSeoContent(orgId, userId, siteId, opportunity.id);
    contentId = content.id;
    const loaded = await getSeoContent(orgId, siteId, contentId);
    expect(loaded.versions[0].version).toBe(1);
    expect(loaded.reviewNotes.length).toBeGreaterThan(0);
    expect((await db.editorSession.findUniqueOrThrow({ where: { id: content.sessionId } })).entityType).toBe("seo_content");
    expect((await exportSeoContent(orgId, siteId, contentId)).markdown).toContain("[VERIFY:");
  });

  it("enforces tenant isolation in service lookups and database foreign keys", async () => {
    await expect(getSeoContent(otherOrgId, siteId, contentId)).rejects.toThrow("not found");
    await expect(db.seoOpportunity.create({ data: { orgId: otherOrgId, siteId, key: "cross-tenant", payload: {} } })).rejects.toMatchObject({ code: "P2003" });
  });

  it("keeps both immutable versions and rejects a stale writer", async () => {
    const input = { expectedVersion: 1, title: "Useful verified title", description: "A useful description", slug: "office-cleaning", body: "# Office cleaning\n\nAccurate editorial copy." };
    const updated = await saveSeoVersion(orgId, userId, contentId, input);
    expect(updated.version).toBe(2);
    await expect(saveSeoVersion(orgId, userId, contentId, input)).rejects.toThrow("changed");
    const versions = (await getSeoContent(orgId, siteId, contentId)).versions;
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    expect((await exportSeoContent(orgId, siteId, contentId)).version).toBe(2);
  });

  it("stores query subtotals separately from complete daily totals", async () => {
    const range = { property: "sc-domain:example.com", startDate: "2026-01-01", endDate: "2026-01-02", searchType: "web" };
    const totals = await importSeoSearch(orgId, userId, siteId, { ...range, csv: "Date,Clicks,Impressions,Position\n2026-01-01,10,100,5\n2026-01-02,20,200,10" });
    const queries = await importSeoSearch(orgId, userId, siteId, { ...range, csv: "Top queries,Clicks,Impressions,Position\noffice cleaning,1,20,7" });
    expect(totals.kind).toBe("totals");
    expect(totals.completeness).toBe("imported_complete_dates");
    expect(queries.kind).toBe("queries");
    expect(queries.completeness).toBe("partial");
    expect((totals.totals as { clicks: number }).clicks).toBe(30);
    await expect(importSeoSearch(orgId, userId, siteId, { ...range, property: "sc-domain:other.example", csv: "Date,Clicks,Impressions\n2026-01-01,0,0" })).rejects.toThrow("cover");
  });

  it("persists one pending job and reuses it across repeated requests", async () => {
    const first = await queueSeoAudit(orgId, userId, siteId);
    const second = await queueSeoAudit(orgId, userId, siteId);
    expect(first.id).toBe(second.id);
    expect(await db.seoAuditRun.count({ where: { orgId, siteId } })).toBe(1);
  });

  it("keeps the ten-site budget under concurrent onboarding", async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => createSeoSite(orgId, userId, { name: `Site ${index}`, url: `https://site-${index}.example.com`, services: "Cleaning", goal: "Enquiries", audience: "Businesses", authorised: true })));
    expect(await db.seoSite.count({ where: { orgId } })).toBeLessThanOrEqual(10);
    expect(attempts.some((result) => result.status === "rejected")).toBe(true);
  });

  it("blocks direct browser-role reads through row security", async () => {
    expect(await db.seoSite.count({ where: { orgId } })).toBeGreaterThan(0);
    await db.$executeRawUnsafe('DO $$ BEGIN CREATE ROLE seo_browser_check NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$');
    await db.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO seo_browser_check');
    await db.$executeRawUnsafe('GRANT SELECT ON "SeoSite" TO seo_browser_check');
    const rows = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE seo_browser_check');
      return tx.$queryRawUnsafe<Array<{ count: number }>>('SELECT count(*)::int AS count FROM "SeoSite"');
    });
    expect(rows[0].count).toBe(0);
  });
});
