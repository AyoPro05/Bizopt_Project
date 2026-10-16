import { beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { user: { findUnique: vi.fn(), update: vi.fn() }, webSession: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() }, mobileSession: { updateMany: vi.fn() }, supportAccessGrant: { updateMany: vi.fn() }, auditLog: { create: vi.fn() }, $transaction: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("bcryptjs", () => ({ compare: vi.fn(async (password: string) => password === "correct-password") }));
import { createWebSession, validateWebSession, revokeAccountSessions, requirePassword } from "@/services/account/sessions";

describe("server-revocable account sessions", () => {
  beforeEach(() => { vi.resetAllMocks(); db.$transaction.mockImplementation(async (arg: unknown) => typeof arg === "function" ? arg(db) : Promise.all(arg as Promise<unknown>[])); });
  it("creates a cryptographically random session bound to the user's revocation version", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user", sessionVersion: 3 });
    db.webSession.create.mockImplementation(async ({ data }) => data);
    const result = await createWebSession("user");
    expect(result.id).toMatch(/^[a-f0-9]{64}$/);
    expect(result.version).toBe(3);
  });
  it("rejects revoked sessions even with a still-valid JWT", async () => {
    db.webSession.findFirst.mockResolvedValue(null);
    expect(await validateWebSession("user", "session", 0)).toBe(false);
    expect(db.webSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "user", id: "session", revokedAt: null }) }));
  });
  it("prevents legacy JWT migration from bypassing sign-out-all", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user", sessionVersion: 1 });
    await expect(createWebSession("user", true)).rejects.toThrow("Sign in again");
    expect(db.webSession.create).not.toHaveBeenCalled();
  });
  it("rejects an older session version", async () => {
    db.webSession.findFirst.mockResolvedValue({ version: 1, lastUsedAt: new Date(), user: { sessionVersion: 2 } });
    expect(await validateWebSession("user", "session", 1)).toBe(false);
  });
  it("accepts a live session at the current version", async () => {
    db.webSession.findFirst.mockResolvedValue({ version: 2, lastUsedAt: new Date(), user: { sessionVersion: 2 } });
    expect(await validateWebSession("user", "session", 2)).toBe(true);
  });
  it("revokes browser, mobile and support access together", async () => {
    await revokeAccountSessions("user");
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "user" }, data: { sessionVersion: { increment: 1 } } });
    expect(db.mobileSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user", revokedAt: null } }));
    expect(db.supportAccessGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user", revokedAt: null } }));
  });
  it("requires password reauthentication before sensitive changes", async () => {
    db.user.findUnique.mockResolvedValue({ passwordHash: "hash" });
    await expect(requirePassword("user", "incorrect")).rejects.toThrow("password");
  });
});
