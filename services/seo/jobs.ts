import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { auditSite } from "./audit";
import { SeoError } from "./errors";

// Longer than the crawl's hard duration limit, short enough to recover a dead worker.
const LEASE_MS = 90_000;

export async function processSeoAudit(): Promise<boolean> {
  const now = new Date();
  const expired = new Date(now.getTime() - LEASE_MS);
  const due = { OR: [
    { status: "queued", nextAttemptAt: { lte: now } },
    { status: "running", lockedAt: { lt: expired } },
  ] };
  const job = await db.seoAuditRun.findFirst({ where: due, orderBy: { createdAt: "asc" } });
  if (!job) return false;
  const claimed = await db.seoAuditRun.updateMany({ where: { id: job.id, orgId: job.orgId, ...due }, data: { status: "running", lockedAt: now, attempts: { increment: 1 }, error: null } });
  if (!claimed.count) return false;
  const lease = { id: job.id, orgId: job.orgId, status: "running", lockedAt: now };
  try {
    const [site, membership] = await Promise.all([
      db.seoSite.findFirst({ where: { id: job.siteId, orgId: job.orgId } }),
      db.orgMember.findUnique({ where: { orgId_userId: { orgId: job.orgId, userId: job.requestedBy } } }),
    ]);
    if (!site?.authorisedAt || !membership || !["owner", "admin", "member"].includes(membership.role)) throw new SeoError("Website authorisation or workspace access was revoked.", 403);
    if (job.attempts >= 3) throw new SeoError("Audit recovery limit reached. Start a new audit.");
    const result = await auditSite(site.url);
    // Cancellation or a replaced lease prevents stale worker output from becoming visible.
    await db.seoAuditRun.updateMany({ where: lease, data: { status: result.limited ? "partial" : "complete", result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue, lockedAt: null, finishedAt: new Date() } });
    return true;
  } catch (error) {
    const permanent = error instanceof SeoError || (error instanceof Error && /blocked|private|public|robots|scheme|scope|HTTPS|redirect|policy|permission/i.test(error.message));
    const failed = permanent || job.attempts + 1 >= 3;
    await db.seoAuditRun.updateMany({ where: lease, data: {
      status: failed ? "failed" : "queued",
      lockedAt: null,
      finishedAt: failed ? new Date() : null,
      nextAttemptAt: new Date(Date.now() + 30_000 * 2 ** job.attempts + Math.floor(Math.random() * 5000)),
      error: error instanceof SeoError ? error.message : "The public-page audit could not finish. Check website accessibility, robots rules and the authorised HTTPS scope, then retry.",
    } });
    return true;
  }
}
