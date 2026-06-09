import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { getOrgAnalytics } from "@/services/analytics";
import { getGrowthDashboard } from "@/services/growth/scoring";
import { getComplianceSummary } from "@/services/compliance/checks";
import { getResumableSessions } from "@/services/editor/draft-session";
import { GrowthScoreCard } from "@/components/dashboard/growth-score-card";
import { BusinessHealthCard } from "@/components/dashboard/business-health-card";
import { ComplianceStatusCard } from "@/components/dashboard/compliance-status-card";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppTopbar } from "@/components/shell/app-topbar";
import { DraftResumeCard } from "@/components/drafts/draft-resume-card";
import { Megaphone, Sparkles, CreditCard, Calendar } from "lucide-react";
import { BILLING, FREE_AI_GENERATIONS_LIMIT } from "@/lib/constants";
import { formatDate } from "@/lib/dates";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const org = userId ? await getUserPrimaryOrg(userId) : null;
  if (!org) return <p>No workspace found.</p>;

  const [
    analytics,
    entitlement,
    subscription,
    drafts,
    recentBriefs,
    briefCount,
    growthDashboard,
    complianceSummary,
  ] = await Promise.all([
    getOrgAnalytics(org.id),
    db.entitlement.findUnique({ where: { orgId: org.id } }),
    db.subscription.findUnique({ where: { orgId: org.id } }),
    userId ? getResumableSessions(org.id, userId) : [],
    db.ideaBrief.findMany({
      where: { orgId: org.id },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    db.ideaBrief.count({ where: { orgId: org.id } }),
    getGrowthDashboard(org.id),
    getComplianceSummary(org.id),
  ]);

  const state = entitlement?.userFacingState ?? "pending_payment";
  const isTrialing = state === "trialing";

  return (
    <div>
      <AppTopbar title="Home" />

      {!entitlement?.active && state !== "trialing" && (
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            Start your {BILLING.trialDisplayPrice} · {BILLING.trialDays}-day trial
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            Try AI Studio free first ({FREE_AI_GENERATIONS_LIMIT} ideas). Trial is{" "}
            {BILLING.trialDisplayPrice} for{" "}
            {BILLING.trialDays} days, then {BILLING.displayPrice}/mo.
          </p>
          <Link href="/billing" className="mt-4 inline-block">
            <Button>Start trial</Button>
          </Link>
        </Card>
      )}

      {isTrialing && subscription?.trialEndAt && (
        <Card className="mb-6 border-[var(--color-accent)] bg-[var(--color-accent-soft)]">
          <p className="font-medium">Trial active</p>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Renews at {BILLING.displayPrice}/mo on {formatDate(subscription.trialEndAt)} unless
            canceled.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge status={state} />
        <span className="text-sm text-[var(--color-ink-muted)]">
          {analytics.summary.publishedPosts} published · {analytics.summary.queuedPosts} queued
        </span>
      </div>

      {recentBriefs.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent ideas</h2>
            <Link href="/ai-studio" className="text-sm text-[var(--color-accent)] hover:underline">
              Open AI Studio
            </Link>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {recentBriefs.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/ai-studio?brief=${b.id}`}
                  className="block rounded-xl border border-[var(--color-border)] p-4 transition hover:bg-[var(--color-surface)]"
                >
                  <p className="line-clamp-2 text-sm font-medium">{b.prompt}</p>
                  <p className="mt-2 text-xs text-[var(--color-ink-muted)] capitalize">
                    {b.tone ?? "professional"} · {b.status}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {drafts.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Resume drafts</h2>
          <div className="mt-4 space-y-3">
            {drafts.map((d) => (
              <DraftResumeCard key={d.id} session={d} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GrowthScoreCard data={growthDashboard} />
        <BusinessHealthCard score={growthDashboard.businessHealthScore} />
        <ComplianceStatusCard summary={complianceSummary} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Campaigns", value: analytics.summary.totalCampaigns },
          { label: "Published", value: analytics.summary.publishedPosts },
          { label: "AI ideas", value: briefCount },
          { label: "Success", value: `${analytics.summary.successRate}%` },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-sm text-[var(--color-ink-muted)]">{stat.label}</p>
            <p className="mt-1 font-display text-3xl font-semibold">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <h2 className="font-display text-lg font-semibold">Quick actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/ai-studio"
            className="interactive-tile flex items-center gap-3 p-4"
          >
            <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />
            <span className="text-sm font-medium">AI Studio</span>
          </Link>
          <Link
            href="/campaigns/new"
            className="interactive-tile flex items-center gap-3 p-4"
          >
            <Megaphone className="h-5 w-5 text-[var(--color-accent)]" />
            <span className="text-sm font-medium">New campaign</span>
          </Link>
          <Link
            href="/calendar"
            className="interactive-tile flex items-center gap-3 p-4"
          >
            <Calendar className="h-5 w-5 text-[var(--color-accent)]" />
            <span className="text-sm font-medium">Calendar</span>
          </Link>
          <Link
            href="/billing"
            className="interactive-tile flex items-center gap-3 p-4"
          >
            <CreditCard className="h-5 w-5 text-[var(--color-accent)]" />
            <span className="text-sm font-medium">Billing</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
