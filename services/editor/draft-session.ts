import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function saveEditorSession(
  orgId: string,
  userId: string,
  data: {
    entityType: string;
    snapshotJson: Prisma.InputJsonValue;
    briefId?: string;
    campaignId?: string;
  }
) {
  if (data.briefId) {
    return db.editorSession.upsert({
      where: { briefId: data.briefId },
      create: {
        orgId,
        userId,
        briefId: data.briefId,
        campaignId: data.campaignId,
        entityType: data.entityType,
        snapshotJson: data.snapshotJson,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        snapshotJson: data.snapshotJson,
        lastSavedAt: new Date(),
      },
    });
  }

  return db.editorSession.create({
    data: {
      orgId,
      userId,
      campaignId: data.campaignId,
      entityType: data.entityType,
      snapshotJson: data.snapshotJson,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}

export async function getResumableSessions(orgId: string, userId: string) {
  return db.editorSession.findMany({
    where: {
      orgId,
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { brief: { select: { id: true, prompt: true, status: true } } },
    orderBy: { lastSavedAt: "desc" },
    take: 10,
  });
}

export async function getSession(orgId: string, sessionId: string) {
  return db.editorSession.findFirst({
    where: { id: sessionId, orgId },
    include: { brief: true },
  });
}
