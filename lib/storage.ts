import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

export type UploadMeta = {
  orgId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type StoredObject = {
  storageKey: string;
  url: string;
};

function uploadsRoot() {
  return path.join(process.cwd(), "public", "uploads");
}

export function getStorageBackend(): "local" | "s3" {
  if (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID) return "s3";
  return "local";
}

export async function uploadObject(
  buffer: Buffer,
  meta: UploadMeta
): Promise<StoredObject> {
  if (getStorageBackend() === "s3") {
    throw new Error(
      "S3 upload requires AWS SDK wiring — use local storage or set only DATABASE_URL for dev"
    );
  }

  const safeName = meta.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const key = `${meta.orgId}/${Date.now()}-${safeName}`;
  const filePath = path.join(uploadsRoot(), key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  return {
    storageKey: key,
    url: `/uploads/${key}`,
  };
}

export async function deleteObject(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(uploadsRoot(), storageKey));
  } catch {
    /* ignore missing */
  }
}
