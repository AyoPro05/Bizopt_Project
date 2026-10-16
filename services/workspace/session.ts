import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/services/platform/errors";
import { workspaceCreateSchema, workspaceSnapshotSchema, workspaceStageSchema, workspaceUpdateSchema, type WorkspaceUpdate } from "./schemas";

export type { WorkspaceStage } from "./schemas";
export type WorkspaceScope = { orgId: string; userId: string };

export function workspaceSessionWhere(sessionId: string, scope: WorkspaceScope) {
  if (!scope?.orgId || !scope?.userId) throw new AppError("Session not found.", 404);
  return {
    id: sessionId, orgId: scope.orgId, userId: scope.userId,
    org: { members: { some: { userId: scope.userId, role: { in: ["owner", "admin", "member"] } } } },
  };
}

async function requireSession(tx: Prisma.TransactionClient, sessionId: string, scope: WorkspaceScope) {
  const session = await tx.workspaceSession.findFirst({ where: workspaceSessionWhere(sessionId, scope) });
  if (!session) throw new AppError("Session not found.", 404);
  return session;
}

async function validateReferences(tx: Prisma.TransactionClient, scope: WorkspaceScope, input: WorkspaceUpdate) {
  if (input.selectedVariantId && !await tx.contentVariant.count({ where: { id: input.selectedVariantId, orgId: scope.orgId } })) {
    throw new AppError("Content not found.", 404);
  }
  if (input.editingAssetIds?.length) {
    const ids = [...new Set(input.editingAssetIds)];
    if (await tx.asset.count({ where: { id: { in: ids }, orgId: scope.orgId } }) !== ids.length) {
      throw new AppError("Media not found.", 404);
    }
  }
}

function editorData(input: WorkspaceUpdate): Prisma.WorkspaceSessionUncheckedUpdateInput {
  const { carouselState, ...fields } = input;
  return {
    ...fields,
    ...(carouselState !== undefined ? { carouselState: carouselState === null ? Prisma.DbNull : carouselState as Prisma.InputJsonObject } : {}),
    lastInteractionAt: new Date(),
  };
}

export function serializeWorkspaceSessionState(session: Record<string, unknown>): Prisma.InputJsonValue {
  return {
    stage: session.stage, ideaPrompt: session.ideaPrompt, businessGoal: session.businessGoal,
    tone: session.tone, industry: session.industry, audience: session.audience,
    selectedPlatforms: session.selectedPlatforms, selectedVariantId: session.selectedVariantId,
    compareViewOpen: session.compareViewOpen, editingAssetIds: session.editingAssetIds,
    carouselState: session.carouselState, scheduleIntent: session.scheduleIntent,
    scheduledPlatforms: session.scheduledPlatforms,
  } as Prisma.InputJsonValue;
}

export async function createWorkspaceSession(orgId: string, userId: string, input: unknown) {
  const parsed = workspaceCreateSchema.parse(input);
  return db.$transaction(async tx => {
    const member = await tx.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
    if (!member || !["owner", "admin", "member"].includes(member.role)) throw new AppError("Permission denied.", 403);
    return tx.workspaceSession.create({ data: { ...parsed, orgId, userId, stage: "idea", tone: parsed.tone ?? "professional", selectedPlatforms: parsed.selectedPlatforms ?? [] } });
  });
}

export async function getWorkspaceSession(sessionId: string, scope: WorkspaceScope) {
  const session = await db.workspaceSession.findFirst({
    where: workspaceSessionWhere(sessionId, scope),
    include: {
      variants: { where: { orgId: scope.orgId }, select: { id: true, type: true, title: true, body: true, isSelected: true, createdAt: true } },
      selectedVariant: { where: { orgId: scope.orgId } },
      campaign: { where: { orgId: scope.orgId } },
      growthPrediction: { where: { orgId: scope.orgId }, select: { score: true, confidence: true, reason: true, recommendedAction: true, evidence: true } },
      complianceCheck: { where: { orgId: scope.orgId } },
      snapshots: { orderBy: { takenAt: "desc" }, take: 10 },
    },
  });
  if (!session) throw new AppError("Session not found.", 404);
  return session;
}

export async function transitionStage(sessionId: string, nextStage: unknown, updates: unknown, scope: WorkspaceScope) {
  const stage = workspaceStageSchema.parse(nextStage);
  const parsed = workspaceUpdateSchema.parse(updates ?? {});
  return db.$transaction(async tx => {
    const session = await requireSession(tx, sessionId, scope);
    await validateReferences(tx, scope, parsed);
    await tx.workspaceSnapshot.create({ data: { workspaceSessionId: session.id, stage: session.stage, snapshotData: serializeWorkspaceSessionState(session), reason: "stage_complete" } });
    return tx.workspaceSession.update({ where: workspaceSessionWhere(session.id, scope), data: { ...editorData(parsed), stage } });
  });
}

export async function updateWorkspaceSession(sessionId: string, updates: unknown, scope: WorkspaceScope, snapshot = false) {
  const parsed = workspaceUpdateSchema.parse(updates);
  return db.$transaction(async tx => {
    const session = await requireSession(tx, sessionId, scope);
    await validateReferences(tx, scope, parsed);
    if (snapshot) await tx.workspaceSnapshot.create({ data: { workspaceSessionId: session.id, stage: session.stage, snapshotData: serializeWorkspaceSessionState(session), reason: "auto_save" } });
    return tx.workspaceSession.update({ where: workspaceSessionWhere(session.id, scope), data: editorData(parsed) });
  });
}

export async function resumeFromSnapshot(sessionId: string, snapshotId: string, scope: WorkspaceScope) {
  return db.$transaction(async tx => {
    const session = await requireSession(tx, sessionId, scope);
    const snapshot = await tx.workspaceSnapshot.findFirst({ where: { id: snapshotId, workspaceSessionId: session.id } });
    if (!snapshot) throw new AppError("Snapshot not found.", 404);
    const { stage, ...updates } = workspaceSnapshotSchema.parse(snapshot.snapshotData);
    await validateReferences(tx, scope, updates);
    await tx.workspaceSnapshot.create({ data: { workspaceSessionId: session.id, stage: session.stage, snapshotData: serializeWorkspaceSessionState(session), reason: "before_restore" } });
    return tx.workspaceSession.update({ where: workspaceSessionWhere(session.id, scope), data: { ...editorData(updates), stage } });
  });
}

export async function listResumableSessions(orgId: string, userId: string) {
  return db.workspaceSession.findMany({
    where: { orgId, userId, org: { members: { some: { userId, role: { in: ["owner", "admin", "member"] } } } }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { lastInteractionAt: "desc" }, take: 5,
    select: { id: true, stage: true, ideaPrompt: true, createdAt: true, lastInteractionAt: true, selectedVariantId: true, campaignId: true },
  });
}

export async function deleteExpiredSessions() {
  return db.workspaceSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

export async function logWorkspaceAction(sessionId: string, orgId: string, userId: string, action: string, metadata?: Record<string, unknown>) {
  return db.$transaction(async tx => {
    const session = await requireSession(tx, sessionId, { orgId, userId });
    return tx.workspaceAuditLog.create({ data: { workspaceSessionId: session.id, orgId, userId, action, newStage: session.stage, metadata: metadata as Prisma.InputJsonValue | undefined } });
  });
}
