import { db } from "@/lib/db";

export async function listAudioLayers(orgId: string, mediaAssetId: string) {
  return db.audioLayer.findMany({
    where: { orgId, mediaAssetId },
    include: { audioAsset: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function addAudioLayer(
  orgId: string,
  data: {
    mediaAssetId?: string;
    audioAssetId: string;
    startMs?: number;
    volume?: number;
    sortOrder?: number;
  }
) {
  const audio = await db.asset.findFirst({
    where: { id: data.audioAssetId, orgId, type: "audio" },
  });
  if (!audio) throw new Error("Audio asset not found");

  const count = await db.audioLayer.count({
    where: { orgId, mediaAssetId: data.mediaAssetId ?? null },
  });

  return db.audioLayer.create({
    data: {
      orgId,
      mediaAssetId: data.mediaAssetId,
      audioAssetId: data.audioAssetId,
      startMs: data.startMs ?? 0,
      volume: data.volume ?? 1,
      sortOrder: data.sortOrder ?? count,
    },
    include: { audioAsset: true },
  });
}

export async function updateAudioLayer(
  orgId: string,
  layerId: string,
  data: Partial<{ startMs: number; volume: number; sortOrder: number }>
) {
  return db.audioLayer.updateMany({
    where: { id: layerId, orgId },
    data,
  });
}

export async function removeAudioLayer(orgId: string, layerId: string) {
  return db.audioLayer.deleteMany({ where: { id: layerId, orgId } });
}
