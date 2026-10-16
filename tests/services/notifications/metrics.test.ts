// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { outboxEvent: { findFirst: vi.fn(), count: vi.fn(), groupBy: vi.fn() }, notification: { groupBy: vi.fn(), findMany: vi.fn() }, notificationAttempt: { groupBy: vi.fn() }, providerWebhookEvent: { count: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ db }));
import { aggregateDeliveryMetrics } from "@/services/notifications";

describe("metadata-only delivery metrics", () => {
  beforeEach(() => { vi.resetAllMocks(); db.outboxEvent.findFirst.mockResolvedValue({ createdAt: new Date("2026-01-01T00:00:00Z") }); db.outboxEvent.count.mockResolvedValue(2); db.outboxEvent.groupBy.mockResolvedValue([]); db.notification.groupBy.mockResolvedValue([{ status: "delivered", channel: "EMAIL", _count: { _all: 2 } }, { status: "bounced", channel: "EMAIL", _count: { _all: 1 } }]); db.notification.findMany.mockResolvedValue([{ createdAt: new Date("2026-01-01T00:00:00Z"), sentAt: new Date("2026-01-01T00:00:02Z") }]); db.notificationAttempt.groupBy.mockResolvedValue([]); db.providerWebhookEvent.count.mockResolvedValue(1); });
  it("reports observed delivery separately from acceptance and never loads message content", async () => {
    const metrics = await aggregateDeliveryMetrics(new Date("2026-01-01T00:01:00Z"));
    expect(metrics.oldestPendingOutboxAgeSeconds).toBe(60);
    expect(metrics.meanEnqueueToAcceptanceMs).toBe(2000);
    expect(metrics.emailDeliveredCount).toBe(2);
    expect(metrics.emailBounceCount).toBe(1);
    expect(db.notification.findMany.mock.calls[0][0].select).toEqual({ createdAt: true, sentAt: true });
    expect(JSON.stringify(metrics)).not.toMatch(/secretPayload|recipientEmail|providerPayload/);
    expect(metrics.unavailable).toContain("stripe_reconciliation_drift");
  });
});
