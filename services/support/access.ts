import { createHash, randomBytes } from "node:crypto";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { SupportError } from "./errors";
import { decryptTotpSecret, verifyTotp } from "./mfa";
import type { SupportIdentity } from "./tickets";

export const supportCookie = "support_access";
type Context = { userId: string; sessionId: string | null };
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const isStaffRole = (role: string): role is SupportIdentity["role"] => ["support_agent", "support_admin"].includes(role);

export async function requireSupportStaff(req: Request, context: Context): Promise<SupportIdentity> {
  if (!context.sessionId) throw new SupportError("Use an authenticated browser session for privileged support.", 403);
  const staff = await db.supportStaff.findUnique({ where: { userId: context.userId }, select: { active: true, role: true } });
  if (!staff?.active || !isStaffRole(staff.role)) throw new SupportError("Your account does not have privileged support access.", 403);
  const token = req.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${supportCookie}=`))?.slice(supportCookie.length + 1);
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) throw new SupportError("Unlock the support console with your password and MFA code.", 403);
  const grant = await db.supportAccessGrant.findFirst({ where: { tokenHash: tokenHash(token), userId: context.userId, webSessionId: context.sessionId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
  if (!grant) throw new SupportError("Unlock the support console with your password and MFA code.", 403);
  const session = await db.webSession.findFirst({ where: { id: context.sessionId, userId: context.userId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
  if (!session) throw new SupportError("Your browser session has ended. Sign in again.", 401);
  return { userId: context.userId, role: staff.role };
}

export async function unlockSupport(context: Context, password: string, code: string) {
  if (!context.sessionId) throw new SupportError("Use an authenticated browser session for privileged support.", 403);
  const sessionId = context.sessionId;
  // Reserve each attempt durably before checking credentials, so failures survive process restarts.
  await db.$transaction(async (tx) => {
    const count = await tx.auditLog.count({ where: { userId: context.userId, action: "support.unlock_attempt", createdAt: { gte: new Date(Date.now() - 15 * 60_000) } } });
    if (count >= 5) throw new SupportError("Too many unlock attempts. Wait 15 minutes and try again.", 429);
    await tx.auditLog.create({ data: { userId: context.userId, action: "support.unlock_attempt", entity: "SupportAccessGrant" } });
  }, { isolationLevel: "Serializable" });
  const [staff, user] = await Promise.all([
    db.supportStaff.findUnique({ where: { userId: context.userId }, select: { active: true, role: true, totpSecretEnc: true, lastTotpCounter: true } }),
    db.user.findUnique({ where: { id: context.userId }, select: { passwordHash: true } }),
  ]);
  if (!staff?.active || !isStaffRole(staff.role) || !user?.passwordHash || !await compare(password, user.passwordHash)) throw new SupportError("Support access, password or MFA code could not be verified.", 403);
  const counter = verifyTotp(decryptTotpSecret(staff.totpSecretEnc), code, Date.now() / 1000, staff.lastTotpCounter);
  if (counter === null) throw new SupportError("Support access, password or MFA code could not be verified.", 403);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db.$transaction(async (tx) => {
    const consumed = await tx.supportStaff.updateMany({ where: { userId: context.userId, active: true, OR: [{ lastTotpCounter: null }, { lastTotpCounter: { lt: counter } }] }, data: { lastTotpCounter: counter } });
    if (!consumed.count) throw new SupportError("That MFA code was already used. Wait for the next code.", 403);
    await tx.supportAccessGrant.updateMany({ where: { userId: context.userId, webSessionId: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.supportAccessGrant.create({ data: { userId: context.userId, webSessionId: sessionId, tokenHash: tokenHash(token), expiresAt } });
    await tx.auditLog.create({ data: { userId: context.userId, action: "support.unlocked", entity: "SupportAccessGrant", metadata: { sessionId: context.sessionId } } });
  });
  return { token, expiresAt };
}

export async function lockSupport(context: Context) {
  if (context.sessionId) {
    await db.$transaction(async (tx) => {
      await tx.supportAccessGrant.updateMany({ where: { userId: context.userId, webSessionId: context.sessionId!, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: context.userId, action: "support.locked", entity: "SupportAccessGrant" } });
    });
  }
}
