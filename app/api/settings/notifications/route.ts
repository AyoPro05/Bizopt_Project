import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson } from "@/lib/platform-http";
import { supportError, supportJson } from "@/lib/support-http";
import { getNotificationPreferences, setNotificationPreference } from "@/services/notification-access";
export async function GET(req: Request) {
  try { const ctx = await getPlatformContext(req); return supportJson(await getNotificationPreferences(ctx.userId)); }
  catch (error) { return supportError(error); }
}
export async function PATCH(req: Request) {
  try { mutationGuard(req); const ctx = await getPlatformContext(req); await setNotificationPreference(ctx.userId, await readJson(req, 4000)); return supportJson({ ok: true }); }
  catch (error) { return supportError(error); }
}
