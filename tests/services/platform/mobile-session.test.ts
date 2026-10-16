import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { mobileSession: { findFirst: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ db }));
import { signAccessToken, validateMobileAccess } from "@/lib/mobile-auth";
describe("mobile access revocation", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("MOBILE_JWT_SECRET", "mobile-fixture-key"); });
  afterEach(() => vi.unstubAllEnvs());
  it("denies an access token once its persisted mobile session is revoked", async () => {
    db.mobileSession.findFirst.mockResolvedValue(null);
    expect(await validateMobileAccess(signAccessToken("user", "session", 2))).toBeNull();
  });
  it("denies legacy unbound tokens and old user revocation versions", async () => {
    expect(await validateMobileAccess(signAccessToken("user"))).toBeNull();
    db.mobileSession.findFirst.mockResolvedValue({ user: { sessionVersion: 3 } });
    expect(await validateMobileAccess(signAccessToken("user", "session", 2))).toBeNull();
  });
  it("allows only a matching active mobile session", async () => {
    db.mobileSession.findFirst.mockResolvedValue({ user: { sessionVersion: 2 } });
    expect(await validateMobileAccess(signAccessToken("user", "session", 2))).toEqual({ userId: "user" });
    expect(db.mobileSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "session", userId: "user", revokedAt: null, sessionVersion: 2 }) }));
  });
});
