import { db } from "@/lib/db";

export async function listGrowthRecommendations(orgId: string, limit = 20) {
  return db.growthRecommendation.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listGrowthSnapshots(orgId: string, limit = 30) {
  return db.growthMetricSnapshot.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
