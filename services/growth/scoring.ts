import { db } from "@/lib/db";
import { countConnectedPlatforms } from "@/lib/platform-accounts";
import { getOrgAnalytics } from "@/services/analytics";

export type GrowthDashboard = {
  growthScore: number;
  businessHealthScore: number;
  latestPrediction: {
    id: string;
    score: number;
    label: string | null;
    explanation: string | null;
    bestPostHourUtc: number | null;
    recommendedFormats: string[];
    createdAt: Date;
  } | null;
  nextActions: { id: string; recommendation: string; priority: string }[];
};

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function computeGrowthScore(orgId: string): Promise<number> {
  const [analytics, briefCount, campaignCount, entitled] = await Promise.all([
    getOrgAnalytics(orgId),
    db.ideaBrief.count({ where: { orgId } }),
    db.campaign.count({ where: { orgId, status: { not: "draft" } } }),
    db.entitlement.findUnique({ where: { orgId } }),
  ]);

  let score = 40;
  score += Math.min(briefCount * 4, 20);
  score += Math.min(campaignCount * 5, 15);
  score += Math.min(analytics.summary.successRate * 0.2, 20);
  if (entitled?.active || entitled?.userFacingState === "trialing") score += 5;

  return clamp(score);
}

export async function computeBusinessHealthScore(orgId: string): Promise<number> {
  const [subscription, devices, platforms, complianceFails] = await Promise.all([
    db.subscription.findUnique({ where: { orgId } }),
    db.device.count({ where: { orgId, revokedAt: null } }),
    countConnectedPlatforms(orgId),
    db.complianceCheck.count({ where: { orgId, status: "fail" } }),
  ]);

  let score = 50;
  if (subscription?.status === "active" || subscription?.status === "trialing") score += 20;
  if (devices > 0) score += 10;
  if (platforms > 0) score += 15;
  score -= complianceFails * 8;

  return clamp(score);
}

export async function getGrowthDashboard(orgId: string): Promise<GrowthDashboard> {
  const [growthScore, businessHealthScore, latestPrediction, nextActions] =
    await Promise.all([
      computeGrowthScore(orgId),
      computeBusinessHealthScore(orgId),
      db.growthPrediction.findFirst({
        where: { orgId },
        orderBy: { createdAt: "desc" },
      }),
      db.growthRecommendation.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  return {
    growthScore,
    businessHealthScore,
    latestPrediction: latestPrediction
      ? {
          id: latestPrediction.id,
          score: latestPrediction.score,
          label: latestPrediction.label,
          explanation: latestPrediction.explanation,
          bestPostHourUtc: latestPrediction.bestPostHourUtc,
          recommendedFormats: latestPrediction.recommendedFormats,
          createdAt: latestPrediction.createdAt,
        }
      : null,
    nextActions: nextActions.map((a) => ({
      id: a.id,
      recommendation: a.recommendation,
      priority: a.priority,
    })),
  };
}

export async function predictGrowth(
  orgId: string,
  options?: { briefId?: string; campaignId?: string }
) {
  const score = await computeGrowthScore(orgId);
  const analytics = await getOrgAnalytics(orgId);

  const predictedReach = 500 + score * 12 + analytics.summary.publishedPosts * 40;
  const predictedEngagement = 2 + score * 0.08;
  const predictedConversion = 0.5 + score * 0.02;

  const label =
    score >= 75 ? "High potential" : score >= 50 ? "Moderate potential" : "Needs optimization";

  const explanation = [
    `Growth score ${score}/100 based on content volume, publish success (${analytics.summary.successRate}%), and subscription health.`,
    score >= 60
      ? "Carousel and short video formats are likely to outperform text-only posts for your current mix."
      : "Add 2+ AI ideas and schedule one multi-platform campaign to lift predicted reach.",
    "Best posting window estimated from typical B2B engagement patterns (Tue–Thu mornings).",
  ].join(" ");

  const prediction = await db.growthPrediction.create({
    data: {
      orgId,
      briefId: options?.briefId,
      campaignId: options?.campaignId,
      score,
      predictedReach,
      predictedEngagement,
      predictedConversion,
      label,
      explanation,
      bestPostHourUtc: 14,
      recommendedFormats: ["carousel", "video", "thread"],
    },
  });

  const actions = [
    {
      recommendation: "Schedule your top variant on LinkedIn + Instagram within 48 hours.",
      priority: "high",
    },
    {
      recommendation: "Turn the carousel outline into 5 slides before publishing.",
      priority: "medium",
    },
    {
      recommendation: "Run Compliance Center after connecting billing and integrations.",
      priority: "low",
    },
  ];

  await db.growthRecommendation.createMany({
    data: actions.map((a) => ({
      orgId,
      growthPredictionId: prediction.id,
      recommendation: a.recommendation,
      priority: a.priority,
    })),
  });

  await db.growthMetricSnapshot.create({
    data: {
      orgId,
      metricKey: "growth_score",
      metricValue: score,
      source: "predict",
    },
  });

  return db.growthPrediction.findFirst({
    where: { id: prediction.id },
    include: { recommendations: true },
  });
}
