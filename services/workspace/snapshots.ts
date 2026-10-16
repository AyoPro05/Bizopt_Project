import { db } from "@/lib/db";
import { AppError } from "@/services/platform/errors";
import { serializeWorkspaceSessionState, workspaceSessionWhere, type WorkspaceScope } from "@/services/workspace/session";

export async function saveWorkspaceSnapshot(sessionId: string, scope: WorkspaceScope, reason = "user_saved") {
  return db.$transaction(async tx => {
    const session = await tx.workspaceSession.findFirst({ where: workspaceSessionWhere(sessionId, scope) });
    if (!session) throw new AppError("Session not found.", 404);
    return tx.workspaceSnapshot.create({
      data: {
        workspaceSessionId: sessionId,
        stage: session.stage,
        snapshotData: serializeWorkspaceSessionState(session),
        reason,
      },
    });
  });
}

export async function getSnapshotHistory(sessionId: string, scope: WorkspaceScope, limit = 20) {
  return db.workspaceSnapshot.findMany({
    where: { workspaceSessionId: sessionId, session: workspaceSessionWhere(sessionId, scope) },
    orderBy: { takenAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
    select: {
      id: true,
      stage: true,
      reason: true,
      takenAt: true,
    },
  });
}

export async function getSnapshot(snapshotId: string, sessionId: string, scope: WorkspaceScope) {
  const snapshot = await db.workspaceSnapshot.findFirst({
    where: { id: snapshotId, workspaceSessionId: sessionId, session: workspaceSessionWhere(sessionId, scope) },
  });
  if (!snapshot) throw new AppError("Snapshot not found.", 404);
  return snapshot;
}
