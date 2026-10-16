import { getPlatformContext } from "@/lib/platform-context";
import { supportError, supportJson } from "@/lib/support-http";
import { listPrivateNotifications } from "@/services/notification-access";
export async function GET(req: Request) {
  try { const ctx = await getPlatformContext(req); return supportJson(await listPrivateNotifications(ctx.org.id, ctx.userId)); }
  catch (error) { return supportError(error); }
}
