import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({ db: {
  supportTicket: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  supportMessage: { create: vi.fn() }, supportStaff: { findUnique: vi.fn() },
  auditLog: { create: vi.fn(), count: vi.fn() }, $transaction: vi.fn(),
} }));
vi.mock("@/lib/db", () => ({ db }));
import { createTicket, getUserTicket, replyToTicket, staffTicket, staffUpdateTicket, listStaffTickets } from "@/services/support/tickets";

describe("durable support conversations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
    db.supportTicket.updateMany.mockResolvedValue({ count: 1 });
    db.supportTicket.count.mockResolvedValue(0);
    db.auditLog.count.mockResolvedValue(0);
  });
  it("filters customer tickets by both user and current tenant and never queries internal notes", async () => {
    db.supportTicket.findFirst.mockResolvedValue(null);
    await expect(getUserTicket("tenant-a", "user-a", "ticket-b")).rejects.toThrow("not found");
    expect(db.supportTicket.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "ticket-b", orgId: "tenant-a", userId: "user-a" }, select: expect.objectContaining({ messages: expect.objectContaining({ where: { internal: false } }) }) }));
  });
  it("creates an intake with no diagnostics when consent is disabled", async () => {
    db.supportTicket.findFirst.mockResolvedValue(null);
    db.supportTicket.create.mockResolvedValue({ id: "request" });
    await createTicket("org", "user", { requestId: "00000000-0000-4000-8000-000000000001", category: "technical", subject: "Page failed", description: "My SEO page did not load", severity: "normal", workflow: "SEO", diagnosticsConsent: false, diagnostics: { token: "private" } });
    expect(db.supportTicket.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "user", orgId: "org", diagnosticsConsent: false }), select: expect.any(Object) }));
    expect(db.supportTicket.create.mock.calls[0][0].data.diagnostics).toBeUndefined();
  });
  it("returns public message authors as roles without exposing staff identifiers", async () => {
    db.supportTicket.findFirst.mockResolvedValue({ id: "t", messages: [{ id: "m", body: "We are investigating", authorId: "private-staff-id", createdAt: new Date() }] });
    const ticket = await getUserTicket("org", "user", "t");
    expect(ticket.messages[0]).toEqual(expect.objectContaining({ fromSupport: true, body: "We are investigating" }));
    expect(ticket.messages[0]).not.toHaveProperty("authorId");
  });
  it("throttles repeated replies durably before writing another message", async () => {
    db.supportTicket.findFirst.mockResolvedValue({ id: "t", status: "triaged", version: 2 });
    db.auditLog.count.mockResolvedValue(30);
    await expect(replyToTicket("org", "user", "t", { expectedVersion: 2, body: "Repeated reply" })).rejects.toThrow("replies");
    expect(db.supportMessage.create).not.toHaveBeenCalled();
  });
  it("reuses a retried request instead of creating another ticket", async () => {
    db.supportTicket.findFirst.mockResolvedValue({ id: "existing" });
    const result = await createTicket("org", "user", { requestId: "00000000-0000-4000-8000-000000000001", category: "technical", subject: "Page failed", description: "My SEO page did not load", severity: "normal", workflow: "SEO" });
    expect(result.id).toBe("existing");
    expect(db.supportTicket.create).not.toHaveBeenCalled();
  });
  it("rejects stale replies without adding a message", async () => {
    db.supportTicket.findFirst.mockResolvedValue({ id: "t", status: "triaged", version: 3 });
    await expect(replyToTicket("org", "user", "t", { expectedVersion: 2, body: "More details" })).rejects.toThrow("changed");
    expect(db.supportMessage.create).not.toHaveBeenCalled();
  });
  it("checks the optimistic lock before a reply is written", async () => {
    db.supportTicket.findFirst.mockResolvedValue({ id: "t", status: "waiting_for_user", version: 2 });
    db.supportTicket.updateMany.mockResolvedValue({ count: 0 });
    await expect(replyToTicket("org", "user", "t", { expectedVersion: 2, body: "More details" })).rejects.toThrow("changed");
    expect(db.supportMessage.create).not.toHaveBeenCalled();
  });
  it("reopens a resolved ticket and records a public reply with tenant-scoped FK", async () => {
    db.supportTicket.findFirst.mockResolvedValue({ id: "t", status: "resolved", version: 2 });
    await replyToTicket("org", "user", "t", { expectedVersion: 2, body: "The problem remains", reopen: true });
    expect(db.supportTicket.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "t", orgId: "org", userId: "user", version: 2 }, data: expect.objectContaining({ status: "triaged", version: { increment: 1 } }) }));
    expect(db.supportMessage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ ticketId: "t", orgId: "org", authorId: "user", internal: false }) });
  });
  it("scopes an agent queue to assigned/unassigned non-security metadata", async () => {
    db.supportTicket.findMany.mockResolvedValue([]);
    await listStaffTickets({ userId: "agent", role: "support_agent" }, "");
    expect(db.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isSecurity: false, OR: [{ assigneeId: null }, { assigneeId: "agent" }] }), select: expect.not.objectContaining({ description: true }) }));
    expect(db.auditLog.create).toHaveBeenCalled();
  });
  it("does not reveal another agent's assigned private content", async () => {
    db.supportTicket.findFirst.mockResolvedValue(null);
    await expect(staffTicket({ userId: "agent", role: "support_agent" }, "other")).rejects.toThrow("not found");
    expect(db.supportTicket.findFirst.mock.calls[0][0].where).toEqual(expect.objectContaining({ id: "other", isSecurity: false, OR: [{ assigneeId: null }, { assigneeId: "agent" }] }));
  });
  it("persists an access audit before fetching a private ticket body", async () => {
    db.supportTicket.findFirst.mockResolvedValueOnce({ id: "t", orgId: "org" }).mockResolvedValueOnce({ id: "t", description: "Private" });
    await staffTicket({ userId: "admin", role: "support_admin" }, "t");
    expect(db.auditLog.create.mock.invocationCallOrder[0]).toBeLessThan(db.supportTicket.findFirst.mock.invocationCallOrder[1]);
    expect(db.supportTicket.findFirst.mock.calls[0][0].select).not.toHaveProperty("description");
  });
  it("does not assign private security reports to a normal support agent", async () => {
    db.supportTicket.findFirst.mockResolvedValue({ id: "t", orgId: "org", status: "received", version: 1, isSecurity: true });
    db.supportStaff.findUnique.mockResolvedValue({ active: true, role: "support_agent" });
    await expect(staffUpdateTicket({ userId: "admin", role: "support_admin" }, "t", { expectedVersion: 1, assigneeId: "agent" })).rejects.toThrow("security");
    expect(db.supportTicket.updateMany).not.toHaveBeenCalled();
  });
  it("rejects arbitrary assignment and invalid status transitions", async () => {
    db.supportTicket.findFirst.mockResolvedValue({ id: "t", orgId: "org", status: "received", version: 1 });
    await expect(staffUpdateTicket({ userId: "agent", role: "support_agent" }, "t", { expectedVersion: 1, assigneeId: "other" })).rejects.toThrow("assign");
    await expect(staffUpdateTicket({ userId: "agent", role: "support_agent" }, "t", { expectedVersion: 1, status: "closed" })).rejects.toThrow("status");
    expect(db.supportTicket.updateMany).not.toHaveBeenCalled();
  });
});
