import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatRelative } from "@/lib/dates";

export type ResumableDraft = {
  id: string;
  entityType: string;
  lastSavedAt: Date;
  brief?: { id: string; prompt: string; status: string } | null;
  seoContent?: { id: string; siteId: string } | null;
};

export function DraftResumeCard({ session }: { session: ResumableDraft }) {
  const href =
    session.brief?.id
      ? `/ai-studio?brief=${session.brief.id}`
      : session.entityType === "seo_content"
        ? session.seoContent ? `/seo?tab=content&siteId=${encodeURIComponent(session.seoContent.siteId)}&contentId=${encodeURIComponent(session.seoContent.id)}` : "/seo?tab=content"
        : session.entityType === "campaign"
        ? "/campaigns"
        : "/ai-studio";

  return (
    <Card className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium capitalize">{session.entityType} draft</p>
        <p className="truncate text-sm text-[var(--color-ink-muted)]">
          {session.brief?.prompt ?? (session.entityType === "seo_content" ? "Saved SEO content — open your content pipeline" : "Unsaved work")}
        </p>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          {formatRelative(session.lastSavedAt)}
        </p>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
      >
        Resume
      </Link>
    </Card>
  );
}
