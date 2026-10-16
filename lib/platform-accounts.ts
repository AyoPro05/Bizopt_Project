import { randomUUID } from "node:crypto";
import { emitWorkspaceOperation } from "@/services/operational-events";
import { db } from "@/lib/db";

/** Connected platform keys from either SocialAccount or PlatformAccount. */
export async function getConnectedPlatformKeys(orgId: string): Promise<string[]> {
  const [social, platform] = await Promise.all([
    db.socialAccount.findMany({
      where: { orgId, disconnectedAt: null },
      select: { platform: true },
    }),
    db.platformAccount.findMany({
      where: { orgId, disconnectedAt: null },
      select: { platformKey: true },
    }),
  ]);
  return [
    ...new Set([
      ...social.map((s) => s.platform),
      ...platform.map((p) => p.platformKey),
    ]),
  ];
}

export async function countConnectedPlatforms(orgId: string): Promise<number> {
  return (await getConnectedPlatformKeys(orgId)).length;
}

/** Keep SocialAccount (publish) and PlatformAccount (UI/registry) in sync. */
export async function upsertConnectedPlatform(
  orgId: string,
  platformKey: string,
  externalId: string,
  displayName?: string
) {
  const name = displayName ?? `${platformKey} account`;

  await db.socialAccount.upsert({
    where: {
      orgId_platform_accountId: {
        orgId,
        platform: platformKey,
        accountId: externalId,
      },
    },
    create: {
      orgId,
      platform: platformKey,
      accountId: externalId,
      accountName: name,
    },
    update: {
      disconnectedAt: null,
      connectedAt: new Date(),
      accountName: name,
    },
  });

  await db.platformAccount.upsert({
    where: {
      orgId_platformKey_externalId: {
        orgId,
        platformKey,
        externalId,
      },
    },
    create: {
      orgId,
      platformKey,
      externalId,
      displayName: name,
    },
    update: {
      disconnectedAt: null,
      connectedAt: new Date(),
      displayName: name,
    },
  });
}

export async function disconnectPlatform(
  orgId: string,
  platformKey: string,
  externalId?: string
) {
  await db.$transaction(async tx => {
    const socialWhere = { orgId, platform: platformKey, disconnectedAt: null, ...(externalId ? { accountId: externalId } : {}) };
    const platformWhere = { orgId, platformKey, disconnectedAt: null, ...(externalId ? { externalId } : {}) };
    const social = await tx.socialAccount.updateMany({ where: socialWhere, data: { disconnectedAt: new Date() } });
    const platform = await tx.platformAccount.updateMany({ where: platformWhere, data: { disconnectedAt: new Date() } });
    if (social.count || platform.count) await emitWorkspaceOperation(tx, orgId, "connection.reconnect_required", platformKey, `connection-disconnected:${randomUUID()}`, { platform: platformKey, reasonCode: "DISCONNECTED" });
  });
}
