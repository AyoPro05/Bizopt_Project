import { Card } from "@/components/ui/card";
import { Activity } from "lucide-react";

export function BusinessHealthCard({ score }: { score: number }) {
  const tone =
    score >= 70 ? "text-emerald-600 dark:text-emerald-400" : score >= 45 ? "text-amber-600" : "text-red-600";

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-[var(--color-ink-muted)]">Business health</p>
          <p className={`mt-1 font-display text-3xl font-semibold ${tone}`}>{score}</p>
        </div>
        <Activity className="h-5 w-5 text-[var(--color-accent)]" />
      </div>
      <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
        Billing, devices, platforms, and compliance signals combined.
      </p>
    </Card>
  );
}
