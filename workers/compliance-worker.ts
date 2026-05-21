/**
 * Optional background worker: run compliance checks for entitled orgs.
 * Run: tsx workers/compliance-worker.ts
 */
import { db } from "@/lib/db";
import { runComplianceChecks } from "@/services/compliance/checks";

async function main() {
  const orgs = await db.entitlement.findMany({
    where: { active: true },
    select: { orgId: true },
    take: 50,
  });

  for (const { orgId } of orgs) {
    await runComplianceChecks(orgId);
    console.log(`Compliance checks completed for ${orgId}`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
