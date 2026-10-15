// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, processEvent } = vi.hoisted(() => ({ db: { stripeEvent: { findFirst: vi.fn(), updateMany: vi.fn() } }, processEvent: vi.fn() }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/services/billing/webhook-handler", () => ({ processStripeEvent: processEvent }));
import { processStoredStripeEvent } from "@/services/billing/webhook-inbox";
describe("durable Stripe inbox", () => {
  beforeEach(() => { vi.resetAllMocks(); db.stripeEvent.findFirst.mockResolvedValue({ id: "row", eventId: "evt_fixture", payloadJson: { id: "evt_fixture" }, attempts: 0 }); db.stripeEvent.updateMany.mockResolvedValue({ count: 1 }); });
  it("claims durable pending and abandoned deliveries and fences completion to its lease", async () => {
    expect(await processStoredStripeEvent()).toBe(true);
    expect(db.stripeEvent.findFirst.mock.calls[0][0].where.OR).toEqual(expect.arrayContaining([expect.objectContaining({ processingStatus: "processing" })]));
    expect(processEvent).toHaveBeenCalledOnce();
    expect(db.stripeEvent.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ lockedAt: expect.any(Date), processingStatus: "processing" }), data: expect.objectContaining({ processingStatus: "processed" }) }));
  });
  it("does not process a delivery claimed by another worker", async () => { db.stripeEvent.updateMany.mockResolvedValue({ count: 0 }); expect(await processStoredStripeEvent()).toBe(false); expect(processEvent).not.toHaveBeenCalled(); });
  it("backs off failures without exposing provider errors", async () => {
    processEvent.mockRejectedValue(new Error("secret-provider-response"));
    await processStoredStripeEvent();
    const data = db.stripeEvent.updateMany.mock.lastCall?.[0].data;
    expect(data.processingStatus).toBe("failed"); expect(data.nextAttemptAt.getTime()).toBeGreaterThan(Date.now()); expect(data.errorMessage).not.toContain("secret");
  });
  it("terminates repeated failures for operator review", async () => { db.stripeEvent.findFirst.mockResolvedValue({ id: "row", attempts: 4, payloadJson: {} }); processEvent.mockRejectedValue(new Error("failure")); await processStoredStripeEvent(); expect(db.stripeEvent.updateMany.mock.lastCall?.[0].data.processingStatus).toBe("dead_letter"); });
});
