import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getApiContext } from "@/lib/api-context";
import { db } from "@/lib/db";
import { AppError } from "@/lib/platform-http";
import { requireCapability, type Capability } from "@/lib/platform-permissions";

export async function getPlatformContext(req: Request, capability: Capability = "workspace.read") {
  const context = await getApiContext({}, req);
  if (context.error || !context.org || !context.userId) throw new AppError(context.error ?? "Unauthorized", context.status ?? 401);
  const [member, user, session] = await Promise.all([
    requireCapability(context.org.id, context.userId, capability),
    db.user.findUnique({ where: { id: context.userId }, select: { id: true, name: true, email: true, emailVerified: true } }),
    req.headers.has("authorization") ? null : getServerSession(authOptions),
  ]);
  if (!user) throw new AppError("Unauthorized", 401);
  return { org: context.org, userId: user.id, user, role: member.role, sessionId: session?.sessionId ?? null };
}
