import { db } from "@/lib/db";
import { AppError } from "@/services/platform/errors";
export async function requireVerifiedBillingUser(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } });
  if (!user?.emailVerified) throw new AppError("Verify your email before continuing with billing", 403);
  return user;
}
