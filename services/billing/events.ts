import type { Prisma } from "@prisma/client";
import { emitEvent } from "@/services/automation/events";
/** Owners are selected from current membership, never from checkout metadata or event email. */
export async function emitBillingEvent(tx: Prisma.TransactionClient, orgId: string, subscriptionId: string, eventType: string, semanticKey: string, payload: Prisma.InputJsonObject) {
  const owners = await tx.orgMember.findMany({ where: { orgId, role: "owner" }, select: { userId: true } });
  for (const owner of owners) await emitEvent(tx, { eventType, dedupeKey: `${semanticKey}:${owner.userId}`, userId: owner.userId, orgId, aggregateType: "subscription", aggregateId: subscriptionId, payload });
}
