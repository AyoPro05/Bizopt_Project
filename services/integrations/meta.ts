import { db } from "@/lib/db";
import type { PublishPayload, PublishResult } from "./index";

export async function connectMeta(orgId: string, _code: string) {
  return { platform: "meta", orgId, connected: false, message: "Configure META_APP_ID and OAuth flow" };
}

export async function publishToMeta(
  platform: "instagram" | "facebook",
  payload: PublishPayload
): Promise<PublishResult> {
  const account = await db.socialAccount.findFirst({
    where: {
      orgId: payload.orgId,
      platform: platform === "instagram" ? "instagram" : "facebook",
      disconnectedAt: null,
    },
  });

  if (!account?.accessToken) {
    return {
      success: false,
      error: `${platform} not connected. Connect in Settings → Social accounts.`,
    };
  }

  // Production: call Graph API container + publish
  const mockId = `meta_${platform}_${Date.now()}`;
  return { success: true, externalId: mockId };
}
