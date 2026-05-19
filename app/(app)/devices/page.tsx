import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { listDevices } from "@/services/devices";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { DEVICE_LIMIT_DEFAULT } from "@/lib/constants";
import { Smartphone } from "lucide-react";

export default async function DevicesPage() {
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  if (!org) return <p>No workspace.</p>;

  const [devices, entitlement] = await Promise.all([
    listDevices(org.id),
    db.entitlement.findUnique({ where: { orgId: org.id } }),
  ]);

  const limit = entitlement?.deviceLimit ?? DEVICE_LIMIT_DEFAULT;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Devices</h1>
      <p className="mt-1 text-[var(--color-ink-muted)]">
        {devices.length} of {limit} devices bound
      </p>

      <Card className="mt-8">
        {devices.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            No devices bound. Complete device check after login.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center gap-4 py-4">
                <Smartphone className="h-5 w-5 text-[var(--color-accent)]" />
                <div className="flex-1">
                  <p className="font-medium">{d.label ?? "Unknown device"}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {d.platform} · Last seen {formatDateTime(d.lastSeenAt)}
                  </p>
                </div>
                {d.isPrimary && (
                  <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs text-[var(--color-accent-hover)]">
                    Primary
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
