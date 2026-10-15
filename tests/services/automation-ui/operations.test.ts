import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, emitEvent, publish } = vi.hoisted(() => ({ db: { orgMember: { findUnique: vi.fn(), findMany: vi.fn() }, entitlement: { findUnique: vi.fn() }, device: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() }, scheduledPost: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, $transaction: vi.fn() }, emitEvent: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/device", () => ({ normalizeFingerprint: (value: string) => value }));
vi.mock("@/services/automation/events", () => ({ emitEvent }));
vi.mock("@/services/platforms/publish", () => ({ publishToPlatform: publish }));
import { rebindDevice } from "@/services/devices";
import { processDuePosts } from "@/services/publishing";
describe("transactional operational notices", () => {
  beforeEach(() => { vi.resetAllMocks(); db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db)); db.orgMember.findUnique.mockResolvedValue({ role: "owner" }); db.orgMember.findMany.mockResolvedValue([{ userId: "owner" }]); db.entitlement.findUnique.mockResolvedValue({ active: true, userFacingState: "active", accessUntil: null }); });
  it("records a successful device replacement with its domain mutation", async () => {
    db.device.findFirst.mockResolvedValueOnce({ id: "old" }).mockResolvedValueOnce(null); db.device.create.mockResolvedValue({ id: "new" });
    await rebindDevice("org", "old-fingerprint", "new-fingerprint", { label: "Browser" }, "owner");
    expect(emitEvent).toHaveBeenCalledWith(db, expect.objectContaining({ eventType: "device.rebound", userId: "owner", orgId: "org" }));
  });
  it("records an actionable publish failure without private provider text", async () => {
    db.scheduledPost.findMany.mockResolvedValue([{ id: "post", orgId: "org", retryCount: 0, platform: "linkedin", campaign: { caption: "private content" } }]); db.scheduledPost.updateMany.mockResolvedValue({ count: 1 }); db.scheduledPost.update.mockResolvedValue({ id: "post", orgId: "org", retryCount: 1 }); publish.mockResolvedValue({ success: false, error: "secret provider response" });
    await processDuePosts();
    expect(emitEvent).toHaveBeenCalledWith(db, expect.objectContaining({ eventType: "publishing.failed", userId: "owner", orgId: "org" }));
    expect(JSON.stringify(emitEvent.mock.calls)).not.toContain("secret provider response"); expect(JSON.stringify(emitEvent.mock.calls)).not.toContain("private content");
  });
  it("does not publish a post already claimed by a competing worker", async () => {
    db.scheduledPost.findMany.mockResolvedValue([{ id: "post", orgId: "org", retryCount: 0, platform: "linkedin" }]); db.scheduledPost.updateMany.mockResolvedValue({ count: 0 });
    await processDuePosts(); expect(publish).not.toHaveBeenCalled();
  });
});
