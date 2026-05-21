import Link from "next/link";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import type { GrowthDashboard } from "@/services/growth/scoring";

export function GrowthScoreCard({ data }: { data: GrowthDashboard }) {
  return (
    <Card className="flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-[var(--color-ink-muted)]">Growth score</p>
          <p className="mt-1 font-display text-3xl font-semibold">{data.growthScore}</p>
        </div>
        <TrendingUp className="h-5 w-5 text-[var(--color-accent)]" />
      </div>
      {data.latestPrediction?.label && (
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">{data.latestPrediction.label}</p>
      )}
      <Link
        href="/growth-intelligence"
        className="mt-4 text-sm font-medium text-[var(--color-accent)] hover:underline"
      >
        View Growth Intelligence →
      </Link>
    </Card>
  );
}
