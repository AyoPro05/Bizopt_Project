import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ComplianceSummary } from "@/services/compliance/checks";

export function ComplianceChecklistCard({ summary }: { summary: ComplianceSummary }) {
  return (
    <Card>
      <h3 className="font-display text-lg font-semibold">Checklist</h3>
      <ul className="mt-4 space-y-2">
        {summary.checks.length === 0 ? (
          <li className="text-sm text-[var(--color-ink-muted)]">
            Run checks to populate your compliance checklist.
          </li>
        ) : (
          summary.checks.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <span className="font-medium">{c.title}</span>
              <Badge status={c.status} />
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
