import { db } from "@/lib/db";

/** Operator authorization is enforced by the calling staff route. No message bodies leave here. */
export async function aggregateDeliveryMetrics(now = new Date()) {
  const [oldest, deadOutbox, states, attempts, latencies, events, unmatchedWebhooks] = await Promise.all([
    db.outboxEvent.findFirst({ where: { processingStatus: { in: ["pending", "processing"] }, availableAt: { lte: now } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.outboxEvent.count({ where: { processingStatus: "dead_letter" } }),
    db.notification.groupBy({ by: ["channel", "status"], _count: { _all: true } }),
    db.notificationAttempt.groupBy({ by: ["provider", "outcome"], _count: { _all: true } }),
    db.notification.findMany({ where: { channel: "EMAIL", sentAt: { not: null } }, orderBy: { sentAt: "desc" }, take: 1000, select: { createdAt: true, sentAt: true } }),
    db.outboxEvent.groupBy({ by: ["eventType"], where: { eventType: { in: ["identity.verification_requested", "identity.verified", "identity.password_reset_requested", "identity.password_changed", "billing.introductory_active", "billing.monthly_active"] } }, _count: { _all: true } }),
    db.providerWebhookEvent.count({ where: { provider: "resend", status: { in: ["pending", "unmatched"] } } }),
  ]);
  const count = (status: string) => states.filter(s => s.channel === "EMAIL" && s.status === status).reduce((sum, row) => sum + row._count._all, 0);
  const emailTotal = states.filter(s => s.channel === "EMAIL").reduce((sum, row) => sum + row._count._all, 0);
  const acceptedAttempts = attempts.filter(a => a.outcome === "accepted").reduce((sum, row) => sum + row._count._all, 0);
  const attempted = attempts.reduce((sum, row) => sum + row._count._all, 0);
  const times = latencies.filter(row => row.sentAt).map(row => Math.max(0, row.sentAt!.getTime() - row.createdAt.getTime()));
  return {
    observedAt: now.toISOString(), oldestPendingOutboxAgeSeconds: oldest ? Math.max(0, (now.getTime() - oldest.createdAt.getTime()) / 1000) : 0,
    deadLetterCount: deadOutbox + states.filter(s => s.status === "dead_letter").reduce((sum, row) => sum + row._count._all, 0),
    reconciliationRequiredCount: count("reconciliation_required"), unmatchedWebhooks,
    emailCount: emailTotal, emailAcceptedAttemptCount: acceptedAttempts, emailDeliveredCount: count("delivered"), emailBounceCount: count("bounced"), emailComplaintCount: count("complained"),
    providerAcceptanceRate: attempted ? acceptedAttempts / attempted : null,
    observedDeliveryRate: emailTotal ? count("delivered") / emailTotal : null,
    observedBounceRate: emailTotal ? count("bounced") / emailTotal : null,
    observedComplaintRate: emailTotal ? count("complained") / emailTotal : null,
    meanEnqueueToAcceptanceMs: times.length ? times.reduce((sum, ms) => sum + ms, 0) / times.length : null, latencySampleCount: times.length,
    states, attempts, lifecycleEventCounts: events.map(row => ({ type: row.eventType, count: row._count._all })),
    unavailable: ["stripe_reconciliation_drift", "password_reset_completion_rate", "cohort_introductory_to_paid_conversion", "invalid_signature_rate_requires_http_log_metrics"],
  };
}
