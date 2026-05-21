/**
 * Optional background worker: refresh growth snapshots for active orgs.
 * Run: npm run worker:growth (add script) or tsx workers/growth-worker.ts
 */
import { db } from "@/lib/db";
import { predictGrowth } from "@/services/growth/scoring";

async function main() {
  const orgs = await db.entitlement.findMany({
    where: { active: true },
    select: { orgId: true },
    take: 50,
  });

  for (const { orgId } of orgs) {
    await predictGrowth(orgId);
    console.log(`Growth snapshot updated for ${orgId}`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
