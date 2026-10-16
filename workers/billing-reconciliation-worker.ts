import { logger } from "../lib/logger";
import { reconcileBillingBatch } from "../services/billing/reconciliation";
reconcileBillingBatch().then(result => {
  logger.info("billing_reconciliation_complete", result);
  if (result.failed) process.exitCode = 1;
}).catch(() => { logger.error("billing_reconciliation_crash"); process.exitCode = 1; });
