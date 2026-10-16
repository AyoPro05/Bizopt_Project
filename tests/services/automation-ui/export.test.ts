import { beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { dataExportJob: { findFirst: vi.fn(), updateMany: vi.fn() }, orgMember: { findUnique: vi.fn() }, user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ db }));
import { readAccountExport } from "@/services/account/data-export";
describe("private expiring data export", () => {
  beforeEach(() => { vi.resetAllMocks(); db.orgMember.findUnique.mockResolvedValue({ role: "member" }); db.user.findUnique.mockResolvedValue({ emailVerified: new Date() }); });
  it("requires current verified identity, current workspace, ready state and unexpired access", async () => {
    db.dataExportJob.findFirst.mockResolvedValue(null);
    await expect(readAccountExport("org-a","person-a","export-id")).rejects.toThrow("unavailable");
    expect(db.dataExportJob.findFirst.mock.calls[0][0].where).toMatchObject({ id:"export-id",orgId:"org-a",userId:"person-a",status:"ready",expiresAt:{gt:expect.any(Date)} });
  });
  it("does not load encrypted archive data for an unverified account", async () => {
    db.user.findUnique.mockResolvedValue({emailVerified:null});
    await expect(readAccountExport("org-a","person-a","export-id")).rejects.toThrow("Verify"); expect(db.dataExportJob.findFirst).not.toHaveBeenCalled();
  });
});
