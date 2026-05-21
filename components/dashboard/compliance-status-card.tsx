import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import type { ComplianceSummary } from "@/services/compliance/checks";

export function ComplianceStatusCard({ summary }: { summary: ComplianceSummary }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-[var(--color-ink-muted)]">Compliance</p>
          <div className="mt-2">
            <Badge status={summary.status} />
          </div>
        </div>
        <ShieldCheck className="h-5 w-5 text-[var(--color-accent)]" />
      </div>
      <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
        {summary.passCount} pass · {summary.warnCount} warn · {summary.failCount} fail
      </p>
      <Link
        href="/compliance-center"
        className="mt-4 inline-block text-sm font-medium text-[var(--color-accent)] hover:underline"
      >
        Open Compliance Center →
      </Link>
    </Card>
  );
}
