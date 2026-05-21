import type { PlatformConnector } from "@bizopt/core";
import type { PublishPayload, PublishResult } from "@bizopt/core";

export class TikTokConnector implements PlatformConnector {
  readonly platformKey = "tiktok";

  async connect(authCode: string) {
    return {
      externalId: `tiktok-${authCode.slice(0, 12)}`,
      displayName: "TikTok",
    };
  }

  async refreshToken(refreshToken: string) {
    return {
      accessToken: `tt-refreshed-${refreshToken.slice(0, 8)}`,
      expiresAt: new Date(Date.now() + 3600_000),
    };
  }

  async publish(
    _accessToken: string,
    _accountExternalId: string,
    payload: PublishPayload
  ): Promise<PublishResult> {
    if (!payload.caption && payload.mediaUrls.length === 0) {
      return { success: false, errorMessage: "Caption or video required" };
    }
    return {
      success: true,
      externalId: `tt_${Date.now()}`,
    };
  }

  validateMedia(mimeType: string, sizeBytes: number, durationMs?: number) {
    if (!mimeType.startsWith("video/")) {
      return { ok: false, reason: "TikTok requires video" };
    }
    if (sizeBytes > 500 * 1024 * 1024) {
      return { ok: false, reason: "Video must be under 500MB" };
    }
    if (durationMs != null && durationMs > 600_000) {
      return { ok: false, reason: "Video must be under 10 minutes" };
    }
    return { ok: true };
  }
}
