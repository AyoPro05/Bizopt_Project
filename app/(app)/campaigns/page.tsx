import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { listCampaigns } from "@/services/campaigns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";
import { Plus } from "lucide-react";

export default async function CampaignsPage() {
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  if (!org) return <p>No workspace.</p>;

  const campaigns = await listCampaigns(org.id);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Campaigns</h1>
          <p className="mt-1 text-[var(--color-ink-muted)]">
            Compose, schedule, and publish across networks
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="h-4 w-4" /> New campaign
          </Button>
        </Link>
      </div>

      <div className="mt-8 space-y-4">
        {campaigns.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-ink-muted)]">
              No campaigns yet. Create your first multi-platform post.
            </p>
          </Card>
        ) : (
          campaigns.map((c) => (
            <Link key={c.id} href={`/campaigns/${c.id}`}>
              <Card className="transition hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-medium">{c.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-muted)]">
                      {c.caption ?? "No caption"}
                    </p>
                    <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
                      {c.platforms.join(" · ")} · {formatDateTime(c.updatedAt)}
                    </p>
                  </div>
                  <Badge status={c.status} />
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
