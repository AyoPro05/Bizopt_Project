import { emitWorkspaceOperation } from "@/services/operational-events";
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
      const claim = await db.scheduledPost.updateMany({ where: { id: post.id, orgId: post.orgId, status: "queued" }, data: { status: "publishing" } });
      if (!claim.count) continue;

      const result = await publishToPlatform(post.platform, {
        orgId: post.orgId,
        caption: post.campaign?.caption ?? "",
        campaignId: post.campaignId ?? undefined,
      });

      const updated = await db.$transaction(async tx => {
        const row = await tx.scheduledPost.update({ where: { id: post.id }, data: { status: result.success ? "published" : "failed", publishedAt: result.success ? new Date() : null, externalId: result.externalId, errorMessage: result.success ? null : "Publishing could not be confirmed. Review the connection and post before retrying.", ...(!result.success ? { retryCount: { increment: 1 } } : {}) } });
        if (!result.success) await emitWorkspaceOperation(tx, post.orgId, post.retryCount + 1 >= 3 ? "publishing.exhausted" : "publishing.failed", post.id, `publishing-failure:${post.id}:${post.retryCount + 1}`, { platform: post.platform, errorCode: "PUBLISH_NOT_CONFIRMED" });
        return row;
      });
      results.push(updated);
    } catch {
      await db.$transaction(async tx => {
        await tx.scheduledPost.update({ where: { id: post.id }, data: { status: "failed", errorMessage: "Publishing could not be confirmed. Check the provider before retrying.", retryCount: { increment: 1 } } });
        await emitWorkspaceOperation(tx, post.orgId, post.retryCount + 1 >= 3 ? "publishing.exhausted" : "publishing.failed", post.id, `publishing-failure:${post.id}:${post.retryCount + 1}`, { platform: post.platform, errorCode: "PUBLISH_NOT_CONFIRMED" });
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
