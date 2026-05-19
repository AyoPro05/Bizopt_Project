import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { getOrgAnalytics } from "@/services/analytics";
import { Card } from "@/components/ui/card";

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  if (!org) return <p>No workspace.</p>;

  const analytics = await getOrgAnalytics(org.id);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Analytics</h1>
      <p className="mt-1 text-[var(--color-ink-muted)]">
        Publishing health and platform breakdown
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(analytics.summary).map(([key, value]) => (
          <Card key={key}>
            <p className="text-sm capitalize text-[var(--color-ink-muted)]">
              {key.replace(/([A-Z])/g, " $1")}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <h2 className="font-medium">By platform</h2>
        {analytics.platformBreakdown.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-ink-muted)]">No published posts yet</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {analytics.platformBreakdown.map((p) => (
              <li key={p.platform} className="flex justify-between text-sm">
                <span className="capitalize">{p.platform}</span>
                <span>{p.count} posts</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
