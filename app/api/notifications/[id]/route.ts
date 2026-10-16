import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard } from "@/lib/platform-http";
import { supportError, supportJson } from "@/lib/support-http";
import { markPrivateNotification } from "@/services/notification-access";
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { mutationGuard(req); const ctx = await getPlatformContext(req); await markPrivateNotification(ctx.org.id, ctx.userId, (await params).id); return supportJson({ ok: true }); }
  catch (error) { return supportError(error); }
}
