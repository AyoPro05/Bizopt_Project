import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SupportError } from "./errors";

function encryptionKey(encoded = process.env.SUPPORT_ENCRYPTION_KEY): Buffer {
  const key = Buffer.from(encoded ?? "", "base64");
  if (key.length !== 32) throw new SupportError("Support MFA requires a configured 32-byte encryption key.", 503);
  return key;
}
export function encryptTotpSecret(secret: Buffer, key?: string) {
  if (secret.length < 20) throw new Error("Use at least 20 random bytes for a TOTP secret.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  cipher.setAAD(Buffer.from("bizopt-support-totp-v1"));
  const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function decryptTotpSecret(value: string, key?: string) {
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new SupportError("Support MFA enrollment is unavailable.", 503);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(key), Buffer.from(parts[1], "base64url"));
  decipher.setAAD(Buffer.from("bizopt-support-totp-v1"));
  decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]);
}
export function totp(secret: Buffer, timeSeconds: number, digits = 6) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeSeconds / 30)));
  const hash = createHmac("sha1", secret).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits)).toString().padStart(digits, "0");
}
export function verifyTotp(secret: Buffer, code: string, timeSeconds = Date.now() / 1000, previous?: bigint | null): bigint | null {
  if (!/^\d{6}$/.test(code)) return null;
  // ± one 30-second step accommodates ordinary authenticator clock drift.
  for (const delta of [0, -30, 30]) {
    const time = timeSeconds + delta;
    const count = BigInt(Math.floor(time / 30));
    if (time < 0 || (previous !== null && previous !== undefined && count <= previous)) continue;
    if (timingSafeEqual(Buffer.from(code), Buffer.from(totp(secret, time)))) return count;
  }
  return null;
}
