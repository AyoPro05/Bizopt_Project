import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type WorkspaceStage =
  | "idea"
  | "generate"
  | "compare"
  | "edit"
  | "schedule"
  | "publish"
  | "measure";

export function serializeWorkspaceSessionState(session: Record<string, unknown>): Prisma.InputJsonValue {
  return {
    stage: session.stage,
    ideaPrompt: session.ideaPrompt,
    businessGoal: session.businessGoal,
    tone: session.tone,
    industry: session.industry,
    audience: session.audience,
    selectedPlatforms: session.selectedPlatforms,
    selectedVariantId: session.selectedVariantId,
    carouselState: session.carouselState,
    scheduleIntent: session.scheduleIntent,
    scheduledPlatforms: session.scheduledPlatforms,
  } as Prisma.InputJsonValue;
}

export async function createWorkspaceSession(
  orgId: string,
  userId: string,
  input: {
    ideaPrompt: string;
    businessGoal?: string;
    tone?: string;
    industry?: string;
    audience?: string;
    selectedPlatforms?: string[];
  }
) {
  return db.workspaceSession.create({
    data: {
      orgId,
      userId,
      stage: "idea",
      ideaPrompt: input.ideaPrompt,
      businessGoal: input.businessGoal,
      tone: input.tone ?? "professional",
      industry: input.industry,
      audience: input.audience,
      selectedPlatforms: input.selectedPlatforms ?? [],
    },
  });
}

export async function getWorkspaceSession(sessionId: string) {
  return db.workspaceSession.findUnique({
    where: { id: sessionId },
    include: {
      variants: {
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          isSelected: true,
          createdAt: true,
        },
      },
      selectedVariant: true,
      campaign: true,
      growthPrediction: {
        select: {
          score: true,
          confidence: true,
          reason: true,
          recommendedAction: true,
          evidence: true,
        },
      },
      complianceCheck: true,
      snapshots: {
        orderBy: { takenAt: "desc" },
        take: 10,
      },
    },
  });
}

export async function transitionStage(
  sessionId: string,
  nextStage: WorkspaceStage,
  updates?: Partial<Prisma.WorkspaceSessionUpdateInput>
) {
  const session = await db.workspaceSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  await db.workspaceSnapshot.create({
    data: {
      workspaceSessionId: sessionId,
      stage: session.stage,
      snapshotData: serializeWorkspaceSessionState(session as Record<string, unknown>),
      reason: "stage_complete",
    },
  });

  return db.workspaceSession.update({
    where: { id: sessionId },
    data: {
      stage: nextStage,
      lastInteractionAt: new Date(),
      ...(updates ?? {}),
    },
  });
}

export async function updateWorkspaceSession(
  sessionId: string,
  updates: Partial<Prisma.WorkspaceSessionUpdateInput>,
  snapshot = false
) {
  if (snapshot) {
    const session = await db.workspaceSession.findUniqueOrThrow({
      where: { id: sessionId },
    });

    await db.workspaceSnapshot.create({
      data: {
        workspaceSessionId: sessionId,
        stage: session.stage,
        snapshotData: serializeWorkspaceSessionState(session as Record<string, unknown>),
        reason: "auto_save",
      },
    });
  }

  return db.workspaceSession.update({
    where: { id: sessionId },
    data: {
      ...updates,
      lastInteractionAt: new Date(),
    },
  });
}

export async function resumeFromSnapshot(sessionId: string, snapshotId: string) {
  const snapshot = await db.workspaceSnapshot.findUniqueOrThrow({
    where: { id: snapshotId },
  });

  const session = await db.workspaceSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  await db.workspaceSnapshot.create({
    data: {
      workspaceSessionId: sessionId,
      stage: session.stage,
      snapshotData: serializeWorkspaceSessionState(session as Record<string, unknown>),
      reason: "before_restore",
    },
  });

  const data = (snapshot.snapshotData ?? {}) as Record<string, unknown>;

  return db.workspaceSession.update({
    where: { id: sessionId },
    data: {
      stage: typeof data.stage === "string" ? data.stage : session.stage,
      ideaPrompt: typeof data.ideaPrompt === "string" ? data.ideaPrompt : session.ideaPrompt,
      businessGoal: typeof data.businessGoal === "string" ? data.businessGoal : session.businessGoal,
      tone: typeof data.tone === "string" ? data.tone : session.tone,
      industry: typeof data.industry === "string" ? data.industry : session.industry,
      audience: typeof data.audience === "string" ? data.audience : session.audience,
      selectedPlatforms: Array.isArray(data.selectedPlatforms) ? (data.selectedPlatforms as string[]) : session.selectedPlatforms,
      selectedVariantId: typeof data.selectedVariantId === "string" ? data.selectedVariantId : session.selectedVariantId,
      carouselState: ((data.carouselState ?? session.carouselState ?? undefined) as Prisma.InputJsonValue | undefined),
      scheduleIntent: typeof data.scheduleIntent === "string" ? data.scheduleIntent : session.scheduleIntent,
      scheduledPlatforms: Array.isArray(data.scheduledPlatforms) ? (data.scheduledPlatforms as string[]) : session.scheduledPlatforms,
      lastInteractionAt: new Date(),
    },
  });
}

export async function listResumableSessions(orgId: string, userId: string) {
  return db.workspaceSession.findMany({
    where: {
      orgId,
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { lastInteractionAt: "desc" },
    take: 5,
    select: {
      id: true,
      stage: true,
      ideaPrompt: true,
      createdAt: true,
      lastInteractionAt: true,
      selectedVariantId: true,
      campaignId: true,
    },
  });
}

export async function deleteExpiredSessions() {
  return db.workspaceSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}

export async function logWorkspaceAction(
  sessionId: string,
  orgId: string,
  userId: string,
  action: string,
  metadata?: Record<string, unknown>
) {
  const session = await db.workspaceSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  return db.workspaceAuditLog.create({
    data: {
      workspaceSessionId: sessionId,
      orgId,
      userId,
      action,
      previousStage: undefined,
      newStage: session.stage,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
