import { db } from "@/lib/db";
import { serializeWorkspaceSessionState } from "@/services/workspace/session";

export async function saveWorkspaceSnapshot(sessionId: string, reason = "user_saved") {
  const session = await db.workspaceSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  return db.workspaceSnapshot.create({
    data: {
      workspaceSessionId: sessionId,
      stage: session.stage,
      snapshotData: serializeWorkspaceSessionState(session as Record<string, unknown>),
      reason,
    },
  });
}

export async function getSnapshotHistory(sessionId: string, limit = 20) {
  return db.workspaceSnapshot.findMany({
    where: { workspaceSessionId: sessionId },
    orderBy: { takenAt: "desc" },
    take: limit,
    select: {
      id: true,
      stage: true,
      reason: true,
      takenAt: true,
    },
  });
}

export async function getSnapshot(snapshotId: string) {
  return db.workspaceSnapshot.findUniqueOrThrow({
    where: { id: snapshotId },
  });
}
