import type { Prisma } from "@prisma/client";
import { emitEvent } from "@/services/automation/events";

export async function emitWorkspaceOperation(tx: Prisma.TransactionClient, orgId: string, eventType: string, aggregateId: string, dedupeKey: string, payload: Prisma.InputJsonValue) {
  const owners = await tx.orgMember.findMany({ where: { orgId, role: "owner" }, select: { userId: true } });
  for (const owner of owners) await emitEvent(tx, { userId: owner.userId, orgId, aggregateType: "workspace_operation", aggregateId, eventType, dedupeKey: `${dedupeKey}:${owner.userId}`, payload });
}
