import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ComplianceRiskPanel({
  findings,
}: {
  findings: {
    id: string;
    finding: string;
    severity: string;
    createdAt: Date;
    check?: { title: string };
  }[];
}) {
  return (
    <Card>
      <h3 className="font-display text-lg font-semibold">Risk findings</h3>
      {findings.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-ink-muted)]">No open findings.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {findings.map((f) => (
            <li
              key={f.id}
              className="rounded-xl border border-[var(--color-border)] p-4 text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge status={f.severity === "high" ? "failed" : "scheduled"} />
                {f.check?.title && (
                  <span className="text-xs text-[var(--color-ink-muted)]">{f.check.title}</span>
                )}
              </div>
              <p className="mt-2">{f.finding}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
