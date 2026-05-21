import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function NextBestActionPanel({
  actions,
}: {
  actions: { id: string; recommendation: string; priority: string }[];
}) {
  if (actions.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Run a prediction to get next-best actions for your content.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="font-display text-lg font-semibold">Next best actions</h3>
      <ul className="mt-4 space-y-3">
        {actions.map((a) => (
          <li
            key={a.id}
            className="rounded-xl border border-[var(--color-border)] p-4 text-sm"
          >
            <div className="mb-2">
              <Badge status={a.priority === "high" ? "failed" : a.priority} />
            </div>
            <p>{a.recommendation}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
