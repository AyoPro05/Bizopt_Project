import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export type IdentityPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "EMAIL_CHANGE";
export type IdentityProof = { id: string; token: string };
export function hashIdentityToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function createIdentitySecret() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashIdentityToken(token) };
}
export function validIdentityProof(row: { id: string; userId: string; purpose: string; targetEmail: string; tokenHash: string; expiresAt: Date; consumedAt: Date | null } | null, proof: IdentityProof, purpose: IdentityPurpose, email: string, now: Date): boolean {
  if (!row || row.id !== proof.id || !row.userId || row.purpose !== purpose || row.targetEmail !== email || row.consumedAt || row.expiresAt <= now || !/^[a-f0-9]{64}$/.test(proof.token) || !/^[a-f0-9]{64}$/.test(row.tokenHash)) return false;
  return timingSafeEqual(Buffer.from(row.tokenHash, "hex"), Buffer.from(hashIdentityToken(proof.token), "hex"));
}
