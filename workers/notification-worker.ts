import { runNotificationTick } from "../services/notifications/delivery";
import { notificationConfig } from "../services/notifications/config";
import { db } from "../lib/db";

notificationConfig();
runNotificationTick().then(processed => console.log(JSON.stringify({ worker: "notification", processed }))).catch(() => { console.error("Notification worker unavailable."); process.exitCode = 1; }).finally(() => db.$disconnect());
