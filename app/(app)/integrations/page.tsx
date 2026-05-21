import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getConnectedPlatformKeys } from "@/lib/platform-accounts";
import { Card } from "@/components/ui/card";
import { AppTopbar } from "@/components/shell/app-topbar";
import Link from "next/link";

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  if (!org) return <p>No workspace.</p>;

  const [registry, connectedKeys] = await Promise.all([
    db.platformRegistry.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: "asc" },
    }),
    getConnectedPlatformKeys(org.id),
  ]);

  const fallback = [
    { key: "linkedin", displayName: "LinkedIn", supportsCarousel: false },
    { key: "instagram", displayName: "Instagram", supportsCarousel: true },
    { key: "facebook", displayName: "Facebook", supportsCarousel: true },
    { key: "tiktok", displayName: "TikTok", supportsCarousel: false },
  ];

  const platforms = registry.length > 0 ? registry : fallback;

  return (
    <div>
      <AppTopbar title="Integrations" />
      <p className="mb-6 text-sm text-[var(--color-ink-muted)]">
        Connector-agnostic platform accounts — LinkedIn is first-class. More platforms ship via
        registry without code changes.
      </p>

      <div className="space-y-3">
        {platforms.map((p) => {
          const connected = connectedKeys.includes(p.key);
          return (
            <Card key={p.key} className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">{p.displayName}</p>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  {p.supportsCarousel ? "Carousel · " : ""}
                  Image · Video
                </p>
              </div>
              {connected ? (
                <span className="text-sm text-emerald-600">Connected</span>
              ) : (
                <Link
                  href={`/api/social/connect?platform=${p.key}`}
                  className="text-sm text-[var(--color-accent)] hover:underline"
                >
                  Connect
                </Link>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
