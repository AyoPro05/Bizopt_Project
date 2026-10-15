import { processInviteDelivery } from "../services/workspace/delivery";
import { db } from "../lib/db";
processInviteDelivery().then((processed) => console.log(JSON.stringify({ worker: "invitation", processed }))).catch(() => { console.error("Invitation worker unavailable."); process.exitCode = 1; }).finally(() => db.$disconnect());
