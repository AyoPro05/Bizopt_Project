import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { validateNotificationEncryption } from "./config";

export function encryptPayload(value: unknown, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", validateNotificationEncryption(), iv);
  cipher.setAAD(Buffer.from(`bizopt-notification-v1:${context}`));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), bytes.toString("base64url")].join(".");
}

export function decryptPayload<T = Record<string, string>>(value: string, context: string): T {
  const [version, iv, tag, bytes, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !bytes || extra) throw new Error("Invalid notification envelope.");
  const decipher = createDecipheriv("aes-256-gcm", validateNotificationEncryption(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(`bizopt-notification-v1:${context}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(bytes, "base64url")), decipher.final()]).toString("utf8")) as T;
}

export function emailHash(email: string): string { return createHash("sha256").update(email.trim().toLowerCase()).digest("hex"); }

const optionalCategories = ["OPERATIONAL", "DIGEST", "MARKETING"];
function unsubscribeKey(): Buffer {
  const configured = process.env.NOTIFICATION_UNSUBSCRIBE_SECRET;
  if (configured && configured.length < 32) throw new Error("Unsubscribe key configuration is incomplete.");
  return createHmac("sha256", configured || validateNotificationEncryption()).update("bizopt-optional-email-unsubscribe-v1").digest();
}
export function signUnsubscribe(userId: string, category: string, expiresAt: Date): string {
  if (!optionalCategories.includes(category)) throw new Error("Necessary notifications cannot be unsubscribed.");
  const payload = Buffer.from(JSON.stringify({ purpose: "optional-email-unsubscribe-v1", userId, category, expiresAt: expiresAt.getTime() })).toString("base64url");
  return `${payload}.${createHmac("sha256", unsubscribeKey()).update(payload).digest("base64url")}`;
}
export function verifyUnsubscribe(token: string, now = new Date()): { userId: string; category: "OPERATIONAL" | "DIGEST" | "MARKETING" } {
  if (token.length > 1500) throw new Error("Invalid unsubscribe confirmation.");
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) throw new Error("Invalid unsubscribe confirmation.");
  const expected = createHmac("sha256", unsubscribeKey()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("Invalid unsubscribe confirmation.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (data.purpose !== "optional-email-unsubscribe-v1" || typeof data.userId !== "string" || !data.userId || !optionalCategories.includes(data.category) || typeof data.expiresAt !== "number" || data.expiresAt <= now.getTime()) throw new Error("Invalid unsubscribe confirmation.");
  return { userId: data.userId, category: data.category };
}
export function createUnsubscribeProof(userId: string, category: string) { return signUnsubscribe(userId, category, new Date(Date.now() + 90 * 86400_000)); }
export const verifyUnsubscribeProof = verifyUnsubscribe;
export const sealPayload = encryptPayload;
export const openPayload = decryptPayload;
