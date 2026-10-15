import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({ db: {
  seoSite: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
  seoOpportunity: { findFirst: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  seoContent: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  seoContentVersion: { create: vi.fn() },
  seoAuditRun: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  seoSearchImport: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  editorSession: { create: vi.fn(), updateMany: vi.fn() },
  orgMember: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock("@/lib/db", () => ({ db }));

import { requireSeoSite, saveSeoVersion, queueSeoAudit, requireSeoRole, createSeoSite, createSeoPlan } from "@/services/seo/workspace";

describe("SEO workspace isolation and versioning", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation(async (fn: ((tx: typeof db) => unknown) | Promise<unknown>[]) => typeof fn === "function" ? fn(db) : Promise.all(fn));
  });

  it("denies site access outside the current organisation", async () => {
    db.seoSite.findFirst.mockResolvedValue(null);
    await expect(requireSeoSite("org-a", "site-b")).rejects.toThrow("Website not found");
    expect(db.seoSite.findFirst).toHaveBeenCalledWith({ where: { id: "site-b", orgId: "org-a" } });
  });

  it("prevents members from connecting or authorising a site", async () => {
    db.orgMember.findUnique.mockResolvedValue({ role: "member" });
    await expect(requireSeoRole("org", "user", "manage")).rejects.toThrow("owner or admin");
  });

  it("denies removed organisation members even for editing", async () => {
    db.orgMember.findUnique.mockResolvedValue(null);
    await expect(requireSeoRole("org", "removed", "edit")).rejects.toThrow("permission");
  });

  it("rejects stale edits before writing an immutable version", async () => {
    db.seoContent.findFirst.mockResolvedValue({ id: "doc", orgId: "org", currentVersion: 3, sessionId: "session" });
    await expect(saveSeoVersion("org", "user", "doc", { expectedVersion: 2, title: "New title", description: "Description", slug: "new", body: "Body" })).rejects.toThrow("changed");
    expect(db.seoContentVersion.create).not.toHaveBeenCalled();
  });

  it("scopes content lookup and advances the version atomically", async () => {
    db.seoContent.findFirst.mockResolvedValue({ id: "doc", orgId: "org", currentVersion: 2, sessionId: "session" });
    db.seoContent.updateMany.mockResolvedValue({ count: 1 });
    db.seoContentVersion.create.mockResolvedValue({ version: 3 });
    const result = await saveSeoVersion("org", "user", "doc", { expectedVersion: 2, title: "Title", description: "Description", slug: "title", body: "Content" });
    expect(result.version).toBe(3);
    expect(db.seoContent.findFirst).toHaveBeenCalledWith({ where: { id: "doc", orgId: "org" } });
    expect(db.seoContent.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "doc", orgId: "org", currentVersion: 2 } }));
    expect(db.seoContentVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ orgId: "org", contentId: "doc", version: 3 }) }));
  });

  it("rejects a race that loses the optimistic lock", async () => {
    db.seoContent.findFirst.mockResolvedValue({ id: "doc", orgId: "org", currentVersion: 2 });
    db.seoContent.updateMany.mockResolvedValue({ count: 0 });
    await expect(saveSeoVersion("org", "user", "doc", { expectedVersion: 2, title: "Title", description: "", slug: "title", body: "Content" })).rejects.toThrow("changed");
    expect(db.seoContentVersion.create).not.toHaveBeenCalled();
  });

  it("refuses a public crawl without explicit authorisation", async () => {
    db.seoSite.findFirst.mockResolvedValue({ id: "site", authorisedAt: null });
    await expect(queueSeoAudit("org", "user", "site")).rejects.toThrow("authoris");
    expect(db.seoAuditRun.create).not.toHaveBeenCalled();
  });

  it("reuses a pending audit instead of scheduling duplicate work", async () => {
    db.seoSite.findFirst.mockResolvedValue({ id: "site", authorisedAt: new Date() });
    db.seoAuditRun.findFirst.mockResolvedValue({ id: "pending", status: "queued" });
    const result = await queueSeoAudit("org", "user", "site");
    expect(result.id).toBe("pending");
    expect(db.seoAuditRun.create).not.toHaveBeenCalled();
  });

  it("enforces the site budget inside a serializable transaction", async () => {
    db.orgMember.findUnique.mockResolvedValue({ role: "owner" });
    db.seoSite.count.mockResolvedValue(10);
    await expect(createSeoSite("org", "user", { url: "https://example.com", name: "Example", goal: "Enquiries", services: "Cleaning", audience: "Businesses", authorised: true })).rejects.toThrow("10 websites");
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(db.seoSite.create).not.toHaveBeenCalled();
  });

  it("uses web-query reports for web content planning", async () => {
    db.seoSite.findFirst.mockResolvedValue({ url: "https://example.com", services: "Cleaning", audience: "Businesses", goal: "Enquiries", locale: "en-GB", serviceAreas: [], updatedAt: new Date() });
    db.seoSearchImport.findFirst.mockResolvedValue(null);
    await createSeoPlan("org", "site");
    expect(db.seoSearchImport.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: "org", siteId: "site", kind: "queries", searchType: "web" } }));
  });
});
