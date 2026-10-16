import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, auditSite } = vi.hoisted(() => ({
  db: { seoAuditRun: { findFirst: vi.fn(), updateMany: vi.fn() }, seoSite: { findFirst: vi.fn() }, orgMember: { findUnique: vi.fn() }, auditLog: { create: vi.fn() } },
  auditSite: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/services/seo/audit", () => ({ auditSite }));
import { processSeoAudit } from "@/services/seo/jobs";

describe("durable SEO audit jobs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.seoAuditRun.findFirst.mockResolvedValue({ id: "run", orgId: "org", siteId: "site", requestedBy: "user", attempts: 0 });
    db.seoAuditRun.updateMany.mockResolvedValue({ count: 1 });
    db.seoSite.findFirst.mockResolvedValue({ id: "site", url: "https://example.com", authorisedAt: new Date() });
    db.orgMember.findUnique.mockResolvedValue({ role: "owner" });
    auditSite.mockResolvedValue({ pages: [], findings: [], coverage: [], limited: false });
  });
  it("allows only the worker that claimed a lease to crawl", async () => {
    db.seoAuditRun.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await processSeoAudit()).toBe(false);
    expect(auditSite).not.toHaveBeenCalled();
  });
  it("rechecks current membership before inspecting a site", async () => {
    db.orgMember.findUnique.mockResolvedValue(null);
    await processSeoAudit();
    expect(auditSite).not.toHaveBeenCalled();
    expect(db.seoAuditRun.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }));
  });
  it("persists completion only while it still owns the running lease", async () => {
    await processSeoAudit();
    expect(db.seoAuditRun.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "run", orgId: "org", status: "running", lockedAt: expect.any(Date) }), data: expect.objectContaining({ status: "complete", finishedAt: expect.any(Date) }) }));
  });
  it("backs off transient failures and stops after three attempts", async () => {
    auditSite.mockRejectedValue(new Error("Provider unavailable"));
    await processSeoAudit();
    expect(db.seoAuditRun.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "queued", nextAttemptAt: expect.any(Date) }) }));
    db.seoAuditRun.findFirst.mockResolvedValue({ id: "run", orgId: "org", siteId: "site", requestedBy: "user", attempts: 2 });
    await processSeoAudit();
    expect(db.seoAuditRun.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }));
  });
  it("recovers abandoned leases instead of leaving jobs running forever", async () => {
    await processSeoAudit();
    expect(db.seoAuditRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: expect.arrayContaining([expect.objectContaining({ status: "running", lockedAt: expect.objectContaining({ lt: expect.any(Date) }) })]) }) }));
  });
});
