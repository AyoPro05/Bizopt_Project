import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { SupportError } from "./errors";
import { replyInput, sanitiseDiagnostics, staffUpdateInput, ticketInput } from "./schemas";

export type SupportIdentity = { userId: string; role: "support_agent" | "support_admin" };
const summarySelect = { id: true, category: true, subject: true, severity: true, workflow: true, status: true, version: true, createdAt: true, updatedAt: true, notifyByEmail: true, isSecurity: true } satisfies Prisma.SupportTicketSelect;
const userSelect = { ...summarySelect, description: true, reproducibility: true, diagnostics: true, diagnosticsConsent: true, messages: { where: { internal: false }, orderBy: { createdAt: "asc" as const }, select: { id: true, body: true, createdAt: true, authorId: true } } } satisfies Prisma.SupportTicketSelect;
const staffScope = (staff: SupportIdentity): Prisma.SupportTicketWhereInput => staff.role === "support_admin" ? {} : { isSecurity: false, OR: [{ assigneeId: null }, { assigneeId: staff.userId }] };
const changed = () => new SupportError("This conversation changed. Refresh it before sending again; your draft is still here.", 409);
const audit = (tx: Prisma.TransactionClient, orgId: string | undefined, userId: string, action: string, entityId?: string, metadata: Prisma.InputJsonValue = {}) => tx.auditLog.create({ data: { orgId, userId, action, entity: "SupportTicket", entityId, metadata } });

