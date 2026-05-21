import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { computeBusinessHealthScore } from "@/services/growth/scoring";

export type ComplianceSummary = {
  status: "pass" | "warn" | "fail";
  passCount: number;
  warnCount: number;
  failCount: number;
  checks: {
    id: string;
    title: string;
    status: string;
    severity: string;
    remediation: string | null;
    checkedAt: Date;
  }[];
};

async function auditLog(orgId: string, action: string, meta?: Prisma.InputJsonValue) {
  await db.auditLog.create({
    data: {
      orgId,
      action,
      entity: "compliance",
      metadata: meta,
    },
  });
}

export async function getComplianceSummary(orgId: string): Promise<ComplianceSummary> {
  const checks = await db.complianceCheck.findMany({
    where: { orgId },
    orderBy: { checkedAt: "desc" },
    take: 50,
  });

  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const failCount = checks.filter((c) => c.status === "fail").length;

  let status: ComplianceSummary["status"] = "pass";
  if (failCount > 0) status = "fail";
  else if (warnCount > 0) status = "warn";

  return {
    status,
    passCount,
    warnCount,
    failCount,
    checks: checks.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      severity: c.severity,
      remediation: c.remediation,
      checkedAt: c.checkedAt,
    })),
  };
}

export async function runComplianceChecks(orgId: string, userId?: string) {
  const [subscription, entitlement, devices, platforms, payments] = await Promise.all([
    db.subscription.findUnique({ where: { orgId } }),
    db.entitlement.findUnique({ where: { orgId } }),
    db.device.count({ where: { orgId, revokedAt: null } }),
    db.platformAccount.count({ where: { orgId, disconnectedAt: null } }),
    db.payment.count({ where: { orgId, status: "succeeded" } }),
  ]);

  const rules = await db.complianceRule.findMany({ where: { active: true } });
  const results: ComplianceSummary["checks"] = [];

  for (const rule of rules) {
    let status: "pass" | "warn" | "fail" = "pass";
    let details = "";
    let remediation: string | null = null;

    switch (rule.key) {
      case "billing_active":
        if (!entitlement?.active && entitlement?.userFacingState !== "trialing") {
          status = "fail";
          details = "No active subscription or trial.";
          remediation = "Complete Stripe checkout and wait for webhook confirmation.";
        }
        break;
      case "payment_method_on_file":
        if (!subscription?.stripePaymentMethodId && subscription?.requiresPaymentMethod) {
          status = "warn";
          details = "Payment method not stored on subscription.";
          remediation = "Open billing portal and add a default payment method.";
        }
        break;
      case "device_bound":
        if (devices === 0) {
          status = "warn";
          details = "No device bound to this workspace.";
          remediation = "Complete device check after login.";
        }
        break;
      case "platform_connected":
        if (platforms === 0) {
          status = "warn";
          details = "No social platforms connected.";
          remediation = "Connect LinkedIn or Instagram in Integrations.";
        }
        break;
      case "publish_ready":
        if (platforms === 0) {
          status = "fail";
          details = "Cannot publish without a connected platform.";
          remediation = "Connect at least one platform before scheduling posts.";
        }
        break;
      case "refund_policy_ack":
        if (payments === 0 && entitlement?.userFacingState === "pending_payment") {
          status = "pass";
          details = "Pre-revenue workspace.";
        }
        break;
      default:
        status = "pass";
        details = rule.description;
    }

    const check = await db.complianceCheck.create({
      data: {
        orgId,
        ruleId: rule.id,
        status,
        severity: rule.severity,
        title: rule.title,
        details,
        remediation,
      },
    });

    if (status !== "pass") {
      await db.complianceFinding.create({
        data: {
          orgId,
          complianceCheckId: check.id,
          finding: details || rule.description,
          severity: rule.severity,
        },
      });
      await db.complianceRecommendation.create({
        data: {
          orgId,
          complianceCheckId: check.id,
          recommendation: remediation ?? "Review this item in Compliance Center.",
        },
      });

      if (status === "fail") {
        await db.riskEvent.create({
          data: {
            orgId,
            category: "compliance",
            severity: rule.severity,
            title: rule.title,
            details,
          },
        });
      }
    }

    results.push({
      id: check.id,
      title: check.title,
      status: check.status,
      severity: check.severity,
      remediation: check.remediation,
      checkedAt: check.checkedAt,
    });
  }

  const health = await computeBusinessHealthScore(orgId);
  await db.growthMetricSnapshot.create({
    data: {
      orgId,
      metricKey: "business_health",
      metricValue: health,
      source: "compliance_run",
    },
  });

  await auditLog(orgId, "compliance.run", { userId, checkCount: results.length });

  return getComplianceSummary(orgId);
}
