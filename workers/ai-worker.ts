import { db } from "../lib/db";
import { logger } from "../lib/logger";

async function run() {
  const pending = await db.aiGeneration.findMany({
    where: { status: "pending" },
    take: 10,
  });
  logger.info("ai_worker_start", { count: pending.length });
  for (const job of pending) {
    await db.aiGeneration.update({
      where: { id: job.id },
      data: { status: "processing" },
    });
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error("ai_worker_crash", { error: String(err) });
    process.exit(1);
  });
