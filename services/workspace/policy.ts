import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/services/platform/errors";

export const INVITE_TTL_MS = 7 * 86_400_000;
export function invitationToken(id: string, generation: string): string {
  const secret = process.env.INVITE_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new AppError("Invitation delivery is not configured.", 503);
  // A CSPRNG generation nonce and server-held PRF key permit durable retries while
  // storing the verifier hash and public nonce, never the bearer token or PRF key.
  return createHmac("sha256", secret).update(`workspace-invite-v1:${id}:${generation}`).digest("hex");
}
export function tokenDigest(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function tokenMatches(token: string, expected: string): boolean {
  const a = Buffer.from(tokenDigest(token));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function reservationLimit(entitlement: { seatLimit: number } | null, subscription: { pendingPlan: string | null } | null) {
  return subscription?.pendingPlan === "base" ? 2 : Math.min(5, Math.max(2, entitlement?.seatLimit ?? 2));
}
export function canGrantRole(actorRole: string, proposed: string) {
  return proposed === "member" ? ["owner", "admin"].includes(actorRole) : proposed === "admin" && actorRole === "owner";
}
export function validateInviteIdentity(email: string, user: { email: string; emailVerified: Date | null }) {
  if (!user.emailVerified || user.email.toLowerCase() !== email.toLowerCase()) throw new AppError("Sign in with the matching verified email address to accept this invitation.", 403);
}
export function invitationDeliveryReadiness() {
  if (process.env.TEAM_INVITATIONS_ENABLED !== "true") return "Team invitations are not enabled for this deployment.";
  if (process.env.TEAM_DEVICE_POLICY === "workspace_legacy") return "This deployment uses the legacy workspace-wide device policy. Configure the approved per-person policy before enabling invitations.";
  if (!process.env.INVITE_TOKEN_SECRET || process.env.INVITE_TOKEN_SECRET.length < 32 || !process.env.RESEND_API_KEY || !process.env.INVITE_FROM_EMAIL) return "Invitation email delivery is not configured. Ask your workspace operator to complete setup.";
  return null;
}