export async function listUserTickets(orgId: string, userId: string, search = "", status?: string) {
  return db.supportTicket.findMany({ where: { orgId, userId, ...(status ? { status } : {}), ...(search ? { OR: [{ subject: { contains: search.slice(0, 100), mode: "insensitive" } }, { id: { equals: search } }] } : {}) }, select: summarySelect, orderBy: { updatedAt: "desc" }, take: 100 });
}
export async function getUserTicket(orgId: string, userId: string, id: string) {
  const ticket = await db.supportTicket.findFirst({ where: { id, orgId, userId }, select: userSelect });
  if (!ticket) throw new SupportError("Conversation not found.", 404);
  return { ...ticket, messages: ticket.messages.map(({ authorId, ...message }) => ({ ...message, fromSupport: authorId !== userId })) };
}
export async function createTicket(orgId: string, userId: string, input: unknown) {
  const value = ticketInput.parse(input);
  const create = () => db.$transaction(async (tx) => {
    const existing = await tx.supportTicket.findFirst({ where: { id: value.requestId, orgId, userId }, select: summarySelect });
    if (existing) return existing;
    if (await tx.supportTicket.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } } }) >= 10) throw new SupportError("You have sent several reports recently. Reply to an existing conversation or try again later.", 429);
    const diagnostics = sanitiseDiagnostics(value.diagnostics, value.diagnosticsConsent);
    const { requestId, diagnostics: _untrustedDiagnostics, ...fields } = value;
    void _untrustedDiagnostics;
    const ticket = await tx.supportTicket.create({ data: { ...fields, id: requestId, orgId, userId, isSecurity: value.category === "security", diagnostics: diagnostics ?? undefined }, select: summarySelect });
    await audit(tx, orgId, userId, "support.received", ticket.id, { category: value.category, diagnosticsConsent: value.diagnosticsConsent });
    return ticket;
  }, { isolationLevel: "Serializable" });
  try { return await create(); } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.supportTicket.findFirst({ where: { id: value.requestId, orgId, userId }, select: summarySelect });
      if (existing) return existing;
    }
    throw error;
  }
}
export async function replyToTicket(orgId: string, userId: string, id: string, input: unknown) {
  const value = replyInput.parse(input);
  return db.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findFirst({ where: { id, orgId, userId }, select: { id: true, status: true, version: true } });
    if (!ticket) throw new SupportError("Conversation not found.", 404);
    if (ticket.version !== value.expectedVersion) throw changed();
    const recentReplies = await tx.auditLog.count({ where: { userId, action: { in: ["support.customer_reply", "support.reopened"] }, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } } });
    if (recentReplies >= 30) throw new SupportError("You have sent many replies recently. Please wait before adding more.", 429);
    const ended = ["resolved", "closed"].includes(ticket.status);
    if (ended && !value.reopen) throw new SupportError("Reopen this conversation to send a reply.", 409);
    const status = ended || ticket.status === "waiting_for_user" ? "triaged" : ticket.status;
    const result = await tx.supportTicket.updateMany({ where: { id, orgId, userId, version: value.expectedVersion }, data: { status, version: { increment: 1 } } });
    if (!result.count) throw changed();
    await tx.supportMessage.create({ data: { orgId, ticketId: id, authorId: userId, body: value.body, internal: false } });
    await audit(tx, orgId, userId, ended ? "support.reopened" : "support.customer_reply", id, { previousStatus: ticket.status, status });
    return { id, version: value.expectedVersion + 1, status };
  }, { isolationLevel: "Serializable" });
}
export async function listStaffTickets(staff: SupportIdentity, search = "", status?: string) {
  await audit(db, undefined, staff.userId, "support.queue_view");
  return db.supportTicket.findMany({ where: { ...staffScope(staff), ...(status ? { status } : {}), ...(search ? { subject: { contains: search.slice(0, 100), mode: "insensitive" } } : {}) }, select: { ...summarySelect, orgId: true, assigneeId: true }, orderBy: { updatedAt: "desc" }, take: 100 });
}
export async function staffTicket(staff: SupportIdentity, id: string) {
  // Deliberately perform metadata authorization and durable audit before loading the private body.
  const scope = { id, ...staffScope(staff) };
  const metadata = await db.supportTicket.findFirst({ where: scope, select: { id: true, orgId: true } });
  if (!metadata) throw new SupportError("Conversation not found.", 404);
  await audit(db, metadata.orgId, staff.userId, "support.ticket_view", id);
  const ticket = await db.supportTicket.findFirst({ where: scope, select: { ...summarySelect, orgId: true, userId: true, assigneeId: true, description: true, reproducibility: true, diagnosticsConsent: true, diagnostics: true, messages: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, internal: true, authorId: true, createdAt: true } } } });
  if (!ticket) throw new SupportError("Conversation not found.", 404);
  return ticket;
}
const transitions: Record<string, readonly string[]> = {
  received: ["triaged"], triaged: ["investigating", "waiting_for_user", "resolved"], investigating: ["triaged", "waiting_for_user", "resolved"], waiting_for_user: ["triaged", "investigating", "resolved"], resolved: ["triaged", "closed"], closed: ["triaged"],
};
export async function staffUpdateTicket(staff: SupportIdentity, id: string, input: unknown) {
  const value = staffUpdateInput.parse(input);
  return db.$transaction(async (tx) => {
    const scope = { id, ...staffScope(staff) };
    const ticket = await tx.supportTicket.findFirst({ where: scope, select: { id: true, orgId: true, version: true, status: true, isSecurity: true } });
    if (!ticket) throw new SupportError("Conversation not found.", 404);
    if (ticket.version !== value.expectedVersion) throw changed();
    if (value.assigneeId !== undefined && value.assigneeId !== null) {
      if (staff.role !== "support_admin" && value.assigneeId !== staff.userId) throw new SupportError("You may only assign a conversation to yourself.", 403);
      const assigned = await tx.supportStaff.findUnique({ where: { userId: value.assigneeId }, select: { active: true, role: true } });
      if (!assigned?.active || !["support_agent", "support_admin"].includes(assigned.role)) throw new SupportError("Choose an active support staff assignee.");
      if (ticket.isSecurity && assigned.role !== "support_admin") throw new SupportError("Private security reports require a support administrator assignee.", 403);
    }
    if (value.status && value.status !== ticket.status && !transitions[ticket.status]?.includes(value.status)) throw new SupportError("That status transition is not available. Triage or reopen the conversation first.", 409);
    const result = await tx.supportTicket.updateMany({ where: { ...scope, version: value.expectedVersion }, data: { ...(value.status ? { status: value.status } : {}), ...(value.assigneeId !== undefined ? { assigneeId: value.assigneeId } : {}), version: { increment: 1 } } });
    if (!result.count) throw changed();
    if (value.body) await tx.supportMessage.create({ data: { orgId: ticket.orgId, ticketId: id, authorId: staff.userId, body: value.body, internal: value.internal } });
    await audit(tx, ticket.orgId, staff.userId, value.body ? (value.internal ? "support.internal_note" : "support.staff_reply") : "support.triage", id, { previousStatus: ticket.status, status: value.status ?? ticket.status, ...(value.assigneeId !== undefined ? { assigneeId: value.assigneeId } : {}), version: value.expectedVersion + 1 });
    return { id, version: value.expectedVersion + 1 };
  });
}
