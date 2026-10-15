import { db } from "@/lib/db";
import { invitationDeliveryReadiness, invitationToken, canGrantRole } from "./policy";

export async function processInviteDelivery(): Promise<boolean> {
  if (invitationDeliveryReadiness()) return false;
  const now = new Date();
  const due = { status: "pending", expiresAt: { gt: now }, OR: [ { deliveryStatus: "queued", nextAttemptAt: { lte: now } }, { deliveryStatus: "sending", lockedAt: { lt: new Date(Date.now() - 60_000) } } ] };
  const job = await db.workspaceInvite.findFirst({ where: due, orderBy: { createdAt: "asc" } });
  if (!job) return false;
  const claim = await db.workspaceInvite.updateMany({ where: { id: job.id, orgId: job.orgId, generation: job.generation, ...due }, data: { deliveryStatus: "sending", attempts: { increment: 1 }, lockedAt: now, error: null } });
  if (!claim.count) return false;
  const lease = { id: job.id, orgId: job.orgId, generation: job.generation, status: "pending", deliveryStatus: "sending", lockedAt: now };
  try {
    const [actor, org, ent] = await Promise.all([
      db.orgMember.findUnique({ where: { orgId_userId: { orgId: job.orgId, userId: job.createdBy } } }),
      db.organization.findUnique({ where: { id: job.orgId }, select: { name: true } }),
      db.entitlement.findUnique({ where: { orgId: job.orgId } }),
    ]);
    if (!actor || !org || !canGrantRole(actor.role, job.role) || !ent || !["active", "trialing", "grace_period"].includes(ent.userFacingState) || (ent.accessUntil && ent.accessUntil <= new Date())) {
      await db.workspaceInvite.updateMany({ where: lease, data: { deliveryStatus: "failed", lockedAt: null, error: "Invitation authorisation or subscription access changed. Review and resend when access is restored." } });
      return true;
    }
    if (job.attempts >= 3) throw new Error("Retry limit");
    const origin = new URL(process.env.INVITE_APP_ORIGIN || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
    if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") throw new Error("HTTPS invitation origin required");
    const link = new URL("/invite", origin);
    link.hash = new URLSearchParams({ id: job.id, token: invitationToken(job.id, job.generation) }).toString();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `invite-${job.id}-${job.generation}` },
      body: JSON.stringify({ from: process.env.INVITE_FROM_EMAIL, to: [job.email], subject: `Invitation to ${org.name}`, text: `You have been invited to ${org.name} as a ${job.role}.\n\nSign in with the matching verified email address to accept:\n${link.href}\n\nThis invitation expires on ${job.expiresAt.toISOString()}. It reserves one included workspace seat and does not authorise a payment. If you did not expect it, you may ignore it.` }),
    });
    if (!response.ok) throw new Error("Delivery not confirmed");
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("id" in result) || typeof result.id !== "string") throw new Error("Delivery not confirmed");
    await db.workspaceInvite.updateMany({ where: lease, data: { deliveryStatus: "sent", providerMessageId: result.id, lockedAt: null, error: null } });
    await db.auditLog.create({ data: { orgId: job.orgId, userId: job.createdBy, action: "workspace.invitation_delivery_confirmed", entity: "WorkspaceInvite", entityId: job.id } });
  } catch {
    const failed = job.attempts + 1 >= 3;
    await db.workspaceInvite.updateMany({ where: lease, data: { deliveryStatus: failed ? "failed" : "queued", lockedAt: null, nextAttemptAt: new Date(Date.now() + 30_000 * 2 ** job.attempts + Math.floor(Math.random() * 5000)), error: "Email delivery could not be confirmed. The seat remains reserved until acceptance, expiry or revocation." } });
  }
  return true;
}
