import { processSeoAudit } from "../services/seo/jobs";
import { db } from "../lib/db";

// One bounded tick. Invoke repeatedly with a process scheduler or managed cron.
processSeoAudit()
  .then((processed) => console.log(JSON.stringify({ worker: "seo", processed })))
  .catch(() => { console.error("SEO worker failed. Check database connectivity."); process.exitCode = 1; })
  .finally(() => db.$disconnect());
