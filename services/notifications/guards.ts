import type { Prisma } from "@prisma/client";
import { getEventDefinition } from "./policy";

export async function eventStillEligible(tx: Prisma.TransactionClient, event: { eventType: string; userId: string; orgId: string | null; aggregateId: string; payloadJson: unknown }, now: Date): Promise<boolean> {
  if (event.eventType === "account.export_ready") {
    if (!event.orgId) return false;
    const job = await tx.dataExportJob.findFirst({ where: { id: event.aggregateId, userId: event.userId, orgId: event.orgId, status: "ready", expiresAt: { gt: now }, user: { emailVerified: { not: null } }, org: { members: { some: { userId: event.userId } } } }, select: { id: true } });
    return !!job;
  }
  if (event.eventType === "billing.dispute") {
    const staff = await tx.supportStaff.findUnique({ where: { userId: event.userId }, select: { active: true, role: true } });
    return !!staff?.active && staff.role === "support_admin";
  }
  if (!event.orgId) return !event.eventType.startsWith("billing.");
  const member = await tx.orgMember.findUnique({ where: { orgId_userId: { orgId: event.orgId, userId: event.userId } }, select: { role: true } });
  if (!member) return false;
  if ((event.eventType.startsWith("billing.") || getEventDefinition(event.eventType).category === "OPERATIONAL") && member.role !== "owner") return false;
  const data = event.payloadJson as Record<string, unknown>;
  if (["billing.payment_failed", "billing.authentication_required"].includes(event.eventType)) {
    if (typeof data.invoiceId !== "string") return false;
    const payment = await tx.payment.findFirst({ where: { orgId: event.orgId, stripeInvoiceId: data.invoiceId }, select: { status: true } });
    return payment?.status === (event.eventType === "billing.payment_failed" ? "failed" : "authentication_required");
  }
  const refundState: Record<string, string> = { "billing.refund_pending": "refund_pending", "billing.refunded": "refunded", "billing.refund_failed": "refund_failed" };
  if (refundState[event.eventType]) {
    if (typeof data.refundReference !== "string") return false;
    const refund = await tx.refund.findFirst({ where: { id: data.refundReference, payment: { orgId: event.orgId } }, select: { status: true } });
    return refund?.status === refundState[event.eventType];
  }
  if (event.eventType !== "billing.introductory_ending") return true;
  const subscription = await tx.subscription.findUnique({ where: { orgId: event.orgId } });
  return !!subscription?.introductoryPaidAt && subscription.stripeSubscriptionId === event.aggregateId && subscription.status === "trialing" && !subscription.cancelAtPeriodEnd && !subscription.firstRecurringInvoiceId && !!subscription.trialEndAt && subscription.trialEndAt.toISOString() === data.periodEnd && subscription.trialEndAt > now && subscription.trialEndAt.getTime() - now.getTime() <= 3 * 86400_000;
}
