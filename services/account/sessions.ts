import { randomBytes } from "node:crypto";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { AppError } from "@/services/platform/errors";
import { rateLimit } from "@/lib/rate-limit";

export async function createWebSession(userId: string, legacy = false) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, sessionVersion: true } });
  if (!user) throw new AppError("Unauthorized", 401);
  if (legacy && user.sessionVersion > 0) throw new AppError("Sign in again to continue.", 401);
  return db.webSession.create({ data: { id: randomBytes(32).toString("hex"), userId, version: user.sessionVersion, expiresAt: new Date(Date.now() + 30 * 86_400_000) } });
}

export async function validateWebSession(userId: string, id: string, version: number) {
  const session = await db.webSession.findFirst({ where: { id, userId, version, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: { select: { sessionVersion: true } } } });
  if (!session || session.user.sessionVersion !== version) return false;
  if (Date.now() - session.lastUsedAt.getTime() > 60_000) await db.webSession.updateMany({ where: { id, userId, revokedAt: null }, data: { lastUsedAt: new Date() } });
  return true;
}

export async function requirePassword(userId: string, password: string) {
  if (!rateLimit(`reauth:${userId}`, 5, 5 * 60_000).ok) throw new AppError("Too many password attempts. Please wait five minutes.", 429);
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!password || !user?.passwordHash || !await compare(password, user.passwordHash)) throw new AppError("Please confirm your current password.", 403);
}

export async function revokeAccountSessions(userId: string) {
  await db.$transaction(async (tx) => {
    const revokedAt = new Date();
    await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
    await tx.webSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt } });
    await tx.mobileSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt } });
    await tx.supportAccessGrant.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt } });
    await tx.auditLog.create({ data: { userId, action: "account.sessions_revoked" } });
  });
}
