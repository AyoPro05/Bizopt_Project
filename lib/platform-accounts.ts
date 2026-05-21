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
  const socialWhere = externalId
    ? { orgId, platform: platformKey, accountId: externalId }
    : { orgId, platform: platformKey, disconnectedAt: null };

  await db.socialAccount.updateMany({
    where: socialWhere,
    data: { disconnectedAt: new Date() },
  });

  const platformWhere = externalId
    ? { orgId, platformKey, externalId }
    : { orgId, platformKey, disconnectedAt: null };

  await db.platformAccount.updateMany({
    where: platformWhere,
    data: { disconnectedAt: new Date() },
  });
}
