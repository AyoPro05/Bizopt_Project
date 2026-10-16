import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { db } from "@/lib/db";
import { AppTopbar } from "@/components/shell/app-topbar";
import { AccountSettings } from "@/components/account/account-settings";
import Link from "next/link";
import { AccountSecurityForm } from "@/components/auth/account-security-form";
import { AccountExports } from "@/components/account/account-exports";
import { VersionHistory } from "@/components/changelog/version-history";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  const user = session?.user?.id ? await db.user.findUnique({ where: { id: session.user.id }, select: { email: true, emailVerified: true } }) : null;
  const entries = org ? await db.changelogEntry.findMany({ where: { OR: [{ orgId: null }, { orgId: org.id }], isPublic: true }, orderBy: { publishedAt: "desc" }, take: 10 }) : [];
  return <div><AppTopbar/><AccountSettings/><div className="mt-6"><Link href="/settings/notifications" className="inline-flex min-h-11 items-center text-sm font-medium underline">Manage notification preferences →</Link></div>{user && <div className="mt-6"><AccountSecurityForm emailVerified={!!user.emailVerified} email={user.email}/></div>}<AccountExports/><section className="mt-8" aria-labelledby="release-title"><h2 id="release-title" className="mb-4 font-display text-xl font-semibold">Version history</h2>{entries.length ? <div className="min-w-0 overflow-x-auto"><VersionHistory entries={entries}/></div> : <p className="text-sm text-[var(--color-ink-muted)]">No release notes have been published yet.</p>}</section></div>;
}
