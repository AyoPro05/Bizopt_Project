import { createHmac, randomBytes, timingSafeEqual } from "crypto";

function getDeviceSecret(): string {
  const secret = process.env.DEVICE_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("DEVICE_SECRET or NEXTAUTH_SECRET must be set");
  }
  return secret;
}

export function hashDeviceFingerprint(fingerprint: string): string {
  return createHmac("sha256", getDeviceSecret()).update(fingerprint).digest("hex");
}

export function signPayload(payload: string): string {
  return createHmac("sha256", getDeviceSecret()).update(payload).digest("hex");
}

export function verifySignature(payload: string, signature: string): boolean {
  const expected = signPayload(payload);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}
