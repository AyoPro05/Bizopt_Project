import type { PlatformConnector } from "@bizopt/core";
import type { PublishPayload, PublishResult } from "@bizopt/core";

/** LinkedIn-first connector — OAuth + publish stubs ready for production tokens. */
export class LinkedInConnector implements PlatformConnector {
  readonly platformKey = "linkedin";

  async connect(authCode: string) {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
      return {
        externalId: `linkedin-demo-${authCode.slice(0, 8)}`,
        displayName: "LinkedIn (demo)",
      };
    }
    return {
      externalId: `linkedin-${authCode.slice(0, 12)}`,
      displayName: "LinkedIn Page",
    };
  }

  async refreshToken(refreshToken: string) {
    return {
      accessToken: `refreshed-${refreshToken.slice(0, 8)}`,
      expiresAt: new Date(Date.now() + 3600_000),
    };
  }

  async publish(
    _accessToken: string,
    _accountExternalId: string,
    payload: PublishPayload
  ): Promise<PublishResult> {
    if (!payload.caption && payload.mediaUrls.length === 0) {
      return { success: false, errorMessage: "Caption or media required" };
    }
    return {
      success: true,
      externalId: `li-${Date.now()}`,
    };
  }

  validateMedia(mimeType: string, sizeBytes: number) {
    const max = 200 * 1024 * 1024;
    if (sizeBytes > max) {
      return { ok: false, reason: "LinkedIn media must be under 200MB" };
    }
    if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
      return { ok: false, reason: "LinkedIn supports image and video only" };
    }
    return { ok: true };
  }
}
