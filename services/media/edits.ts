import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { MediaEditOperation } from "@bizopt/core/media/types";

export async function applyMediaEdit(
  orgId: string,
  assetId: string,
  operation: MediaEditOperation,
  params: Record<string, unknown>
) {
  const asset = await db.asset.findFirst({ where: { id: assetId, orgId } });
  if (!asset) throw new Error("Asset not found");

  const latest = await db.mediaEdit.findFirst({
    where: { assetId },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version ?? 0) + 1;

  const edit = await db.mediaEdit.create({
    data: {
      orgId,
      assetId,
      operation,
      params: params as Prisma.InputJsonValue,
      version,
    },
  });

  if (operation === "trim" && typeof params.endMs === "number") {
    await db.asset.update({
      where: { id: assetId },
      data: { durationMs: params.endMs as number },
    });
  }

  return edit;
}

export async function listEdits(orgId: string, assetId: string) {
  return db.mediaEdit.findMany({
    where: { orgId, assetId },
    orderBy: { version: "desc" },
  });
}
