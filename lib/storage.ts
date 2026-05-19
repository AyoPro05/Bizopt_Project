import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";

export type UploadMeta = {
  orgId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type StoredObject = {
  storageKey: string;
};

function privateUploadsRoot() {
  return path.join(process.cwd(), "storage", "private-uploads");
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
      "S3 upload is not configured yet. Unset S3_* env vars to use private local storage."
    );
  }

  const safeName = meta.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const key = `${meta.orgId}/${Date.now()}-${safeName}`;
  const filePath = path.join(privateUploadsRoot(), key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  return { storageKey: key };
}

export async function readStoredObject(storageKey: string): Promise<Buffer> {
  const filePath = path.join(privateUploadsRoot(), storageKey);
  return readFile(filePath);
}

export async function deleteObject(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(privateUploadsRoot(), storageKey));
  } catch {
    /* ignore missing */
  }
}
