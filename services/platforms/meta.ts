import type { PlatformConnector } from "@bizopt/core";
import type { PublishPayload, PublishResult } from "@bizopt/core";

/** Meta Graph publish stub for Instagram and Facebook. */
export class MetaConnector implements PlatformConnector {
  readonly platformKey: "instagram" | "facebook";

  constructor(platformKey: "instagram" | "facebook") {
    this.platformKey = platformKey;
  }

  async connect(authCode: string) {
    return {
      externalId: `${this.platformKey}-${authCode.slice(0, 12)}`,
      displayName: this.platformKey === "instagram" ? "Instagram" : "Facebook Page",
    };
  }

  async refreshToken(refreshToken: string) {
    return {
      accessToken: `meta-refreshed-${refreshToken.slice(0, 8)}`,
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
      externalId: `meta_${this.platformKey}_${Date.now()}`,
    };
  }

  validateMedia(mimeType: string, sizeBytes: number) {
    const max = 100 * 1024 * 1024;
    if (sizeBytes > max) {
      return { ok: false, reason: "Media must be under 100MB" };
    }
    if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
      return { ok: false, reason: "Image and video only" };
    }
    return { ok: true };
  }
}
