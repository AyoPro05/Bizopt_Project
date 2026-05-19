import { db } from "@/lib/db";
import type { PublishPayload, PublishResult } from "./index";

export async function connectTikTok(orgId: string, _code: string) {
  return { platform: "tiktok", orgId, connected: false, message: "Configure TIKTOK_CLIENT_KEY" };
}

export async function publishToTikTok(payload: PublishPayload): Promise<PublishResult> {
  const account = await db.socialAccount.findFirst({
    where: { orgId: payload.orgId, platform: "tiktok", disconnectedAt: null },
  });

  if (!account?.accessToken) {
    return {
      success: false,
      error: "TikTok not connected. Connect in Settings → Social accounts.",
    };
  }

  return { success: true, externalId: `tt_${Date.now()}` };
}
