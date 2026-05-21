import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { getComplianceSummary } from "@/services/compliance/checks";
import { listComplianceFindings } from "@/services/compliance/rules";
import { AppTopbar } from "@/components/shell/app-topbar";
import { ComplianceChecklistCard } from "@/components/compliance/checklist-card";
import { ComplianceRiskPanel } from "@/components/compliance/risk-panel";
import { RunChecksButton } from "@/components/compliance/run-checks-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function ComplianceCenterPage() {
  const session = await getServerSession(authOptions);
  const org = session?.user?.id
    ? await getUserPrimaryOrg(session.user.id)
    : null;
  if (!org) return <p>No workspace found.</p>;

  const [summary, findings] = await Promise.all([
    getComplianceSummary(org.id),
    listComplianceFindings(org.id),
  ]);

  return (
    <div>
      <AppTopbar title="Compliance Center" />
      <p className="mb-6 text-sm text-[var(--color-ink-muted)]">
        Startup readiness checks with pass, warn, and fail outcomes, remediation guidance, and an
        audit trail.
      </p>

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-ink-muted)]">Overall status</p>
          <div className="mt-2">
            <Badge status={summary.status} />
          </div>
        </div>
        <RunChecksButton />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ComplianceChecklistCard summary={summary} />
        <ComplianceRiskPanel findings={findings} />
      </div>

      {summary.checks.some((c) => c.remediation) && (
        <Card className="mt-6">
          <h3 className="font-display text-lg font-semibold">Remediation</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {summary.checks
              .filter((c) => c.remediation)
              .map((c) => (
                <li key={c.id}>
                  <p className="font-medium">{c.title}</p>
                  <p className="mt-1 text-[var(--color-ink-muted)]">{c.remediation}</p>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
