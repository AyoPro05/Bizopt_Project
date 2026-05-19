import { db } from "@/lib/db";

export async function listCarouselSlides(orgId: string, campaignId: string) {
  return db.carouselSlide.findMany({
    where: { orgId, campaignId },
    include: { mediaAsset: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createCarouselSlide(
  orgId: string,
  campaignId: string,
  data: { caption?: string; mediaAssetId?: string; sortOrder?: number }
) {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, orgId } });
  if (!campaign) throw new Error("Campaign not found");

  const count = await db.carouselSlide.count({ where: { campaignId } });
  return db.carouselSlide.create({
    data: {
      orgId,
      campaignId,
      caption: data.caption,
      mediaAssetId: data.mediaAssetId,
      sortOrder: data.sortOrder ?? count,
    },
    include: { mediaAsset: true },
  });
}

export async function updateCarouselSlide(
  orgId: string,
  slideId: string,
  data: Partial<{ caption: string; mediaAssetId: string | null; sortOrder: number }>
) {
  return db.carouselSlide.updateMany({
    where: { id: slideId, orgId },
    data,
  });
}

export async function reorderCarouselSlides(
  orgId: string,
  campaignId: string,
  orderedIds: string[]
) {
  await Promise.all(
    orderedIds.map((id, sortOrder) =>
      db.carouselSlide.updateMany({
        where: { id, orgId, campaignId },
        data: { sortOrder },
      })
    )
  );
  return listCarouselSlides(orgId, campaignId);
}

export async function deleteCarouselSlide(orgId: string, slideId: string) {
  return db.carouselSlide.deleteMany({ where: { id: slideId, orgId } });
}
