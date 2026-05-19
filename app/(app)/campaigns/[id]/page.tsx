import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { getCampaign } from "@/services/campaigns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  if (!org) return <p>No workspace.</p>;

  const campaign = await getCampaign(org.id, id);
  if (!campaign) notFound();

  return (
    <div>
      <Link href="/campaigns" className="text-sm text-[var(--color-accent)] hover:underline">
        ← Campaigns
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold">{campaign.title}</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/campaigns/${id}/builder`}
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Open builder
          </Link>
          <Badge status={campaign.status} />
        </div>
      </div>

      <Card className="mt-8">
        <h2 className="font-medium">Caption</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-ink-muted)]">
          {campaign.caption ?? "—"}
        </p>
        <p className="mt-4 text-xs text-[var(--color-ink-muted)]">
          Platforms: {campaign.platforms.join(", ")}
        </p>
        {campaign.scheduledAt && (
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            Scheduled: {formatDateTime(campaign.scheduledAt)}
          </p>
        )}
      </Card>

      {campaign.scheduledPosts.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-medium">Publish queue</h2>
          <ul className="mt-4 divide-y divide-[var(--color-border)]">
            {campaign.scheduledPosts.map((post) => (
              <li key={post.id} className="flex justify-between py-3 text-sm">
                <span className="capitalize">{post.platform}</span>
                <span className="flex items-center gap-2">
                  <Badge status={post.status} />
                  {post.errorMessage && (
                    <span className="text-xs text-red-600">{post.errorMessage}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
