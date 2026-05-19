export { publishToMeta, connectMeta } from "./meta";
export { publishToLinkedIn, connectLinkedIn } from "./linkedin";
export { publishToTikTok, connectTikTok } from "./tiktok";

import { publishToMeta } from "./meta";
import { publishToLinkedIn } from "./linkedin";
import { publishToTikTok } from "./tiktok";

export type PublishResult = {
  success: boolean;
  externalId?: string;
  error?: string;
};

export type PublishPayload = {
  orgId: string;
  caption: string;
  campaignId?: string;
  mediaUrls?: string[];
};

export async function publishToPlatform(
  platform: string,
  payload: PublishPayload
): Promise<PublishResult> {
  switch (platform) {
    case "instagram":
    case "facebook":
      return publishToMeta(platform, payload);
    case "linkedin":
      return publishToLinkedIn(payload);
    case "tiktok":
      return publishToTikTok(payload);
    default:
      return {
        success: false,
        error: `Platform ${platform} not yet supported for direct publish`,
      };
  }
}
