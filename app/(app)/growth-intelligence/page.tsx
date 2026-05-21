import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { getGrowthDashboard } from "@/services/growth/scoring";
import { listGrowthSnapshots } from "@/services/growth/recommendations";
import { AppTopbar } from "@/components/shell/app-topbar";
import { Card } from "@/components/ui/card";
import { NextBestActionPanel } from "@/components/growth/next-best-action";
import { PredictionChart } from "@/components/growth/prediction-chart";
import { RunPredictButton } from "@/components/growth/run-predict-button";
import { BusinessHealthCard } from "@/components/dashboard/business-health-card";
import { GrowthScoreCard } from "@/components/dashboard/growth-score-card";

export default async function GrowthIntelligencePage() {
  const session = await getServerSession(authOptions);
  const org = session?.user?.id
    ? await getUserPrimaryOrg(session.user.id)
    : null;
  if (!org) return <p>No workspace found.</p>;

  const [dashboard, snapshots] = await Promise.all([
    getGrowthDashboard(org.id),
    listGrowthSnapshots(org.id),
  ]);

  const pred = dashboard.latestPrediction;

  return (
    <div>
      <AppTopbar title="Growth Intelligence" />
      <p className="mb-6 text-sm text-[var(--color-ink-muted)]">
        Predict content success, campaign performance, and next-best actions with explainable
        scores.
      </p>

      <div className="mb-6">
        <RunPredictButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <GrowthScoreCard data={dashboard} />
        <BusinessHealthCard score={dashboard.businessHealthScore} />
      </div>

      {pred && (
        <Card className="mt-6">
          <h2 className="font-display text-lg font-semibold">{pred.label ?? "Latest prediction"}</h2>
          <p className="mt-2 text-3xl font-semibold">{pred.score}/100</p>
          {pred.explanation && (
            <p className="mt-3 text-sm text-[var(--color-ink-muted)]">{pred.explanation}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {pred.bestPostHourUtc != null && (
              <span>
                Best post hour (UTC): <strong>{pred.bestPostHourUtc}:00</strong>
              </span>
            )}
            {pred.recommendedFormats.length > 0 && (
              <span>
                Formats: <strong>{pred.recommendedFormats.join(", ")}</strong>
              </span>
            )}
          </div>
        </Card>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <NextBestActionPanel actions={dashboard.nextActions} />
        <PredictionChart snapshots={snapshots} />
      </div>
    </div>
  );
}
