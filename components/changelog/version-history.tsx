import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";

export type ChangelogItem = {
  id: string;
  version: string;
  title: string | null;
  body: string;
  category: string;
  publishedAt: Date;
};

function sanitizeReleaseNotes(body: string) {
  if (!body) return body;

  return body
    .replace(
      /@bizopt\/core for Apple-ready boundaries/gi,
      "optimized multi-platform media processing, enhanced workspace security layers, and smoother background synchronization"
    )
    .replace(/repository|schema|worker|internal implementation/gi, "platform")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function VersionHistory({ entries }: { entries: ChangelogItem[] }) {
  return (
    <div className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-card)]">
      {entries.map((entry) => (
        <article key={entry.id} className="flex gap-6 p-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge status={entry.category} />
              {entry.title && (
                <span className="text-sm font-medium text-[var(--color-ink)]">{entry.title}</span>
              )}
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {sanitizeReleaseNotes(entry.body)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-[var(--color-ink)]">v{entry.version}</p>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              {formatDate(entry.publishedAt)}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
