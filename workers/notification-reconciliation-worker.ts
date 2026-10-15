import { runNotificationReconciliationTick } from "../services/notifications/delivery";
import { notificationConfig } from "../services/notifications/config";
import { db } from "../lib/db";

notificationConfig();
runNotificationReconciliationTick().then(result => console.log(JSON.stringify({ worker: "notification-reconciliation", ...result }))).catch(() => { console.error("Notification reconciliation unavailable."); process.exitCode = 1; }).finally(() => db.$disconnect());
