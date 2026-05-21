import { db } from "@/lib/db";
import { publishToPlatform } from "@/services/platforms/publish";

export async function schedulePublish(
  orgId: string,
  campaignId: string,
  scheduledAt: Date,
  platforms: string[]
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, orgId },
  });
  if (!campaign) throw new Error("Campaign not found");

  await db.campaign.update({
    where: { id: campaignId },
    data: { scheduledAt, status: "scheduled" },
  });

  const posts = await Promise.all(
    platforms.map((platform) =>
      db.scheduledPost.create({
        data: {
          orgId,
          campaignId,
          platform,
          scheduledAt,
          status: "queued",
        },
      })
    )
  );

  return posts;
}

export async function processDuePosts(limit = 10) {
  const due = await db.scheduledPost.findMany({
    where: {
      status: "queued",
      scheduledAt: { lte: new Date() },
    },
    include: { campaign: true },
    take: limit,
    orderBy: { scheduledAt: "asc" },
  });

  const results = [];
  for (const post of due) {
    try {
      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: "publishing" },
      });

      const result = await publishToPlatform(post.platform, {
        orgId: post.orgId,
        caption: post.campaign?.caption ?? "",
        campaignId: post.campaignId ?? undefined,
      });

      const updated = await db.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: result.success ? "published" : "failed",
          publishedAt: result.success ? new Date() : null,
          externalId: result.externalId,
          errorMessage: result.error,
        },
      });
      results.push(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: "failed", errorMessage: message, retryCount: { increment: 1 } },
      });
    }
  }
  return results;
}

export async function retryPost(postId: string, orgId: string) {
  const post = await db.scheduledPost.findFirst({
    where: { id: postId, orgId },
    include: { campaign: true },
  });
  if (!post) throw new Error("Post not found");

  await db.scheduledPost.update({
    where: { id: postId },
    data: { status: "queued", errorMessage: null },
  });

  return post;
}

export async function getPublishStatus(orgId: string, campaignId?: string) {
  return db.scheduledPost.findMany({
    where: {
      orgId,
      ...(campaignId ? { campaignId } : {}),
    },
    orderBy: { scheduledAt: "desc" },
    take: 50,
  });
}
