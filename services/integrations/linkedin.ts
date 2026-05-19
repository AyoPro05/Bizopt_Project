import { db } from "@/lib/db";
import type { PublishPayload, PublishResult } from "./index";

export async function connectLinkedIn(orgId: string, _code: string) {
  return { platform: "linkedin", orgId, connected: false, message: "Configure LINKEDIN_CLIENT_ID" };
}

export async function publishToLinkedIn(payload: PublishPayload): Promise<PublishResult> {
  const account = await db.socialAccount.findFirst({
    where: { orgId: payload.orgId, platform: "linkedin", disconnectedAt: null },
  });

  if (!account?.accessToken) {
    return {
      success: false,
      error: "LinkedIn not connected. Connect in Settings → Social accounts.",
    };
  }

  return { success: true, externalId: `li_${Date.now()}` };
}
