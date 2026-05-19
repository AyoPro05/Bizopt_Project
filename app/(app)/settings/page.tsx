import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { VersionHistory } from "@/components/changelog/version-history";
import { AppTopbar } from "@/components/shell/app-topbar";
import { ThemeToggle } from "@/components/settings/theme-toggle";
import Link from "next/link";

const DEFAULT_CHANGELOG = [
  {
    id: "1",
    version: "1.1.0",
    title: "Trial & AI content pack",
    body: "$0.99 / 7-day trial with payment method required. AI Studio now generates six variant types per idea. Dark mode in Settings.",
    category: "feature",
    publishedAt: new Date("2026-05-19"),
  },
];

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  if (!org) return <p>No workspace.</p>;

  const changelog = await
    db.changelogEntry.findMany({
      where: { OR: [{ orgId: null }, { orgId: org.id }], isPublic: true },
      orderBy: { publishedAt: "desc" },
      take: 10,
    });

  const entries =
    changelog.length > 0
      ? changelog.map((c) => ({
          id: c.id,
          version: c.version,
          title: c.title,
          body: c.body,
          category: c.category,
          publishedAt: c.publishedAt,
        }))
      : DEFAULT_CHANGELOG;

  return (
    <div>
      <AppTopbar title="Settings" />

      <Card className="mt-6">
        <ThemeToggle />
      </Card>

      <Card className="mt-8">
        <h2 className="font-medium">Social accounts</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          LinkedIn is first-class. Manage all connectors on the Integrations page.
        </p>
        <Link href="/integrations" className="mt-3 inline-block text-sm text-[var(--color-accent)] hover:underline">
          Open integrations →
        </Link>
      </Card>

      <Card className="mt-8">
        <h2 className="font-medium">Privacy & data</h2>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          We collect only what&apos;s needed: account email, campaign content, device binding (1
          device per subscription), purchase history, and diagnostics.
        </p>
      </Card>

      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold">Version history</h2>
        <div className="mt-4">
          <VersionHistory entries={entries} />
        </div>
      </div>
    </div>
  );
}
