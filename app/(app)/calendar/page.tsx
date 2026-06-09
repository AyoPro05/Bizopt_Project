import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/dates";
import { CalendarDays } from "lucide-react";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  if (!org) return <p>No workspace.</p>;

  const posts = await db.scheduledPost.findMany({
    where: { orgId: org.id },
    include: { campaign: true },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });

  const byDate = posts.reduce<Record<string, typeof posts>>((acc, post) => {
    const key = post.scheduledAt.toISOString().slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(post);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Calendar</h1>
      <p className="mt-1 text-[var(--color-ink-muted)]">
        All scheduled posts — always findable, no notification required
      </p>

      <div className="mt-8 space-y-8">
        {Object.keys(byDate).length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-7 w-7" />}
            title="Schedule your first post"
            description="Create a campaign in AI Studio, choose your channels, and drop posts directly into your publishing calendar."
            action={
              <Link href="/ai-studio">
                <Button>Generate Content Pack</Button>
              </Link>
            }
          />
        ) : (
          Object.entries(byDate).map(([date, dayPosts]) => (
            <section key={date}>
              <h2 className="font-display text-lg font-semibold">{date}</h2>
              <div className="mt-3 space-y-2 border-l-2 border-[var(--color-accent)] pl-4">
                {dayPosts.map((post) => (
                  <Card key={post.id} className="py-3">
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium capitalize">{post.platform}</p>
                        <p className="text-xs text-[var(--color-ink-muted)]">
                          {formatDateTime(post.scheduledAt)} · {post.campaign?.title ?? "—"}
                        </p>
                      </div>
                      <Badge status={post.status} />
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
