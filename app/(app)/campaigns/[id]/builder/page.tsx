import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { getCampaign } from "@/services/campaigns";
import { db } from "@/lib/db";
import { AppTopbar } from "@/components/shell/app-topbar";
import { CampaignBuilder } from "@/components/campaigns/campaign-builder";

export default async function CampaignBuilderPage({
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

  const assets = await db.asset.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <AppTopbar title="Campaign builder" />
      <Link href={`/campaigns/${id}`} className="text-sm text-[var(--color-accent)] hover:underline">
        ← Campaign overview
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold">{campaign.title}</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Platforms, carousel slides, and caption — ready to schedule
      </p>

      <div className="mt-8">
        <CampaignBuilder
          campaign={{
            id: campaign.id,
            title: campaign.title,
            caption: campaign.caption,
            platforms: campaign.platforms,
            status: campaign.status,
          }}
          assets={assets.map((a) => ({
            id: a.id,
            url: a.url,
            filename: a.filename,
            type: a.type,
          }))}
        />
      </div>
    </div>
  );
}
