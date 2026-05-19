import { db } from "@/lib/db";
import { uploadObject, deleteObject } from "@/lib/storage";
import { isAllowedMime } from "@/lib/media-mime";

const MAX_BYTES = 50 * 1024 * 1024;

function inferType(mime: string): string {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "image";
}

export async function listAssets(orgId: string) {
  return db.asset.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      edits: { orderBy: { version: "desc" }, take: 1 },
      _count: { select: { parentMedia: true } },
    },
  });
}

export async function getAsset(orgId: string, id: string) {
  return db.asset.findFirst({
    where: { id, orgId },
    include: {
      edits: { orderBy: { version: "desc" } },
      audioLayers: { include: { audioAsset: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function uploadAsset(
  orgId: string,
  file: { buffer: Buffer; filename: string; mimeType: string; sizeBytes: number }
) {
  if (file.sizeBytes > MAX_BYTES) {
    throw new Error("File exceeds 50MB limit");
  }
  if (!isAllowedMime(file.mimeType)) {
    throw new Error("File type not allowed");
  }

  const stored = await uploadObject(file.buffer, {
    orgId,
    filename: file.filename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  });

  const asset = await db.asset.create({
    data: {
      orgId,
      type: inferType(file.mimeType),
      url: "",
      storageKey: stored.storageKey,
      filename: file.filename,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    },
  });

  return db.asset.update({
    where: { id: asset.id },
    data: { url: `/api/media/${asset.id}/file` },
  });
}

export async function deleteAsset(orgId: string, id: string) {
  const asset = await db.asset.findFirst({ where: { id, orgId } });
  if (!asset) return false;
  if (asset.storageKey) await deleteObject(asset.storageKey);
  await db.asset.delete({ where: { id } });
  return true;
}

export async function updateAssetMeta(
  orgId: string,
  id: string,
  data: { width?: number; height?: number; durationMs?: number }
) {
  return db.asset.updateMany({ where: { id, orgId }, data });
}
