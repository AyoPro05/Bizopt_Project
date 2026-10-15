import { beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { orgMember: { findUnique: vi.fn() }, entitlement: { findUnique: vi.fn() }, device: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() }, $transaction: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/device", () => ({ normalizeFingerprint: (value: string) => `hash-${value}` }));
import { bindDevice } from "@/services/devices";
describe("one device per person", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
    db.orgMember.findUnique.mockResolvedValue({ role: "member" });
    db.entitlement.findUnique.mockResolvedValue({ active: true, userFacingState: "active", accessUntil: null, deviceLimit: 1 });
    db.device.count.mockResolvedValue(0);
    db.device.findFirst.mockResolvedValue(null);
    db.device.create.mockImplementation(async ({ data }) => ({ id: "device", ...data }));
  });
  it("binds devices to the signed-in person rather than the whole subscription", async () => {
    const result = await bindDevice("org", "fingerprint", {}, "person-b");
    expect(result.ok).toBe(true);
    expect(db.device.count).toHaveBeenCalledWith({ where: { orgId: "org", userId: "person-b", revokedAt: null } });
    expect(db.device.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ orgId: "org", userId: "person-b" }) }));
  });
  it("blocks a person's second active device", async () => {
    db.device.count.mockResolvedValue(1);
    expect(await bindDevice("org", "new-fingerprint", {}, "person")).toMatchObject({ ok: false, error: "device_limit_reached" });
    expect(db.device.create).not.toHaveBeenCalled();
  });
  it("denies people no longer in the workspace", async () => {
    db.orgMember.findUnique.mockResolvedValue(null);
    expect(await bindDevice("org", "fingerprint", {}, "removed")).toMatchObject({ ok: false });
  });
});
