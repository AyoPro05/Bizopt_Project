import { db } from "@/lib/db";

export async function computeHomeDecisionCards(orgId: string, _forceRefresh = true) {
  const [entitlement, subscription, drafts, recentPrediction, failingChecks, warningChecks] = await Promise.all([
    db.entitlement.findUnique({ where: { orgId } }),
    db.subscription.findUnique({ where: { orgId } }),
    db.workspaceSession.findMany({
      where: {
        orgId,
        stage: { in: ["compare", "edit", "schedule"] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { lastInteractionAt: "desc" },
    }),
    db.growthPrediction.findFirst({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    }),
    db.complianceCheck.count({ where: { orgId, status: "fail" } }),
    db.complianceCheck.count({ where: { orgId, status: "warn" } }),
  ]);

  const businessHealthData = {
    status: entitlement?.active ? "healthy" : "setup_needed",
    billingStatus: subscription?.status ?? "pending_payment",
    hasConnectedPlatforms: (await db.platformAccount.count({ where: { orgId } })) > 0,
    businessProfileComplete: (await db.businessProfile.count({ where: { orgId } })) > 0,
  };

  const growthForecastData = {
    score: recentPrediction?.score ?? 0,
    confidence: recentPrediction?.confidence ?? 0,
    trend: "stable",
    bestPostHour: recentPrediction?.bestPostHourUtc,
    recommendedAction: recentPrediction?.recommendedAction,
    reason: recentPrediction?.reason,
  };

  const complianceRiskData = {
    status: failingChecks > 0 ? "fail" : warningChecks > 0 ? "warn" : "pass",
    failingCount: failingChecks,
    warningCount: warningChecks,
    criticalIssue: (await db.complianceCheck.findFirst({
      where: { orgId, severity: "critical", status: { in: ["fail", "warn"] } },
      orderBy: { checkedAt: "desc" },
      select: { title: true },
    }))?.title,
  };

  const draftQueueData = {
    count: drafts.length,
    drafts: drafts.map((draft) => ({
      id: draft.id,
      prompt: draft.ideaPrompt.slice(0, 50) + (draft.ideaPrompt.length > 50 ? "..." : ""),
      stage: draft.stage,
      lastInteracted: draft.lastInteractionAt,
    })),
  };

  let nextAction = {
    title: "Create from Idea",
    description: "Start a new content idea",
    icon: "sparkles",
    cta: "/ai-studio",
  };

  if (failingChecks > 0) {
    nextAction = {
      title: "Fix Compliance Issue",
      description: `${failingChecks} critical issue${failingChecks !== 1 ? "s" : ""} need attention`,
      icon: "alert-circle",
      cta: "/compliance-center",
    };
  } else if (!businessHealthData.hasConnectedPlatforms) {
    nextAction = {
      title: "Connect Your First Platform",
      description: "Link LinkedIn, Instagram, or other platforms",
      icon: "link",
      cta: "/integrations",
    };
  } else if (drafts.length > 0) {
    nextAction = {
      title: "Resume Draft",
      description: `Continue from ${drafts[0]?.stage}`,
      icon: "arrow-right",
      cta: `/ai-studio?session=${drafts[0]?.id}`,
    };
  }

  await Promise.all([
    db.homeDecisionCard.upsert({
      where: { orgId_cardType: { orgId, cardType: "business_health" } },
      update: { data: businessHealthData, refreshedAt: new Date() },
      create: { orgId, cardType: "business_health", data: businessHealthData },
    }),
    db.homeDecisionCard.upsert({
      where: { orgId_cardType: { orgId, cardType: "growth_forecast" } },
      update: { data: growthForecastData, refreshedAt: new Date() },
      create: { orgId, cardType: "growth_forecast", data: growthForecastData },
    }),
    db.homeDecisionCard.upsert({
      where: { orgId_cardType: { orgId, cardType: "compliance_risk" } },
      update: { data: complianceRiskData, refreshedAt: new Date() },
      create: { orgId, cardType: "compliance_risk", data: complianceRiskData },
    }),
    db.homeDecisionCard.upsert({
      where: { orgId_cardType: { orgId, cardType: "draft_queue" } },
      update: { data: draftQueueData, refreshedAt: new Date() },
      create: { orgId, cardType: "draft_queue", data: draftQueueData },
    }),
    db.homeDecisionCard.upsert({
      where: { orgId_cardType: { orgId, cardType: "next_best_action" } },
      update: { data: nextAction, refreshedAt: new Date() },
      create: { orgId, cardType: "next_best_action", data: nextAction },
    }),
  ]);

  return {
    businessHealth: businessHealthData,
    growthForecast: growthForecastData,
    complianceRisk: complianceRiskData,
    draftQueue: draftQueueData,
    nextBestAction: nextAction,
  };
}

export async function getHomeDecisionCards(orgId: string) {
  const cards = await db.homeDecisionCard.findMany({ where: { orgId } });
  return Object.fromEntries(cards.map((card) => [card.cardType, card.data]));
}
