// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { supportStaff: { findUnique: vi.fn(), updateMany: vi.fn() }, supportAccessGrant: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() }, webSession: { findFirst: vi.fn() }, user: { findUnique: vi.fn() }, auditLog: { create: vi.fn(), count: vi.fn() }, $transaction: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));
import { requireSupportStaff, unlockSupport } from "@/services/support/access";
import { encryptTotpSecret, totp } from "@/services/support/mfa";
import { hash } from "bcryptjs";

describe("privileged support authentication", () => {
  const context = { userId: "staff", sessionId: "browser-a" };
  const request = () => new Request("https://app.example/api/support/staff", { headers: { cookie: "support_access=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG" } });
  beforeEach(() => { vi.resetAllMocks(); db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db)); });
  it("denies workspace owners without separate support staff membership", async () => {
    db.supportStaff.findUnique.mockResolvedValue(null);
    await expect(requireSupportStaff(request(), context)).rejects.toThrow("privileged support");
    expect(db.supportAccessGrant.findFirst).not.toHaveBeenCalled();
  });
  it("requires a live grant bound to the current browser session", async () => {
    db.supportStaff.findUnique.mockResolvedValue({ active: true, role: "support_agent" });
    db.supportAccessGrant.findFirst.mockResolvedValue(null);
    await expect(requireSupportStaff(request(), context)).rejects.toThrow("Unlock");
    expect(db.supportAccessGrant.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "staff", webSessionId: "browser-a", revokedAt: null, expiresAt: { gt: expect.any(Date) } }) }));
  });
  it("rejects a mobile bearer context and revoked browser session", async () => {
    await expect(requireSupportStaff(request(), { userId: "staff", sessionId: null })).rejects.toThrow("browser");
    db.supportStaff.findUnique.mockResolvedValue({ active: true, role: "support_agent" });
    db.supportAccessGrant.findFirst.mockResolvedValue({ id: "grant" });
    db.webSession.findFirst.mockResolvedValue(null);
    await expect(requireSupportStaff(request(), context)).rejects.toThrow("session");
  });
  it("rate limits unlock attempts using durable audit records", async () => {
    db.auditLog.count.mockResolvedValue(5);
    await expect(unlockSupport(context, "password", "123456")).rejects.toThrow("attempts");
    expect(db.supportAccessGrant.create).not.toHaveBeenCalled();
  });
  it("requires password and unreplayed MFA before issuing a hashed ten-minute grant", async () => {
    const key = Buffer.alloc(32, 8).toString("base64");
    vi.stubEnv("SUPPORT_ENCRYPTION_KEY", key);
    const secret = Buffer.from("12345678901234567890");
    db.auditLog.count.mockResolvedValue(0);
    db.supportStaff.findUnique.mockResolvedValue({ active: true, role: "support_agent", totpSecretEnc: encryptTotpSecret(secret, key), lastTotpCounter: null });
    db.user.findUnique.mockResolvedValue({ passwordHash: await hash("safe password", 4) });
    db.supportStaff.updateMany.mockResolvedValue({ count: 1 });
    const grant = await unlockSupport(context, "safe password", totp(secret, Date.now() / 1000));
    expect(grant.token.length).toBeGreaterThan(32);
    expect(db.supportAccessGrant.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "staff", webSessionId: "browser-a", tokenHash: expect.not.stringContaining(grant.token), expiresAt: expect.any(Date) }) });
    db.supportStaff.updateMany.mockResolvedValue({ count: 0 });
    await expect(unlockSupport(context, "safe password", totp(secret, Date.now() / 1000))).rejects.toThrow("code");
    vi.unstubAllEnvs();
  });
});
