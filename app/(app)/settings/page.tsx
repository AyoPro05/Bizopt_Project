import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { db } from "@/lib/db";
import { AppTopbar } from "@/components/shell/app-topbar";
import { AccountSettings } from "@/components/account/account-settings";
import { VersionHistory } from "@/components/changelog/version-history";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  const entries = org ? await db.changelogEntry.findMany({ where: { OR: [{ orgId: null }, { orgId: org.id }], isPublic: true }, orderBy: { publishedAt: "desc" }, take: 10 }) : [];
  return <div><AppTopbar/><AccountSettings/><section className="mt-8" aria-labelledby="release-title"><h2 id="release-title" className="mb-4 font-display text-xl font-semibold">Version history</h2>{entries.length ? <div className="min-w-0 overflow-x-auto"><VersionHistory entries={entries}/></div> : <p className="text-sm text-[var(--color-ink-muted)]">No release notes have been published yet.</p>}</section></div>;
}
