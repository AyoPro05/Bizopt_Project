import { db } from "@/lib/db";
import type { PublishPayload as CorePublishPayload } from "@bizopt/core";
import { getPlatformConnector } from "./factory";

export type PublishPayload = {
  orgId: string;
  caption?: string;
  campaignId?: string;
  mediaUrls?: string[];
};

export type PublishResult = {
  success: boolean;
  externalId?: string;
  error?: string;
};

function isDemoAccount(account: { accountId: string }) {
  return (
    account.accountId.startsWith("demo_") || account.accountId.startsWith("oauth_")
  );
}

async function loadSocialAccount(orgId: string, platformKey: string) {
  return db.socialAccount.findFirst({
    where: { orgId, platform: platformKey, disconnectedAt: null },
  });
}

/**
 * Single publish entry point — uses PlatformConnector registry, reads SocialAccount tokens.
 */
export async function publishToPlatform(
  platformKey: string,
  payload: PublishPayload
): Promise<PublishResult> {
  const connector = getPlatformConnector(platformKey);
  if (!connector) {
    return {
      success: false,
      error: `Platform ${platformKey} is not supported for direct publish`,
    };
  }

  const account = await loadSocialAccount(payload.orgId, platformKey);
  if (!account) {
    return {
      success: false,
      error: `${platformKey} not connected. Connect in Integrations.`,
    };
  }

  const demo = isDemoAccount(account);
  if (!account.accessToken && !demo) {
    return {
      success: false,
      error: `${platformKey} not connected. Complete OAuth or use demo connect in development.`,
    };
  }

  const corePayload: CorePublishPayload = {
    caption: payload.caption,
    mediaUrls: payload.mediaUrls ?? [],
  };

  const result = await connector.publish(
    account.accessToken ?? "demo-token",
    account.accountId,
    corePayload
  );

  return {
    success: result.success,
    externalId: result.externalId,
    error: result.errorMessage,
  };
}
