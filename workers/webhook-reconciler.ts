import { logger } from "../lib/logger";
import { processStoredStripeEvent } from "../services/billing/webhook-inbox";
async function reconcile() {
  let processed = 0;
  while (processed < 20 && await processStoredStripeEvent()) processed += 1;
  logger.info("webhook_reconciler_complete", { processed });
}
reconcile().catch(() => { logger.error("webhook_reconciler_crash"); process.exitCode = 1; });
