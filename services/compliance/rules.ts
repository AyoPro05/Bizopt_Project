import { db } from "@/lib/db";

export async function listComplianceRules() {
  return db.complianceRule.findMany({
    where: { active: true },
    orderBy: { severity: "desc" },
  });
}

export async function listComplianceFindings(orgId: string, limit = 30) {
  return db.complianceFinding.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { check: true },
  });
}
