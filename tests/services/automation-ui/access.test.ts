import { beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { notification: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() }, notificationPreference: { findMany: vi.fn(), upsert: vi.fn() }, orgMember: { findUnique: vi.fn() }, auditLog: { create: vi.fn() }, $transaction: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/services/notifications/policy", () => ({ notificationMetadata: () => ({ title: "Account update", body: "A saved account event", href: "/settings" }) }));
import { listPrivateNotifications, markPrivateNotification, setNotificationPreference } from "@/services/notification-access";
describe("private notification access", () => {
  beforeEach(() => { vi.resetAllMocks(); db.orgMember.findUnique.mockResolvedValue({ role: "member" }); db.notification.findMany.mockResolvedValue([]); db.notification.count.mockResolvedValue(0); db.notification.updateMany.mockResolvedValue({ count: 1 }); db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db)); });
  it("scopes reads to the current identity and current tenant or user-only events", async () => {
    await listPrivateNotifications("org-a", "user-a");
    expect(db.notification.findMany.mock.calls[0][0].where).toMatchObject({ userId: "user-a", channel: "IN_APP", OR: [{ orgId: "org-a" }, { orgId: null }] });
  });
  it("excludes provider payloads and delivery logs from the public projection", async () => {
    db.notification.findMany.mockResolvedValue([{ id: "notice", type: "identity.password_changed", category: "SECURITY", dataJson: {}, createdAt: new Date(), readAt: null, secretPayloadEnc: "secret", recipientEmail: "private@example.test", attempts: [] }]);
    expect(JSON.stringify(await listPrivateNotifications("org-a", "user-a"))).not.toMatch(/secret|private@example|attempts/);
  });
  it("cannot mark another person's or another tenant's notice", async () => {
    await markPrivateNotification("org-a", "user-a", "notice");
    expect(db.notification.updateMany.mock.calls[0][0].where).toMatchObject({ id: "notice", userId: "user-a", channel: "IN_APP", OR: [{ orgId: "org-a" }, { orgId: null }] });
    db.notification.updateMany.mockResolvedValue({ count: 0 });
    await expect(markPrivateNotification("org-a", "user-a", "foreign")).rejects.toThrow("not found");
  });
  it("does not let optional preferences disable necessary security or billing", async () => {
    await expect(setNotificationPreference("user-a", { channel: "EMAIL", category: "SECURITY", enabled: false, timezone: "Europe/London", digestFrequency: "weekly" })).rejects.toThrow("required");
    expect(db.notificationPreference.upsert).not.toHaveBeenCalled();
  });
  it("rejects account reads after current membership has been removed", async () => {
    db.orgMember.findUnique.mockResolvedValue(null);
    await expect(listPrivateNotifications("org-a", "removed")).rejects.toThrow();
    expect(db.notification.findMany).not.toHaveBeenCalled();
  });
});
