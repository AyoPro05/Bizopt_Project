import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { listDevices } from "@/services/devices";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { DEVICE_LIMIT_DEFAULT } from "@/lib/constants";
import { CircleDot, Laptop2, ShieldCheck, Smartphone } from "lucide-react";

export default async function DevicesPage() {
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  if (!org) return <p>No workspace.</p>;

  const [devices, entitlement] = await Promise.all([
    listDevices(org.id),
    db.entitlement.findUnique({ where: { orgId: org.id } }),
  ]);

  const limit = entitlement?.deviceLimit ?? DEVICE_LIMIT_DEFAULT;
  const boundCount = devices.length;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Session Security</h1>
      <p className="mt-1 text-[var(--color-ink-muted)]">
        Protecting workspace automations by authorizing trusted sessions.
      </p>

      <Card className="mt-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[var(--color-accent)]" />
            <p className="font-medium text-[var(--color-ink)]">Authorized Sessions</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
            {boundCount} of {limit} active
          </span>
        </div>

        {boundCount === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-card)] shadow-[var(--shadow-card)]">
                  <Laptop2 className="h-4 w-4 text-[var(--color-ink-muted)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">Current Active Session</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    Verify this session to safely sync background publishing and automation tasks.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <CircleDot className="h-3 w-3" />
                Pending Verification
              </span>
            </div>
            <div className="mt-4">
              <Link href="/device-check">
                <Button size="sm">Authorize this session</Button>
              </Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center gap-4 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface)]">
                  <Smartphone className="h-4 w-4 text-[var(--color-accent)]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{d.label ?? "Current Active Session"}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {d.platform} · Last seen {formatDateTime(d.lastSeenAt)}
                  </p>
                </div>
                <span
                  className={
                    d.isPrimary
                      ? "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                      : "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                  }
                >
                  <CircleDot className="h-3 w-3" />
                  {d.isPrimary ? "Authorized Workspace" : "Authorized"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
