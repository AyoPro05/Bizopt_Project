import { db } from "@/lib/db";

export async function listCampaigns(orgId: string) {
  return db.campaign.findMany({
    where: { orgId },
    include: {
      scheduledPosts: true,
      assets: { include: { asset: true } },
      slides: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCampaign(orgId: string, id: string) {
  return db.campaign.findFirst({
    where: { id, orgId },
    include: {
      scheduledPosts: true,
      assets: { include: { asset: true }, orderBy: { sortOrder: "asc" } },
      slides: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function createCampaign(
  orgId: string,
  data: {
    title: string;
    caption?: string;
    platforms: string[];
    scheduledAt?: Date;
    assetIds?: string[];
  }
) {
  const campaign = await db.campaign.create({
    data: {
      orgId,
      title: data.title,
      caption: data.caption,
      platforms: data.platforms,
      scheduledAt: data.scheduledAt,
      status: data.scheduledAt ? "scheduled" : "draft",
    },
  });

  if (data.assetIds?.length) {
    await db.campaignAsset.createMany({
      data: data.assetIds.map((assetId, i) => ({
        campaignId: campaign.id,
        assetId,
        sortOrder: i,
      })),
    });
  }

  if (data.scheduledAt) {
    await db.scheduledPost.createMany({
      data: data.platforms.map((platform) => ({
        orgId,
        campaignId: campaign.id,
        platform,
        scheduledAt: data.scheduledAt!,
        status: "queued",
      })),
    });
  }

  return getCampaign(orgId, campaign.id);
}

export async function updateCampaign(
  orgId: string,
  id: string,
  data: Partial<{
    title: string;
    caption: string;
    platforms: string[];
    status: string;
    scheduledAt: Date | null;
  }>
) {
  return db.campaign.updateMany({
    where: { id, orgId },
    data,
  });
}
