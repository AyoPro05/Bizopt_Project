import { Card } from "@/components/ui/card";

type Snapshot = { metricKey: string; metricValue: number; createdAt: Date | string };

export function PredictionChart({ snapshots }: { snapshots: Snapshot[] }) {
  const scores = snapshots
    .filter((s) => s.metricKey === "growth_score" || s.metricKey === "business_health")
    .slice(0, 12)
    .reverse();

  if (scores.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-ink-muted)]">No metric history yet.</p>
      </Card>
    );
  }

  const max = Math.max(...scores.map((s) => s.metricValue), 100);

  return (
    <Card>
      <h3 className="font-display text-lg font-semibold">Score history</h3>
      <div className="mt-6 flex h-32 items-end gap-2">
        {scores.map((s, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-[var(--color-accent)] opacity-80"
              style={{ height: `${Math.max(8, (s.metricValue / max) * 100)}%` }}
              title={`${s.metricKey}: ${s.metricValue}`}
            />
            <span className="text-[10px] text-[var(--color-ink-muted)]">
              {typeof s.createdAt === "string"
                ? new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : s.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
