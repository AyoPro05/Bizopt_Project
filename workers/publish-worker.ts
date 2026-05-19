import { logger } from "../lib/logger";
import { processDuePosts } from "../services/publishing";

async function run() {
  logger.info("publish_worker_start");
  const results = await processDuePosts(25);
  logger.info("publish_worker_done", { processed: results.length });
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error("publish_worker_crash", { error: String(err) });
    process.exit(1);
  });
