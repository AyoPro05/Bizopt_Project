import { logger } from "../lib/logger";
import { processDuePosts } from "../services/publishing";

async function run() {
  logger.info("queue_worker_tick");
  await processDuePosts(50);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error("queue_worker_crash", { error: String(err) });
    process.exit(1);
  });
