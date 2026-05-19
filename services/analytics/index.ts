import { db } from "@/lib/db";

export async function getOrgAnalytics(orgId: string) {
  const [campaigns, published, scheduled, failed, socialAccounts, aiGens] =
    await Promise.all([
      db.campaign.count({ where: { orgId } }),
      db.scheduledPost.count({ where: { orgId, status: "published" } }),
      db.scheduledPost.count({ where: { orgId, status: "queued" } }),
      db.scheduledPost.count({ where: { orgId, status: "failed" } }),
      db.socialAccount.count({ where: { orgId, disconnectedAt: null } }),
      db.aiGeneration.count({ where: { orgId, status: "completed" } }),
    ]);

  const recentCampaigns = await db.campaign.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { id: true, title: true, status: true, platforms: true, updatedAt: true },
  });

  const platformBreakdown = await db.scheduledPost.groupBy({
    by: ["platform"],
    where: { orgId, status: "published" },
    _count: { platform: true },
  });

  return {
    summary: {
      totalCampaigns: campaigns,
      publishedPosts: published,
      queuedPosts: scheduled,
      failedPosts: failed,
      connectedAccounts: socialAccounts,
      aiGenerations: aiGens,
      successRate:
        published + failed > 0
          ? Math.round((published / (published + failed)) * 100)
          : 100,
    },
    platformBreakdown: platformBreakdown.map((p) => ({
      platform: p.platform,
      count: p._count.platform,
    })),
    recentCampaigns,
  };
}
