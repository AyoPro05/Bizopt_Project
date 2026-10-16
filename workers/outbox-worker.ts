import { runOutboxTick } from "../services/automation/dispatcher";
import { notificationConfig } from "../services/notifications/config";
import { db } from "../lib/db";

notificationConfig();
runOutboxTick().then(processed => console.log(JSON.stringify({ worker: "outbox", processed }))).catch(() => { console.error("Outbox worker unavailable."); process.exitCode = 1; }).finally(() => db.$disconnect());
